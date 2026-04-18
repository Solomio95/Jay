-- Bentop HR System — initial schema
-- Conventions: snake_case, uuid PKs, created_at/updated_at, soft-delete via deleted_at where relevant.
-- RLS is enabled on every table; policies live in 0002_rls_policies.sql.

create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type role_kind as enum ('promoter', 'area_manager', 'state_manager', 'hr_admin', 'super_admin');
create type wage_type as enum ('monthly', 'hourly', 'daily');
create type employment_status as enum ('active', 'on_leave', 'suspended', 'terminated');
create type commission_rule_type as enum ('tiered_personal', 'override_team', 'override_region', 'flat');
create type commission_run_status as enum ('draft', 'approved', 'locked');
create type payroll_run_status as enum ('draft', 'previewed', 'approved', 'paid', 'closed');
create type leave_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'escalated');
create type ot_disposition as enum ('pay', 'time_off_in_lieu');
create type approval_action_kind as enum ('approve', 'reject', 'escalate', 'override');
create type sales_source as enum ('erp_pull', 'manual_adjustment');
create type leaderboard_scope as enum ('national', 'state', 'region', 'outlet');
create type statutory_kind as enum ('epf', 'socso', 'eis', 'pcb');

-- ---------------------------------------------------------------------------
-- Identity & Hierarchy
-- ---------------------------------------------------------------------------
create table profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    ic_number text unique,
    phone text,
    email text unique,
    role role_kind not null default 'promoter',
    status employment_status not null default 'active',
    photo_url text,
    hired_on date,
    terminated_on date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index on profiles(role);

create table states (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    name text not null
);

create table regions (
    id uuid primary key default gen_random_uuid(),
    state_id uuid not null references states(id),
    code text unique not null,
    name text not null
);

create table outlets (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    name text not null,
    state_id uuid not null references states(id),
    region_id uuid references regions(id),
    opened_on date,
    closed_on date,
    created_at timestamptz not null default now()
);

create table counters (
    id uuid primary key default gen_random_uuid(),
    outlet_id uuid not null references outlets(id),
    code text unique not null,         -- matches ERP counter_code
    name text not null,
    opened_on date,
    closed_on date,
    created_at timestamptz not null default now()
);

create table employees (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null unique references profiles(id) on delete cascade,
    employee_no text unique not null,
    epf_no text,
    socso_no text,
    tax_no text,
    bank_name text,
    bank_account text,
    marital_status text,
    dependents int not null default 0,
    pcb_category text,                 -- e.g. 'K0', 'KA1', 'KA2' per LHDN
    wage_type wage_type not null default 'monthly',
    base_salary numeric(12,2) not null default 0,
    hourly_rate numeric(10,4),
    daily_rate numeric(10,2),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Time-sliced hierarchy: who reports to whom, at which counter, during which window.
-- A promoter typically has one row; managers have one without a counter.
create table employee_assignments (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references employees(id),
    counter_id uuid references counters(id),          -- null for managers
    manager_id uuid references employees(id),         -- null for the top of the chain
    role_in_assignment role_kind not null,
    effective_from date not null,
    effective_to date,                                -- null = still active
    created_at timestamptz not null default now(),
    check (effective_to is null or effective_to >= effective_from)
);
create index on employee_assignments(employee_id, effective_from);
create index on employee_assignments(manager_id);
create index on employee_assignments(counter_id);

-- ---------------------------------------------------------------------------
-- Sales (mirrored from the ERP)
-- ---------------------------------------------------------------------------
create table sales_records (
    id uuid primary key default gen_random_uuid(),
    external_id text not null unique,                 -- ERP primary key
    counter_id uuid not null references counters(id),
    employee_id uuid references employees(id),        -- null if unassigned at time of sale
    sale_date date not null,
    gross_amount numeric(12,2) not null,
    returns_amount numeric(12,2) not null default 0,
    net_amount numeric(12,2) generated always as (gross_amount - returns_amount) stored,
    currency text not null default 'MYR',
    source sales_source not null default 'erp_pull',
    erp_version int not null default 1,
    erp_last_modified_at timestamptz,
    superseded_by uuid references sales_records(id),  -- on amendment
    synced_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);
create index on sales_records(sale_date);
create index on sales_records(employee_id, sale_date);
create index on sales_records(counter_id, sale_date);
create index on sales_records(superseded_by) where superseded_by is null;

create table sales_sync_runs (
    id uuid primary key default gen_random_uuid(),
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    from_date date,
    to_date date,
    records_inserted int not null default 0,
    records_updated int not null default 0,
    records_superseded int not null default 0,
    error_message text,
    success boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Commission & KPI
-- ---------------------------------------------------------------------------
create table commission_schemes (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    effective_from date not null,
    effective_to date,
    status text not null default 'draft',            -- draft | active | archived
    approved_by uuid references profiles(id),
    approved_at timestamptz,
    created_at timestamptz not null default now()
);

create table commission_rules (
    id uuid primary key default gen_random_uuid(),
    scheme_id uuid not null references commission_schemes(id) on delete cascade,
    applies_to_role role_kind not null,
    rule_type commission_rule_type not null,
    priority int not null default 100,
    config jsonb not null,                           -- see docs/commission-rules.md
    created_at timestamptz not null default now()
);
create index on commission_rules(scheme_id, applies_to_role);

create table kpi_rules (
    id uuid primary key default gen_random_uuid(),
    scheme_id uuid not null references commission_schemes(id) on delete cascade,
    name text not null,
    metric text not null,                            -- attendance_rate | return_rate | review_score | new_members | custom
    applies_to_role role_kind not null,
    config jsonb not null,                           -- thresholds -> bonus amount
    created_at timestamptz not null default now()
);

create table kpi_metrics (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references employees(id),
    period_month date not null,                      -- first day of the month
    metric text not null,
    value numeric(14,4) not null,
    source text,                                     -- 'auto' | 'manual' | 'erp'
    recorded_at timestamptz not null default now(),
    unique (employee_id, period_month, metric)
);

create table commission_runs (
    id uuid primary key default gen_random_uuid(),
    period_month date not null,
    scheme_id uuid not null references commission_schemes(id),
    status commission_run_status not null default 'draft',
    run_at timestamptz not null default now(),
    run_by uuid references profiles(id)
);
create index on commission_runs(period_month);

create table commission_line_items (
    id uuid primary key default gen_random_uuid(),
    commission_run_id uuid not null references commission_runs(id) on delete cascade,
    employee_id uuid not null references employees(id),
    rule_id uuid references commission_rules(id),
    kpi_rule_id uuid references kpi_rules(id),
    basis_amount numeric(14,2),
    rate numeric(8,4),                               -- pct or flat multiplier
    computed_amount numeric(12,2) not null,
    notes jsonb
);
create index on commission_line_items(commission_run_id, employee_id);

-- ---------------------------------------------------------------------------
-- Leaderboards & contests
-- ---------------------------------------------------------------------------
create table leaderboard_snapshots (
    id uuid primary key default gen_random_uuid(),
    period_month date not null,
    scope leaderboard_scope not null,
    scope_id uuid,                                   -- state/region/outlet id, null for national
    metric text not null,
    entries jsonb not null,                          -- ranked array [{employee_id, value, rank}, ...]
    generated_at timestamptz not null default now()
);
create index on leaderboard_snapshots(period_month, scope);

create table contests (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    period_start date not null,
    period_end date not null,
    metric text not null,
    scope leaderboard_scope not null,
    prize jsonb,
    status text not null default 'scheduled'
);

-- ---------------------------------------------------------------------------
-- Leave, Holidays, OT, Attendance
-- ---------------------------------------------------------------------------
create table leave_types (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,                       -- AL | MC | UPL | REPL | MAT | PAT
    name text not null,
    paid boolean not null default true,
    requires_attachment boolean not null default false,
    max_days_per_year numeric(5,2)
);

create table leave_balances (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references employees(id),
    leave_type_id uuid not null references leave_types(id),
    year int not null,
    entitled numeric(5,2) not null default 0,
    taken numeric(5,2) not null default 0,
    pending numeric(5,2) not null default 0,
    carried_forward numeric(5,2) not null default 0,
    unique (employee_id, leave_type_id, year)
);

create table leave_requests (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references employees(id),
    leave_type_id uuid not null references leave_types(id),
    start_date date not null,
    end_date date not null,
    half_day boolean not null default false,
    days numeric(5,2) not null,
    reason text,
    attachment_url text,
    status leave_status not null default 'pending',
    current_approver_id uuid references employees(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (end_date >= start_date)
);
create index on leave_requests(employee_id, status);
create index on leave_requests(current_approver_id, status);

create table public_holidays (
    id uuid primary key default gen_random_uuid(),
    holiday_date date not null,
    name text not null,
    state_id uuid references states(id),             -- null = national
    unique (holiday_date, state_id)
);

create table replacement_leaves (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references employees(id),
    worked_on date not null,
    granted_on date not null default current_date,
    expires_on date,
    consumed_by_request_id uuid references leave_requests(id)
);

create table ot_records (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references employees(id),
    work_date date not null,
    hours numeric(5,2) not null,
    rate_multiplier numeric(4,2) not null default 1.5,  -- 1.5 / 2.0 / 3.0 per MY Employment Act
    disposition ot_disposition not null default 'pay',
    status leave_status not null default 'pending',
    approved_by uuid references employees(id),
    notes text,
    created_at timestamptz not null default now()
);

create table attendance_logs (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references employees(id),
    clock_in timestamptz,
    clock_out timestamptz,
    counter_id uuid references counters(id),
    geo_lat numeric(9,6),
    geo_lng numeric(9,6),
    source text not null default 'mobile'
);
create index on attendance_logs(employee_id, clock_in);

-- ---------------------------------------------------------------------------
-- Approvals
-- ---------------------------------------------------------------------------
create table approval_chains (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references employees(id),
    step_no int not null,
    approver_id uuid not null references employees(id),
    escalation_after_hours int not null default 48,
    unique (employee_id, step_no)
);

create table approval_actions (
    id uuid primary key default gen_random_uuid(),
    entity_type text not null,                       -- 'leave_request' | 'ot_record' | 'payroll_run' ...
    entity_id uuid not null,
    actor_id uuid not null references profiles(id),
    action approval_action_kind not null,
    note text,
    acted_at timestamptz not null default now()
);
create index on approval_actions(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Payroll
-- ---------------------------------------------------------------------------
create table statutory_rate_tables (
    id uuid primary key default gen_random_uuid(),
    kind statutory_kind not null,
    effective_from date not null,
    effective_to date,
    data jsonb not null,                             -- band tables / formula inputs
    source_url text,
    loaded_by uuid references profiles(id),
    loaded_at timestamptz not null default now(),
    unique (kind, effective_from)
);

create table payroll_runs (
    id uuid primary key default gen_random_uuid(),
    period_month date not null unique,
    status payroll_run_status not null default 'draft',
    cutoff_date date not null,
    pay_date date not null,
    commission_run_id uuid references commission_runs(id),
    approved_by uuid references profiles(id),
    approved_at timestamptz,
    locked_at timestamptz,
    created_at timestamptz not null default now()
);

create table payslips (
    id uuid primary key default gen_random_uuid(),
    payroll_run_id uuid not null references payroll_runs(id) on delete cascade,
    employee_id uuid not null references employees(id),
    version int not null default 1,
    gross_basic numeric(12,2) not null default 0,
    gross_allowances numeric(12,2) not null default 0,
    gross_commission numeric(12,2) not null default 0,
    gross_ot numeric(12,2) not null default 0,
    gross_kpi_bonus numeric(12,2) not null default 0,
    gross_total numeric(12,2) not null default 0,
    epf_employee numeric(12,2) not null default 0,
    epf_employer numeric(12,2) not null default 0,
    socso_employee numeric(12,2) not null default 0,
    socso_employer numeric(12,2) not null default 0,
    eis_employee numeric(12,2) not null default 0,
    eis_employer numeric(12,2) not null default 0,
    pcb numeric(12,2) not null default 0,
    other_deductions jsonb not null default '[]'::jsonb,
    net_pay numeric(12,2) not null default 0,
    pdf_url text,
    generated_at timestamptz not null default now(),
    unique (payroll_run_id, employee_id, version)
);

create table ea_forms (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references employees(id),
    year int not null,
    pdf_url text,
    generated_at timestamptz not null default now(),
    unique (employee_id, year)
);

-- ---------------------------------------------------------------------------
-- System: notifications, audit log, settings
-- ---------------------------------------------------------------------------
create table notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_id uuid not null references profiles(id),
    type text not null,
    payload jsonb not null,
    delivered_at timestamptz,
    read_at timestamptz,
    created_at timestamptz not null default now()
);
create index on notifications(recipient_id, read_at);

create table audit_log (
    id bigserial primary key,
    actor_id uuid references profiles(id),
    entity_type text not null,
    entity_id uuid,
    action text not null,
    before jsonb,
    after jsonb,
    at timestamptz not null default now()
);
create index on audit_log(entity_type, entity_id);
create index on audit_log(actor_id);

create table app_settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz not null default now()
);

create table feature_flags (
    key text primary key,
    enabled boolean not null default false,
    description text
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger trg_profiles_updated_at before update on profiles
    for each row execute function touch_updated_at();
create trigger trg_employees_updated_at before update on employees
    for each row execute function touch_updated_at();
create trigger trg_leave_requests_updated_at before update on leave_requests
    for each row execute function touch_updated_at();

-- Enable RLS on every user-facing table. Policies in 0002_rls_policies.sql.
alter table profiles enable row level security;
alter table employees enable row level security;
alter table employee_assignments enable row level security;
alter table sales_records enable row level security;
alter table commission_schemes enable row level security;
alter table commission_rules enable row level security;
alter table kpi_rules enable row level security;
alter table kpi_metrics enable row level security;
alter table commission_runs enable row level security;
alter table commission_line_items enable row level security;
alter table leaderboard_snapshots enable row level security;
alter table contests enable row level security;
alter table leave_balances enable row level security;
alter table leave_requests enable row level security;
alter table replacement_leaves enable row level security;
alter table ot_records enable row level security;
alter table attendance_logs enable row level security;
alter table approval_chains enable row level security;
alter table approval_actions enable row level security;
alter table statutory_rate_tables enable row level security;
alter table payroll_runs enable row level security;
alter table payslips enable row level security;
alter table ea_forms enable row level security;
alter table notifications enable row level security;
alter table audit_log enable row level security;
