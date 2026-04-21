-- In-app announcements. HR posts a message scoped to the whole company,
-- a single role, or a single state; staff see messages whose window covers
-- today and whose scope matches them.

create table if not exists announcements (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    body text not null,
    scope text not null default 'all',               -- all | role | state
    scope_value text,                                -- role or state uuid (cast from text)
    starts_on date not null default current_date,
    ends_on date,                                    -- null = no expiry
    created_by uuid not null references profiles(id),
    created_at timestamptz not null default now()
);
create index if not exists announcements_window_idx on announcements(starts_on, ends_on);

alter table announcements enable row level security;

drop policy if exists announcements_read on announcements;
create policy announcements_read on announcements for select
    using (auth.uid() is not null);

drop policy if exists announcements_hr_write on announcements;
create policy announcements_hr_write on announcements for all
    using (auth_role() in ('hr_admin','super_admin'))
    with check (auth_role() in ('hr_admin','super_admin'));

-- Active announcements for the caller: global + role-match + state-match.
create or replace function my_announcements()
returns setof announcements
language sql
security definer
set search_path = public
as $$
    with me as (
        select p.role::text as role,
               (
                   select o.state_id::text
                     from employee_assignments ea
                     join counters c on c.id = ea.counter_id
                     join outlets o on o.id = c.outlet_id
                    where ea.employee_id = auth_employee_id()
                      and ea.effective_from <= current_date
                      and (ea.effective_to is null or ea.effective_to >= current_date)
                    limit 1
               ) as state_id
          from profiles p
         where p.id = auth.uid()
    )
    select a.*
      from announcements a, me
     where a.starts_on <= current_date
       and (a.ends_on is null or a.ends_on >= current_date)
       and (
           a.scope = 'all'
           or (a.scope = 'role' and a.scope_value = me.role)
           or (a.scope = 'state' and a.scope_value = me.state_id)
       )
     order by a.starts_on desc, a.created_at desc;
$$;

grant execute on function my_announcements() to authenticated;
