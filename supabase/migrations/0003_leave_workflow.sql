-- Leave workflow: balance triggers + RPC contract.
--
-- Balance ledger
-- --------------
-- `leave_balances` is the running ledger for (employee, leave_type, year).
-- We treat every pending request as reserved capacity (`pending` column) so
-- concurrent submissions can't exceed entitlement. On approval we move the
-- days from `pending` to `taken`; on reject/cancel we release from `pending`.
--
-- Approval chain
-- --------------
-- `approval_chains` is generated from employee_assignments and lists the
-- approvers in order (step_no 1, 2, …). `leave_requests.current_approver_id`
-- always points at the employee id whose turn it is. When they approve, we
-- hand off to the next step; when the last step approves, the request flips
-- to `approved` and the balance trigger fires.

-- --- Balance triggers ------------------------------------------------------

create or replace function _leave_current_year(d date) returns int
language sql immutable as $$ select extract(year from d)::int $$;

create or replace function _leave_apply_balance_delta(
    p_employee uuid,
    p_leave_type uuid,
    p_year int,
    p_pending_delta numeric,
    p_taken_delta numeric
) returns void
language plpgsql as $$
begin
    update leave_balances
       set pending = pending + p_pending_delta,
           taken   = taken   + p_taken_delta
     where employee_id  = p_employee
       and leave_type_id = p_leave_type
       and year         = p_year;
    if not found then
        insert into leave_balances (
            employee_id, leave_type_id, year,
            entitled, taken, pending, carried_forward
        ) values (
            p_employee, p_leave_type, p_year,
            0, greatest(0, p_taken_delta), greatest(0, p_pending_delta), 0
        );
    end if;
end $$;

create or replace function leave_request_on_insert() returns trigger
language plpgsql as $$
begin
    if new.status = 'pending' then
        perform _leave_apply_balance_delta(
            new.employee_id, new.leave_type_id,
            _leave_current_year(new.start_date),
            new.days, 0
        );
    end if;
    return new;
end $$;

create or replace function leave_request_on_update() returns trigger
language plpgsql as $$
declare
    v_year int := _leave_current_year(new.start_date);
begin
    if old.status = new.status then
        return new;
    end if;

    -- Leaving pending: release the reservation.
    if old.status = 'pending' and new.status in ('approved','rejected','cancelled') then
        perform _leave_apply_balance_delta(
            new.employee_id, new.leave_type_id, v_year,
            -new.days, 0
        );
    end if;

    -- Arriving at approved: consume the days.
    if new.status = 'approved' and old.status <> 'approved' then
        perform _leave_apply_balance_delta(
            new.employee_id, new.leave_type_id, v_year,
            0, new.days
        );
    end if;

    return new;
end $$;

drop trigger if exists trg_leave_request_on_insert on leave_requests;
create trigger trg_leave_request_on_insert
    after insert on leave_requests
    for each row execute function leave_request_on_insert();

drop trigger if exists trg_leave_request_on_update on leave_requests;
create trigger trg_leave_request_on_update
    after update on leave_requests
    for each row execute function leave_request_on_update();

-- --- RPCs ------------------------------------------------------------------

-- Compute calendar days between two dates inclusive, skipping Sat/Sun and
-- public holidays that apply to the employee's assigned state. Half-day
-- returns 0.5 for a single-day request.
create or replace function leave_working_days(
    p_employee uuid,
    p_start date,
    p_end date,
    p_half_day boolean
) returns numeric
language plpgsql stable as $$
declare
    v_state uuid;
    v_count numeric := 0;
    v_day date := p_start;
begin
    select outlet.state_id into v_state
      from employee_assignments ea
      join counters c on c.id = ea.counter_id
      join outlets outlet on outlet.id = c.outlet_id
     where ea.employee_id = p_employee
       and ea.effective_from <= p_start
       and (ea.effective_to is null or ea.effective_to >= p_start)
     limit 1;

    while v_day <= p_end loop
        if extract(isodow from v_day) < 6
           and not exists (
               select 1 from public_holidays ph
                where ph.holiday_date = v_day
                  and (ph.state_id is null or ph.state_id = v_state)
           )
        then
            v_count := v_count + 1;
        end if;
        v_day := v_day + 1;
    end loop;

    if p_half_day and v_count > 0 then
        return 0.5;
    end if;
    return v_count;
end $$;

-- Submit a leave request as the signed-in employee.
create or replace function submit_leave_request(
    p_leave_type_code text,
    p_start_date date,
    p_end_date date,
    p_half_day boolean default false,
    p_reason text default null,
    p_attachment_url text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
    v_employee_id uuid := auth_employee_id();
    v_leave_type uuid;
    v_days numeric;
    v_available numeric;
    v_first_approver uuid;
    v_request_id uuid;
begin
    if v_employee_id is null then
        raise exception 'not_authenticated';
    end if;
    if p_end_date < p_start_date then
        raise exception 'end_before_start';
    end if;

    select id into v_leave_type from leave_types where code = p_leave_type_code;
    if v_leave_type is null then
        raise exception 'unknown_leave_type';
    end if;

    v_days := leave_working_days(v_employee_id, p_start_date, p_end_date, coalesce(p_half_day, false));
    if v_days <= 0 then
        raise exception 'zero_working_days';
    end if;

    -- Availability check — paid leave types only (AL, MAT, PAT).
    if p_leave_type_code in ('AL','MAT','PAT') then
        select (coalesce(entitled,0) + coalesce(carried_forward,0)
                - coalesce(taken,0) - coalesce(pending,0))
          into v_available
          from leave_balances
         where employee_id = v_employee_id
           and leave_type_id = v_leave_type
           and year = _leave_current_year(p_start_date);
        if coalesce(v_available, 0) < v_days then
            raise exception 'insufficient_balance';
        end if;
    end if;

    -- Overlap guard.
    if exists (
        select 1 from leave_requests
         where employee_id = v_employee_id
           and status in ('pending','approved')
           and not (end_date < p_start_date or start_date > p_end_date)
    ) then
        raise exception 'overlapping_request';
    end if;

    -- Pick the step-1 approver from the employee's chain.
    select approver_id into v_first_approver
      from approval_chains
     where employee_id = v_employee_id
     order by step_no asc
     limit 1;

    insert into leave_requests (
        employee_id, leave_type_id, start_date, end_date,
        half_day, days, reason, attachment_url,
        status, current_approver_id
    ) values (
        v_employee_id, v_leave_type, p_start_date, p_end_date,
        coalesce(p_half_day, false), v_days, p_reason, p_attachment_url,
        'pending', v_first_approver
    ) returning id into v_request_id;

    return v_request_id;
end $$;

-- Approve / reject / escalate a leave request. Caller must be the current
-- approver (or HR).
create or replace function act_on_leave_request(
    p_request_id uuid,
    p_action text,             -- 'approve' | 'reject' | 'escalate'
    p_note text default null
) returns leave_requests
language plpgsql security definer set search_path = public as $$
declare
    v_actor_employee uuid := auth_employee_id();
    v_is_hr boolean := auth_role() in ('hr_admin','super_admin');
    v_req leave_requests;
    v_next_step int;
    v_next_approver uuid;
begin
    select * into v_req from leave_requests where id = p_request_id for update;
    if not found then
        raise exception 'not_found';
    end if;
    if v_req.status not in ('pending','escalated') then
        raise exception 'not_actionable';
    end if;
    if not v_is_hr and v_req.current_approver_id is distinct from v_actor_employee then
        raise exception 'not_your_turn';
    end if;

    insert into approval_actions (entity_type, entity_id, actor_id, action, note)
    values (
        'leave_request', v_req.id, auth.uid(),
        case p_action
            when 'approve' then 'approve'::approval_action_kind
            when 'reject'  then 'reject'::approval_action_kind
            when 'escalate' then 'escalate'::approval_action_kind
            else null
        end,
        p_note
    );

    if p_action = 'reject' then
        update leave_requests
           set status = 'rejected', current_approver_id = null, updated_at = now()
         where id = v_req.id
         returning * into v_req;
        return v_req;
    end if;

    if p_action in ('approve','escalate') then
        -- Find the next step beyond the current approver.
        select step_no + 1 into v_next_step
          from approval_chains
         where employee_id = v_req.employee_id
           and approver_id = coalesce(v_req.current_approver_id, v_actor_employee)
         order by step_no asc
         limit 1;

        if v_next_step is not null then
            select approver_id into v_next_approver
              from approval_chains
             where employee_id = v_req.employee_id
               and step_no = v_next_step
             limit 1;
        end if;

        if v_next_approver is null then
            -- Final approver (or HR override) reached: approve.
            update leave_requests
               set status = 'approved', current_approver_id = null, updated_at = now()
             where id = v_req.id
             returning * into v_req;
        else
            update leave_requests
               set status = case when p_action = 'escalate' then 'escalated' else 'pending' end,
                   current_approver_id = v_next_approver,
                   updated_at = now()
             where id = v_req.id
             returning * into v_req;
        end if;
        return v_req;
    end if;

    raise exception 'unknown_action';
end $$;

-- Mobile "my balances" tile.
create or replace function my_leave_balances() returns table (
    code text, available numeric
)
language sql stable security definer set search_path = public as $$
    select lt.code,
           coalesce(lb.entitled,0) + coalesce(lb.carried_forward,0)
           - coalesce(lb.taken,0) - coalesce(lb.pending,0) as available
      from leave_types lt
 left join leave_balances lb
        on lb.leave_type_id = lt.id
       and lb.employee_id  = auth_employee_id()
       and lb.year = extract(year from current_date)::int
     order by lt.code
$$;

grant execute on function submit_leave_request(text, date, date, boolean, text, text) to authenticated;
grant execute on function act_on_leave_request(uuid, text, text) to authenticated;
grant execute on function my_leave_balances() to authenticated;
grant execute on function leave_working_days(uuid, date, date, boolean) to authenticated;
