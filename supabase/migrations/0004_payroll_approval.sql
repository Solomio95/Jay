-- Payroll run approval RPC.
--
-- The orchestrator (supabase/functions/payroll-run) leaves runs at
-- `previewed`. HR reviews the payslips on the admin web UI, then calls
-- approve_payroll_run which flips status to `approved` and stamps the actor.
-- Only hr_admin / super_admin may approve.

create or replace function approve_payroll_run(p_run_id uuid)
returns payroll_runs
language plpgsql security definer set search_path = public as $$
declare
    v_run payroll_runs;
begin
    if auth_role() not in ('hr_admin','super_admin') then
        raise exception 'forbidden';
    end if;

    select * into v_run from payroll_runs where id = p_run_id for update;
    if not found then
        raise exception 'not_found';
    end if;
    if v_run.status <> 'previewed' then
        raise exception 'not_previewable';
    end if;

    update payroll_runs
       set status = 'approved',
           approved_by = auth.uid(),
           approved_at = now()
     where id = p_run_id
     returning * into v_run;

    insert into audit_log (actor_id, entity_type, entity_id, action, after)
    values (auth.uid(), 'payroll_run', p_run_id, 'approve', to_jsonb(v_run));

    return v_run;
end $$;

grant execute on function approve_payroll_run(uuid) to authenticated;
