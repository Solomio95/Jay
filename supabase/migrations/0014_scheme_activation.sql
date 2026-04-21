-- Commission scheme activation with shadow simulation and second-approver gate.
--
-- The workflow:
--   1. HR creates a draft scheme with rules + KPI rules.
--   2. HR calls `simulate_scheme_activation(scheme_id)` — returns a JSON diff
--      of what the new scheme would have paid vs what was actually paid for
--      the last 3 approved / locked commission runs' tiered_personal lines.
--   3. HR calls `request_scheme_activation(scheme_id)` — snapshots the
--      simulation and creates a pending request.
--   4. A second HR/super_admin calls `activate_scheme(request_id)` — the
--      request's requested_by cannot equal the approver. On success:
--        - the scheme becomes 'active'
--        - any previously-active scheme with overlapping effective dates
--          becomes 'archived'.
--
-- Simulation scope: tiered_personal rules only. Override and KPI rules
-- require re-running the full engine with the month's assignment slices; we
-- report those as "unchanged" in the delta for now and they'll be folded in
-- when the next commission-run executes under the new scheme.

create table if not exists scheme_activation_requests (
    id uuid primary key default gen_random_uuid(),
    scheme_id uuid not null references commission_schemes(id) on delete cascade,
    requested_by uuid not null references profiles(id),
    requested_at timestamptz not null default now(),
    approved_by uuid references profiles(id),
    approved_at timestamptz,
    status text not null default 'pending',       -- pending | approved | rejected
    simulation jsonb not null
);
create index if not exists scheme_activation_scheme_idx
    on scheme_activation_requests(scheme_id, status);

alter table scheme_activation_requests enable row level security;

drop policy if exists scheme_activation_hr_all on scheme_activation_requests;
create policy scheme_activation_hr_all on scheme_activation_requests for all
    using (auth_role() in ('hr_admin','super_admin'))
    with check (auth_role() in ('hr_admin','super_admin'));

-- Apply one set of tiered rules (array of {min, max, pct}, all in ringgit) to
-- a basis amount and return the computed commission.
create or replace function apply_tiers(p_tiers jsonb, p_basis numeric)
returns numeric
language plpgsql
immutable
as $$
declare
    v_tier jsonb;
    v_min numeric;
    v_max numeric;
    v_pct numeric;
    v_slice numeric;
    v_commission numeric := 0;
begin
    if p_basis is null or p_basis <= 0 then
        return 0;
    end if;
    for v_tier in select * from jsonb_array_elements(p_tiers)
    loop
        v_min := coalesce((v_tier->>'min')::numeric, 0) / 100.0;  -- stored in sen
        v_max := case when v_tier->>'max' is null then null
                      else (v_tier->>'max')::numeric / 100.0 end;
        v_pct := coalesce((v_tier->>'pct')::numeric, 0);
        if p_basis <= v_min then
            exit;
        end if;
        v_slice := least(p_basis, coalesce(v_max, p_basis)) - v_min;
        if v_slice > 0 then
            -- config.pct is a whole-number percentage (5 means 5%).
            v_commission := v_commission + v_slice * v_pct / 100.0;
        end if;
    end loop;
    return round(v_commission, 2);
end;
$$;

-- Simulate activation of p_scheme_id against the last 3 posted commission
-- runs. Returns per-employee deltas and totals. HR only.
create or replace function simulate_scheme_activation(p_scheme_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_result jsonb;
    v_months jsonb := '[]'::jsonb;
    v_run record;
    v_month jsonb;
    v_total_old numeric := 0;
    v_total_new numeric := 0;
    v_employee_count int := 0;
begin
    if auth_role() not in ('hr_admin','super_admin') then
        raise exception 'not authorised';
    end if;

    for v_run in
        select cr.id as run_id, cr.period_month
          from commission_runs cr
         where cr.status in ('approved','locked')
         order by cr.period_month desc
         limit 3
    loop
        with lines as (
            select cli.employee_id,
                   sum(cli.basis_amount) as basis_total,
                   sum(cli.computed_amount) as old_amount
              from commission_line_items cli
              join commission_rules r on r.id = cli.rule_id
             where cli.commission_run_id = v_run.run_id
               and r.rule_type = 'tiered_personal'
             group by cli.employee_id
        ),
        new_tiers as (
            select r.applies_to_role,
                   r.config->'tiers' as tiers
              from commission_rules r
             where r.scheme_id = p_scheme_id
               and r.rule_type = 'tiered_personal'
        ),
        matched as (
            select l.employee_id,
                   l.basis_total,
                   l.old_amount,
                   apply_tiers(
                       (select tiers from new_tiers nt
                         join employees e on e.id = l.employee_id
                         join profiles p on p.id = e.profile_id
                        where p.role::text = nt.applies_to_role::text
                        limit 1),
                       l.basis_total
                   ) as new_amount
              from lines l
        )
        select jsonb_build_object(
            'period', v_run.period_month,
            'run_id', v_run.run_id,
            'employees', coalesce(jsonb_agg(jsonb_build_object(
                'employee_id', m.employee_id,
                'basis', m.basis_total,
                'old_commission', m.old_amount,
                'new_commission', coalesce(m.new_amount, m.old_amount),
                'delta', coalesce(m.new_amount, m.old_amount) - m.old_amount
            ) order by m.employee_id), '[]'::jsonb),
            'totals', jsonb_build_object(
                'old', coalesce(sum(m.old_amount), 0),
                'new', coalesce(sum(coalesce(m.new_amount, m.old_amount)), 0),
                'employees', count(*)
            )
        )
          into v_month
          from matched m;

        v_total_old := v_total_old + coalesce((v_month->'totals'->>'old')::numeric, 0);
        v_total_new := v_total_new + coalesce((v_month->'totals'->>'new')::numeric, 0);
        v_employee_count := v_employee_count + coalesce((v_month->'totals'->>'employees')::int, 0);
        v_months := v_months || jsonb_build_array(v_month);
    end loop;

    v_result := jsonb_build_object(
        'scheme_id', p_scheme_id,
        'simulated_at', now(),
        'months', v_months,
        'summary', jsonb_build_object(
            'old_total', v_total_old,
            'new_total', v_total_new,
            'delta', v_total_new - v_total_old,
            'delta_pct', case when v_total_old = 0 then null
                              else round((v_total_new - v_total_old) / v_total_old * 100, 2) end,
            'employee_months', v_employee_count
        ),
        'scope_note', 'tiered_personal only; overrides + KPI unchanged'
    );
    return v_result;
end;
$$;

-- Open an activation request. One pending request per scheme at a time.
create or replace function request_scheme_activation(p_scheme_id uuid)
returns scheme_activation_requests
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row scheme_activation_requests;
    v_scheme commission_schemes;
    v_sim jsonb;
begin
    if auth_role() not in ('hr_admin','super_admin') then
        raise exception 'not authorised';
    end if;

    select * into v_scheme from commission_schemes where id = p_scheme_id;
    if v_scheme.id is null then
        raise exception 'scheme not found';
    end if;
    if v_scheme.status = 'active' then
        raise exception 'scheme is already active';
    end if;
    if exists (
        select 1 from scheme_activation_requests
         where scheme_id = p_scheme_id and status = 'pending'
    ) then
        raise exception 'a pending activation request already exists';
    end if;

    v_sim := simulate_scheme_activation(p_scheme_id);

    insert into scheme_activation_requests
        (scheme_id, requested_by, simulation)
    values
        (p_scheme_id, auth.uid(), v_sim)
    returning * into v_row;

    return v_row;
end;
$$;

-- Second approver activates. Requester cannot be the approver.
create or replace function activate_scheme(p_request_id uuid)
returns scheme_activation_requests
language plpgsql
security definer
set search_path = public
as $$
declare
    v_req scheme_activation_requests;
    v_scheme_id uuid;
begin
    if auth_role() not in ('hr_admin','super_admin') then
        raise exception 'not authorised';
    end if;

    select * into v_req from scheme_activation_requests where id = p_request_id for update;
    if v_req.id is null then
        raise exception 'request not found';
    end if;
    if v_req.status <> 'pending' then
        raise exception 'request is not pending';
    end if;
    if v_req.requested_by = auth.uid() then
        raise exception 'requester cannot approve their own activation';
    end if;

    v_scheme_id := v_req.scheme_id;

    -- Archive any currently-active scheme (one active scheme at a time).
    update commission_schemes
       set status = 'archived',
           effective_to = coalesce(effective_to, current_date)
     where status = 'active'
       and id <> v_scheme_id;

    update commission_schemes
       set status = 'active',
           approved_by = auth.uid(),
           approved_at = now()
     where id = v_scheme_id;

    update scheme_activation_requests
       set status = 'approved',
           approved_by = auth.uid(),
           approved_at = now()
     where id = p_request_id
    returning * into v_req;

    insert into audit_log (actor_id, entity_type, entity_id, action, after)
    values (
        auth.uid(),
        'commission_schemes',
        v_scheme_id,
        'activate',
        jsonb_build_object('request_id', p_request_id)
    );

    return v_req;
end;
$$;

-- Reject a pending request.
create or replace function reject_scheme_activation(p_request_id uuid, p_reason text)
returns scheme_activation_requests
language plpgsql
security definer
set search_path = public
as $$
declare
    v_req scheme_activation_requests;
begin
    if auth_role() not in ('hr_admin','super_admin') then
        raise exception 'not authorised';
    end if;
    update scheme_activation_requests
       set status = 'rejected',
           approved_by = auth.uid(),
           approved_at = now(),
           simulation = simulation || jsonb_build_object('rejection_reason', p_reason)
     where id = p_request_id
       and status = 'pending'
    returning * into v_req;
    if v_req.id is null then
        raise exception 'request not found or not pending';
    end if;
    return v_req;
end;
$$;

grant execute on function simulate_scheme_activation(uuid) to authenticated;
grant execute on function request_scheme_activation(uuid) to authenticated;
grant execute on function activate_scheme(uuid) to authenticated;
grant execute on function reject_scheme_activation(uuid, text) to authenticated;
