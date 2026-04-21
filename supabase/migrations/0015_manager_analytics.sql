-- Manager analytics — rolls up net sales, commission, and attendance for
-- every employee in the caller's transitive reporting chain.

create or replace function manager_team_summary(p_period_month date default date_trunc('month', now())::date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_period date := date_trunc('month', p_period_month)::date;
    v_next date := (v_period + interval '1 month')::date;
    v_manager uuid := auth_employee_id();
    v_rows jsonb := '[]'::jsonb;
begin
    if v_manager is null or auth_role() not in ('area_manager','state_manager','hr_admin','super_admin') then
        raise exception 'not authorised';
    end if;

    with reports as (
        select distinct e.id
          from employees e
         where auth_role() in ('hr_admin','super_admin')
            or reports_to_me(e.id)
    ),
    sales as (
        select s.employee_id, sum(s.net_amount) as net_sales, count(*) as txn_count
          from sales_records s
         where s.employee_id in (select id from reports)
           and s.superseded_by is null
           and s.sale_date >= v_period and s.sale_date < v_next
         group by s.employee_id
    ),
    commission as (
        select cli.employee_id, sum(cli.computed_amount) as commission
          from commission_line_items cli
          join commission_runs cr on cr.id = cli.commission_run_id
         where cli.employee_id in (select id from reports)
           and cr.period_month = v_period
         group by cli.employee_id
    ),
    attendance as (
        select m.employee_id, m.value as attendance_rate
          from kpi_metrics m
         where m.employee_id in (select id from reports)
           and m.period_month = v_period
           and m.metric = 'attendance_rate'
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'employee_id', e.id,
        'employee_no', e.employee_no,
        'full_name', p.full_name,
        'role', p.role,
        'net_sales', coalesce(s.net_sales, 0),
        'txn_count', coalesce(s.txn_count, 0),
        'commission', coalesce(c.commission, 0),
        'attendance_rate', att.attendance_rate
    ) order by coalesce(s.net_sales, 0) desc), '[]'::jsonb)
      into v_rows
      from reports r
      join employees e on e.id = r.id
      join profiles p on p.id = e.profile_id
      left join sales s on s.employee_id = e.id
      left join commission c on c.employee_id = e.id
      left join attendance att on att.employee_id = e.id
     where p.status = 'active';

    return jsonb_build_object(
        'period_month', v_period,
        'generated_at', now(),
        'rows', v_rows
    );
end;
$$;

create or replace function manager_team_totals(p_period_month date default date_trunc('month', now())::date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_summary jsonb := manager_team_summary(p_period_month);
    v_rows jsonb := v_summary->'rows';
    v_count int := jsonb_array_length(v_rows);
    v_sales numeric := 0;
    v_commission numeric := 0;
    v_att_sum numeric := 0;
    v_att_count int := 0;
    v_row jsonb;
begin
    for v_row in select * from jsonb_array_elements(v_rows)
    loop
        v_sales := v_sales + coalesce((v_row->>'net_sales')::numeric, 0);
        v_commission := v_commission + coalesce((v_row->>'commission')::numeric, 0);
        if (v_row->>'attendance_rate') is not null then
            v_att_sum := v_att_sum + (v_row->>'attendance_rate')::numeric;
            v_att_count := v_att_count + 1;
        end if;
    end loop;

    return jsonb_build_object(
        'period_month', v_summary->>'period_month',
        'employees', v_count,
        'net_sales', v_sales,
        'commission', v_commission,
        'avg_attendance', case when v_att_count = 0 then null
                               else round(v_att_sum / v_att_count, 4) end
    );
end;
$$;

grant execute on function manager_team_summary(date) to authenticated;
grant execute on function manager_team_totals(date) to authenticated;
