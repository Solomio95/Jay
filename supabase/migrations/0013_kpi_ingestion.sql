-- KPI ingestion: HR can upsert kpi_metrics manually, and an auto RPC derives
-- attendance_rate from attendance_logs for a given period.

-- RLS: HR writes everything; employees see their own rows only.
drop policy if exists kpi_metrics_self_read on kpi_metrics;
create policy kpi_metrics_self_read on kpi_metrics for select
    using (
        employee_id = auth_employee_id()
        or auth_role() in ('hr_admin','super_admin')
    );

drop policy if exists kpi_metrics_hr_write on kpi_metrics;
create policy kpi_metrics_hr_write on kpi_metrics for all
    using (auth_role() in ('hr_admin','super_admin'))
    with check (auth_role() in ('hr_admin','super_admin'));

drop policy if exists kpi_rules_read_all on kpi_rules;
create policy kpi_rules_read_all on kpi_rules for select
    using (auth.uid() is not null);

drop policy if exists kpi_rules_hr_write on kpi_rules;
create policy kpi_rules_hr_write on kpi_rules for all
    using (auth_role() in ('hr_admin','super_admin'))
    with check (auth_role() in ('hr_admin','super_admin'));

-- Upsert one metric value. HR-only.
create or replace function upsert_kpi_metric(
    p_employee_id uuid,
    p_period_month date,
    p_metric text,
    p_value numeric,
    p_source text default 'manual'
) returns kpi_metrics
language plpgsql
security definer
set search_path = public
as $$
declare
    v_row kpi_metrics;
begin
    if auth_role() not in ('hr_admin','super_admin') then
        raise exception 'not authorised';
    end if;

    insert into kpi_metrics (employee_id, period_month, metric, value, source)
    values (p_employee_id, date_trunc('month', p_period_month)::date, p_metric, p_value, p_source)
    on conflict (employee_id, period_month, metric)
    do update set value = excluded.value,
                  source = excluded.source,
                  recorded_at = now()
    returning * into v_row;

    return v_row;
end;
$$;

-- Derive attendance_rate for all active employees for the given period.
-- Expected working days = calendar days in month minus national public holidays
-- minus Sundays. Actual = distinct days with a clock-in in attendance_logs.
create or replace function auto_kpi_attendance(p_period_month date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_period date := date_trunc('month', p_period_month)::date;
    v_month_end date := (v_period + interval '1 month - 1 day')::date;
    v_expected int;
    v_row record;
    v_count int := 0;
begin
    if auth_role() not in ('hr_admin','super_admin') then
        raise exception 'not authorised';
    end if;

    -- Working days: weekdays minus national holidays.
    select count(*)::int into v_expected
      from generate_series(v_period, v_month_end, interval '1 day') g(d)
     where extract(isodow from g.d) < 7           -- exclude Sunday (7)
       and not exists (
           select 1 from public_holidays h
            where h.holiday_date = g.d::date
              and h.state_id is null
       );

    if v_expected = 0 then
        return 0;
    end if;

    for v_row in
        select e.id as employee_id,
               (select count(distinct date_trunc('day', a.clock_in))
                  from attendance_logs a
                 where a.employee_id = e.id
                   and a.clock_in >= v_period
                   and a.clock_in < v_period + interval '1 month') as days
          from employees e
         where e.status = 'active'
    loop
        insert into kpi_metrics (employee_id, period_month, metric, value, source)
        values (v_row.employee_id, v_period, 'attendance_rate',
                least(1.0, v_row.days::numeric / v_expected), 'auto')
        on conflict (employee_id, period_month, metric)
        do update set value = excluded.value,
                      source = 'auto',
                      recorded_at = now();
        v_count := v_count + 1;
    end loop;

    return v_count;
end;
$$;

-- List metrics for a period — HR only (returns all employees).
create or replace function list_kpi_metrics(p_period_month date)
returns table (
    employee_id uuid,
    employee_no text,
    full_name text,
    metric text,
    value numeric,
    source text,
    recorded_at timestamptz
)
language sql
security definer
set search_path = public
as $$
    select m.employee_id,
           e.employee_no,
           e.full_name,
           m.metric,
           m.value,
           m.source,
           m.recorded_at
      from kpi_metrics m
      join employees e on e.id = m.employee_id
     where m.period_month = date_trunc('month', p_period_month)::date
       and auth_role() in ('hr_admin','super_admin')
     order by e.full_name, m.metric;
$$;

grant execute on function upsert_kpi_metric(uuid, date, text, numeric, text) to authenticated;
grant execute on function auto_kpi_attendance(date) to authenticated;
grant execute on function list_kpi_metrics(date) to authenticated;
