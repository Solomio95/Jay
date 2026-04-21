-- Scoped leaderboard RPC: aggregate net sales for a period + scope, ranked
-- in descending order. scope_id is the state/outlet UUID (null for national).
-- Region is aliased to state since we map 1:1 today; keeping the enum open
-- for future region groupings.

create or replace function leaderboard_by_net_sales_scoped(
    p_period date,
    p_scope text,              -- 'national' | 'state' | 'region' | 'outlet'
    p_scope_id uuid default null
) returns jsonb
language sql stable security definer set search_path = public as $$
    with filtered as (
        select sr.employee_id, sr.net_amount
          from sales_records sr
          join counters c on c.id = sr.counter_id
          join outlets o on o.id = c.outlet_id
         where sr.employee_id is not null
           and sr.superseded_by is null
           and sr.sale_date >= p_period
           and sr.sale_date < (p_period + interval '1 month')::date
           and case p_scope
               when 'national' then true
               when 'state'    then o.state_id = p_scope_id
               when 'region'   then o.state_id = p_scope_id
               when 'outlet'   then o.id = p_scope_id
               else false
           end
    ),
    totals as (
        select f.employee_id, sum(f.net_amount) as total
          from filtered f
         group by f.employee_id
    )
    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'employeeId', t.employee_id,
                'name',       coalesce(p.full_name, 'Unknown'),
                'value',      t.total
            ) order by t.total desc
        ),
        '[]'::jsonb
    )
      from totals t
      join employees e on e.id = t.employee_id
      join profiles p on p.id = e.profile_id
$$;

grant execute on function leaderboard_by_net_sales_scoped(date, text, uuid) to authenticated;

-- Where does *I* rank on the national board for the current month? Used by
-- the Today tile so promoters always see their position at a glance.
create or replace function my_leaderboard_position(p_period date default date_trunc('month', current_date)::date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
    v_entries jsonb := leaderboard_by_net_sales_scoped(p_period, 'national', null);
    v_emp uuid := auth_employee_id();
    v_len int := jsonb_array_length(v_entries);
    v_rank int := null;
    v_value numeric := 0;
begin
    for i in 0 .. v_len - 1 loop
        if (v_entries->i->>'employeeId')::uuid = v_emp then
            v_rank := i + 1;
            v_value := (v_entries->i->>'value')::numeric;
            exit;
        end if;
    end loop;
    return jsonb_build_object(
        'rank',      v_rank,
        'total',     v_len,
        'value',     v_value,
        'period',    p_period
    );
end $$;

grant execute on function my_leaderboard_position(date) to authenticated;

-- Upsert target for the leaderboard-refresh Edge Function.
-- scope_id is nullable for national scope, so we coalesce to the zero UUID
-- in the unique expression.
create unique index if not exists leaderboard_snapshots_uniq
    on leaderboard_snapshots (
        period_month,
        scope,
        coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid),
        metric
    );
