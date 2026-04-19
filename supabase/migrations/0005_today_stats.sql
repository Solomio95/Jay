-- Today tile RPC for the mobile app.
--
-- Returns a single JSON object so the mobile client doesn't need to issue
-- four round-trips on app open. Sales figures are in ringgit to match the
-- admin-web convention; commission MTD picks up line items from the latest
-- commission_run covering the current month (draft or approved), falling
-- back to zero when the monthly run hasn't happened yet. Attendance is the
-- fraction of weekday check-ins this month over weekdays elapsed.

create or replace function my_today_stats()
returns json
language plpgsql stable security definer set search_path = public as $$
declare
    v_employee uuid := auth_employee_id();
    v_today date := current_date;
    v_month_start date := date_trunc('month', v_today)::date;
    v_sales_today numeric;
    v_sales_month numeric;
    v_commission_mtd numeric;
    v_weekdays_elapsed int;
    v_checkins int;
    v_attendance numeric;
begin
    if v_employee is null then
        return json_build_object(
            'salesToday', 0, 'salesMonth', 0,
            'commissionMtd', 0, 'attendance', 0
        );
    end if;

    select coalesce(sum(net_amount), 0)
      into v_sales_today
      from sales_records
     where employee_id = v_employee
       and sale_date = v_today
       and superseded_by is null;

    select coalesce(sum(net_amount), 0)
      into v_sales_month
      from sales_records
     where employee_id = v_employee
       and sale_date >= v_month_start
       and sale_date <= v_today
       and superseded_by is null;

    select coalesce(sum(li.computed_amount), 0)
      into v_commission_mtd
      from commission_line_items li
      join commission_runs cr on cr.id = li.commission_run_id
     where li.employee_id = v_employee
       and cr.period_month = v_month_start;

    -- Weekdays elapsed so far this month (Mon–Fri).
    select count(*) into v_weekdays_elapsed
      from generate_series(v_month_start, v_today, interval '1 day') d
     where extract(isodow from d) < 6;

    select count(distinct date_trunc('day', clock_in))
      into v_checkins
      from attendance_logs
     where employee_id = v_employee
       and clock_in >= v_month_start
       and clock_in < (v_today + 1)::timestamp
       and extract(isodow from clock_in) < 6;

    v_attendance := case
        when v_weekdays_elapsed > 0 then least(1, v_checkins::numeric / v_weekdays_elapsed)
        else 0
    end;

    return json_build_object(
        'salesToday', v_sales_today,
        'salesMonth', v_sales_month,
        'commissionMtd', v_commission_mtd,
        'attendance', v_attendance
    );
end $$;

grant execute on function my_today_stats() to authenticated;
