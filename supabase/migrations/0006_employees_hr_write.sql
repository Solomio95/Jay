-- Let HR admins edit employee master rows from the admin-web.
-- The existing employees_read policy only covers SELECT; we add UPDATE and
-- INSERT scoped to hr_admin / super_admin so the admin UI can maintain the
-- master without needing service-role elevation.

create policy employees_hr_insert on employees for insert
    with check (auth_role() in ('hr_admin','super_admin'));

create policy employees_hr_update on employees for update
    using (auth_role() in ('hr_admin','super_admin'))
    with check (auth_role() in ('hr_admin','super_admin'));

create policy profiles_hr_update on profiles for update
    using (auth_role() in ('hr_admin','super_admin'))
    with check (auth_role() in ('hr_admin','super_admin'));
