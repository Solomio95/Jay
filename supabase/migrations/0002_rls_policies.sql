-- RLS policies.
-- Core rules:
--   * promoter/area_manager/state_manager can read their own profile and their own payslips.
--   * managers can read rows for employees beneath them in the hierarchy.
--   * hr_admin / super_admin can read everything (writes still go through server-side functions).

-- Helper: current user's role, pulled from the profiles row.
create or replace function auth_role() returns role_kind
language sql stable security definer set search_path = public as $$
    select role from profiles where id = auth.uid()
$$;

-- Helper: employee_id for the signed-in user.
create or replace function auth_employee_id() returns uuid
language sql stable security definer set search_path = public as $$
    select e.id from employees e where e.profile_id = auth.uid()
$$;

-- Helper: true if `candidate_employee` reports (directly or transitively) to the signed-in manager.
create or replace function reports_to_me(candidate_employee uuid) returns boolean
language sql stable security definer set search_path = public as $$
    with recursive chain as (
        select id, manager_id from employee_assignments
            where employee_id = candidate_employee
              and (effective_to is null or effective_to >= current_date)
        union
        select ea.id, ea.manager_id
        from employee_assignments ea
        join chain c on ea.employee_id = c.manager_id
        where ea.effective_to is null or ea.effective_to >= current_date
    )
    select exists (
        select 1 from chain where manager_id = auth_employee_id()
    )
$$;

-- profiles: self + HR.
create policy profiles_self_read on profiles for select
    using (id = auth.uid() or auth_role() in ('hr_admin','super_admin'));

-- employees: self + reports + HR.
create policy employees_read on employees for select
    using (
        profile_id = auth.uid()
        or auth_role() in ('hr_admin','super_admin')
        or (auth_role() in ('area_manager','state_manager') and reports_to_me(id))
    );

-- payslips: strictly self + HR.
create policy payslips_read on payslips for select
    using (
        employee_id = auth_employee_id()
        or auth_role() in ('hr_admin','super_admin')
    );

-- leave_requests: self + current approver + HR.
create policy leave_requests_read on leave_requests for select
    using (
        employee_id = auth_employee_id()
        or current_approver_id = auth_employee_id()
        or auth_role() in ('hr_admin','super_admin')
    );
create policy leave_requests_insert_self on leave_requests for insert
    with check (employee_id = auth_employee_id());

-- sales_records: self + reports + HR.
create policy sales_records_read on sales_records for select
    using (
        employee_id = auth_employee_id()
        or auth_role() in ('hr_admin','super_admin')
        or (auth_role() in ('area_manager','state_manager') and reports_to_me(employee_id))
    );

-- notifications: recipient only.
create policy notifications_read on notifications for select
    using (recipient_id = auth.uid());
create policy notifications_mark_read on notifications for update
    using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Commission line items: self + reports + HR (managers can see what's flowing to/from them).
create policy commission_lines_read on commission_line_items for select
    using (
        employee_id = auth_employee_id()
        or auth_role() in ('hr_admin','super_admin')
        or (auth_role() in ('area_manager','state_manager') and reports_to_me(employee_id))
    );

-- HR-only tables: only hr_admin / super_admin can read.
create policy payroll_runs_hr on payroll_runs for all
    using (auth_role() in ('hr_admin','super_admin'))
    with check (auth_role() in ('hr_admin','super_admin'));

create policy statutory_rate_tables_hr on statutory_rate_tables for all
    using (auth_role() in ('hr_admin','super_admin'))
    with check (auth_role() in ('hr_admin','super_admin'));

create policy commission_schemes_hr on commission_schemes for all
    using (auth_role() in ('hr_admin','super_admin'))
    with check (auth_role() in ('hr_admin','super_admin'));

-- Leaderboards are visible to all authenticated staff.
create policy leaderboard_read_all on leaderboard_snapshots for select
    using (auth.uid() is not null);

create policy contests_read_all on contests for select
    using (auth.uid() is not null);

-- Audit log: HR only.
create policy audit_log_hr on audit_log for select
    using (auth_role() in ('hr_admin','super_admin'));
