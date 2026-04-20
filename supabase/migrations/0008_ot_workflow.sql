-- Overtime request workflow.
--
-- OT is simpler than leave: no balance ledger, no multi-step escalation by
-- default. The employee logs work_date + hours + rate_multiplier, the
-- step-1 approver from their chain can approve/reject. On approval the
-- record becomes payable and feeds into the next payroll run via
-- ot_records.status = 'approved' + disposition = 'pay'.

-- The schema reuses leave_status for ot_records.status. We set approved_by
-- to the *current* approver while pending (matches how the mobile
-- approvals tab queries by approved_by = me) and stamp it on approval too.

create or replace function submit_ot_record(
    p_work_date date,
    p_hours numeric,
    p_rate_multiplier numeric default 1.5,
    p_disposition ot_disposition default 'pay',
    p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
    v_employee_id uuid := auth_employee_id();
    v_approver uuid;
    v_id uuid;
begin
    if v_employee_id is null then
        raise exception 'not_authenticated';
    end if;
    if p_hours <= 0 or p_hours > 16 then
        raise exception 'invalid_hours';
    end if;
    if p_rate_multiplier not in (1.5, 2.0, 3.0) then
        raise exception 'invalid_rate_multiplier';
    end if;

    select approver_id into v_approver
      from approval_chains
     where employee_id = v_employee_id
     order by step_no asc
     limit 1;

    insert into ot_records (
        employee_id, work_date, hours, rate_multiplier,
        disposition, status, approved_by, notes
    ) values (
        v_employee_id, p_work_date, p_hours, p_rate_multiplier,
        coalesce(p_disposition, 'pay'), 'pending', v_approver, p_notes
    ) returning id into v_id;

    return v_id;
end $$;

create or replace function act_on_ot_record(
    p_record_id uuid,
    p_action text,            -- 'approve' | 'reject'
    p_note text default null
) returns ot_records
language plpgsql security definer set search_path = public as $$
declare
    v_actor_employee uuid := auth_employee_id();
    v_is_hr boolean := auth_role() in ('hr_admin','super_admin');
    v_rec ot_records;
begin
    select * into v_rec from ot_records where id = p_record_id for update;
    if not found then
        raise exception 'not_found';
    end if;
    if v_rec.status <> 'pending' then
        raise exception 'not_actionable';
    end if;
    if not v_is_hr and v_rec.approved_by is distinct from v_actor_employee then
        raise exception 'not_your_turn';
    end if;

    insert into approval_actions (entity_type, entity_id, actor_id, action, note)
    values (
        'ot_record', v_rec.id, auth.uid(),
        case p_action
            when 'approve' then 'approve'::approval_action_kind
            when 'reject'  then 'reject'::approval_action_kind
            else null
        end,
        p_note
    );

    if p_action = 'approve' then
        update ot_records
           set status = 'approved', approved_by = v_actor_employee
         where id = v_rec.id
         returning * into v_rec;
        return v_rec;
    elsif p_action = 'reject' then
        update ot_records
           set status = 'rejected', approved_by = null
         where id = v_rec.id
         returning * into v_rec;
        return v_rec;
    end if;

    raise exception 'unknown_action';
end $$;

grant execute on function submit_ot_record(date, numeric, numeric, ot_disposition, text) to authenticated;
grant execute on function act_on_ot_record(uuid, text, text) to authenticated;
