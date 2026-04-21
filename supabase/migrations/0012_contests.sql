-- Contests: HR creates short-lived competitions that ride on top of the
-- normal commission pipeline. Staff see live progress in the mobile app
-- and the winner is announced when period_end passes. Prize handling is
-- out of scope here — the payout row is written manually in the next
-- payroll's commission_adjustments (to be added).

-- Scope target (state / outlet UUID; null for national).
alter table contests
    add column if not exists scope_id uuid,
    add column if not exists description text;

-- Write access for HR; read for everyone authenticated (already in 0002).
drop policy if exists contests_hr_write on contests;
create policy contests_hr_write on contests for all
    using (auth_role() in ('hr_admin','super_admin'))
    with check (auth_role() in ('hr_admin','super_admin'));

-- Live standings: aggregate net_sales per employee over the contest window,
-- scoped to the contest's state/outlet (if any). Returns the top N entries
-- and the caller's own standing, so the mobile strip can show "you're 3rd
-- of 48" without downloading the whole list.
create or replace function contest_standings(p_contest_id uuid, p_top int default 10)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
    v_c contests;
    v_me uuid := auth_employee_id();
    v_entries jsonb;
    v_me_rank int := null;
    v_me_value numeric := 0;
    v_total int := 0;
begin
    select * into v_c from contests where id = p_contest_id;
    if not found then
        raise exception 'not_found';
    end if;

    -- Metric mapping: today we only support net_sales; other metrics can
    -- be added by extending this branch once we have a unified source.
    if v_c.metric <> 'net_sales' then
        raise exception 'unsupported_metric';
    end if;

    with filtered as (
        select sr.employee_id, sr.net_amount, o.state_id, o.id as outlet_id
          from sales_records sr
          join counters c on c.id = sr.counter_id
          join outlets o on o.id = c.outlet_id
         where sr.employee_id is not null
           and sr.superseded_by is null
           and sr.sale_date between v_c.period_start and v_c.period_end
    ),
    totals as (
        select f.employee_id, sum(f.net_amount) as total
          from filtered f
         where case v_c.scope
             when 'national' then true
             when 'state'    then f.state_id  = coalesce(v_c.scope_id, f.state_id)
             when 'region'   then f.state_id  = coalesce(v_c.scope_id, f.state_id)
             when 'outlet'   then f.outlet_id = coalesce(v_c.scope_id, f.outlet_id)
         end
         group by f.employee_id
    ),
    ranked as (
        select
            t.employee_id,
            coalesce(p.full_name, 'Unknown') as name,
            t.total,
            rank() over (order by t.total desc) as r
          from totals t
          join employees e on e.id = t.employee_id
          join profiles p  on p.id = e.profile_id
    )
    select
        coalesce(jsonb_agg(
            jsonb_build_object(
                'employeeId', r.employee_id,
                'name',       r.name,
                'value',      r.total,
                'rank',       r.r
            ) order by r.r asc
        ) filter (where r.r <= p_top), '[]'::jsonb),
        (select count(*) from ranked),
        (select r from ranked where employee_id = v_me),
        coalesce((select total from ranked where employee_id = v_me), 0)
      into v_entries, v_total, v_me_rank, v_me_value
      from ranked r;

    return jsonb_build_object(
        'contest',  to_jsonb(v_c),
        'entries',  v_entries,
        'total',    v_total,
        'me',       jsonb_build_object('rank', v_me_rank, 'value', v_me_value)
    );
end $$;

grant execute on function contest_standings(uuid, int) to authenticated;

-- Return contests that are active today (status = 'active' and within window).
-- Mobile uses this for the Today tile.
create or replace function active_contests() returns setof contests
language sql stable security definer set search_path = public as $$
    select * from contests
     where status = 'active'
       and period_start <= current_date
       and period_end   >= current_date
     order by period_end asc
$$;

grant execute on function active_contests() to authenticated;
