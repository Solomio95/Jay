-- Notifications: push-token registry + triggers that fan approval events
-- into the `notifications` queue. The Edge Function `notifications-dispatch`
-- drains the queue and calls Expo Push.
--
-- One profile can have multiple active tokens (phone + tablet). Tokens
-- revoke themselves on sign-out; we also clear them on the server side
-- when Expo returns `DeviceNotRegistered`.

create table if not exists push_tokens (
    token text primary key,
    profile_id uuid not null references profiles(id) on delete cascade,
    platform text not null check (platform in ('ios','android','web')),
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);
create index if not exists push_tokens_profile_idx on push_tokens(profile_id);

alter table push_tokens enable row level security;

drop policy if exists push_tokens_self_read on push_tokens;
create policy push_tokens_self_read on push_tokens for select
    using (profile_id = auth.uid());

drop policy if exists push_tokens_self_write on push_tokens;
create policy push_tokens_self_write on push_tokens for all
    using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Register / refresh a token for the signed-in user. Idempotent.
create or replace function register_push_token(
    p_token text,
    p_platform text
) returns void
language plpgsql security definer set search_path = public as $$
begin
    if auth.uid() is null then
        raise exception 'not_authenticated';
    end if;
    if p_platform not in ('ios','android','web') then
        raise exception 'invalid_platform';
    end if;

    insert into push_tokens (token, profile_id, platform, last_seen_at)
    values (p_token, auth.uid(), p_platform, now())
    on conflict (token) do update
        set profile_id   = excluded.profile_id,
            platform     = excluded.platform,
            last_seen_at = now();
end $$;

grant execute on function register_push_token(text, text) to authenticated;

create or replace function unregister_push_token(p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
    delete from push_tokens
     where token = p_token
       and profile_id = auth.uid();
end $$;

grant execute on function unregister_push_token(text) to authenticated;

-- --- Helpers: enqueue a notification row -----------------------------------

create or replace function _notify_profile(
    p_recipient_profile uuid,
    p_type text,
    p_title text,
    p_body text,
    p_data jsonb default '{}'::jsonb
) returns void
language plpgsql as $$
begin
    if p_recipient_profile is null then
        return;
    end if;
    insert into notifications (recipient_id, type, payload)
    values (
        p_recipient_profile,
        p_type,
        jsonb_build_object('title', p_title, 'body', p_body)
            || jsonb_build_object('data', p_data)
    );
end $$;

create or replace function _notify_employee(
    p_employee uuid,
    p_type text,
    p_title text,
    p_body text,
    p_data jsonb default '{}'::jsonb
) returns void
language plpgsql as $$
declare
    v_profile uuid;
begin
    if p_employee is null then
        return;
    end if;
    select profile_id into v_profile from employees where id = p_employee;
    perform _notify_profile(v_profile, p_type, p_title, p_body, p_data);
end $$;

-- --- Leave triggers --------------------------------------------------------

create or replace function leave_request_notify_ai() returns trigger
language plpgsql as $$
declare
    v_requester text;
begin
    if new.current_approver_id is null then
        return new;
    end if;
    select p.full_name into v_requester
      from employees e join profiles p on p.id = e.profile_id
     where e.id = new.employee_id;
    perform _notify_employee(
        new.current_approver_id,
        'leave_pending',
        'Leave request needs your approval',
        coalesce(v_requester,'Someone') || ' — ' || new.start_date::text
            || ' → ' || new.end_date::text,
        jsonb_build_object('route', '/leave/' || new.id::text, 'leave_id', new.id)
    );
    return new;
end $$;

create or replace function leave_request_notify_au() returns trigger
language plpgsql as $$
begin
    -- Hand-off to next approver.
    if new.status in ('pending','escalated')
       and new.current_approver_id is distinct from old.current_approver_id
       and new.current_approver_id is not null then
        perform _notify_employee(
            new.current_approver_id,
            'leave_pending',
            'Leave request needs your approval',
            new.start_date::text || ' → ' || new.end_date::text,
            jsonb_build_object('route', '/leave/' || new.id::text)
        );
    end if;
    -- Requester updates on final state.
    if new.status in ('approved','rejected') and new.status is distinct from old.status then
        perform _notify_employee(
            new.employee_id,
            'leave_' || new.status,
            'Leave ' || new.status,
            new.start_date::text || ' → ' || new.end_date::text,
            jsonb_build_object('route', '/leave/' || new.id::text)
        );
    end if;
    return new;
end $$;

drop trigger if exists trg_leave_notify_ai on leave_requests;
create trigger trg_leave_notify_ai
    after insert on leave_requests
    for each row execute function leave_request_notify_ai();

drop trigger if exists trg_leave_notify_au on leave_requests;
create trigger trg_leave_notify_au
    after update on leave_requests
    for each row execute function leave_request_notify_au();

-- --- OT triggers -----------------------------------------------------------

create or replace function ot_record_notify_ai() returns trigger
language plpgsql as $$
declare
    v_requester text;
begin
    if new.approved_by is null or new.status <> 'pending' then
        return new;
    end if;
    select p.full_name into v_requester
      from employees e join profiles p on p.id = e.profile_id
     where e.id = new.employee_id;
    perform _notify_employee(
        new.approved_by,
        'ot_pending',
        'OT record needs your approval',
        coalesce(v_requester,'Someone') || ' — '
            || new.hours::text || 'h on ' || new.work_date::text,
        jsonb_build_object('route', '/ot/' || new.id::text)
    );
    return new;
end $$;

create or replace function ot_record_notify_au() returns trigger
language plpgsql as $$
begin
    if new.status in ('approved','rejected') and new.status is distinct from old.status then
        perform _notify_employee(
            new.employee_id,
            'ot_' || new.status,
            'OT ' || new.status,
            new.hours::text || 'h on ' || new.work_date::text,
            jsonb_build_object('route', '/ot/' || new.id::text)
        );
    end if;
    return new;
end $$;

drop trigger if exists trg_ot_notify_ai on ot_records;
create trigger trg_ot_notify_ai
    after insert on ot_records
    for each row execute function ot_record_notify_ai();

drop trigger if exists trg_ot_notify_au on ot_records;
create trigger trg_ot_notify_au
    after update on ot_records
    for each row execute function ot_record_notify_au();

-- --- Payroll triggers ------------------------------------------------------
--
-- Tell every employee with a payslip in a run when it flips to approved (i.e.
-- payslip is ready to view).

create or replace function payroll_run_notify_au() returns trigger
language plpgsql as $$
declare
    v_row record;
begin
    if new.status = 'approved' and old.status is distinct from 'approved' then
        for v_row in
            select ps.employee_id, ps.id as payslip_id
              from payslips ps
             where ps.payroll_run_id = new.id
        loop
            perform _notify_employee(
                v_row.employee_id,
                'payslip_ready',
                'Payslip ready',
                'Your ' || to_char(new.period_month, 'Mon YYYY') || ' payslip is available',
                jsonb_build_object('route', '/payslips/' || v_row.payslip_id::text)
            );
        end loop;
    end if;
    return new;
end $$;

drop trigger if exists trg_payroll_run_notify_au on payroll_runs;
create trigger trg_payroll_run_notify_au
    after update on payroll_runs
    for each row execute function payroll_run_notify_au();
