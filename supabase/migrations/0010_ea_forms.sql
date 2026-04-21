-- Form EA access: employees see their own row; HR sees everything.
-- Generation is done by the `ea-form-run` Edge Function using the service
-- role, so no INSERT/UPDATE policy is needed for authenticated users.

alter table ea_forms enable row level security;

drop policy if exists ea_forms_self_read on ea_forms;
create policy ea_forms_self_read on ea_forms for select
    using (
        employee_id = auth_employee_id()
        or auth_role() in ('hr_admin','super_admin')
    );

-- Helper so the mobile app can ask "did we generate an EA form for me this
-- year yet?" without joining payslips on the client.
create or replace function my_latest_ea_form() returns table (
    year int, pdf_url text, generated_at timestamptz
)
language sql stable security definer set search_path = public as $$
    select ef.year, ef.pdf_url, ef.generated_at
      from ea_forms ef
     where ef.employee_id = auth_employee_id()
     order by ef.year desc
     limit 1
$$;

grant execute on function my_latest_ea_form() to authenticated;
