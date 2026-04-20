-- Leaderboard source RPC.
--
-- The leaderboard-refresh Edge Function aggregates sales for the current
-- period by scope and upserts the ranked result into leaderboard_snapshots.
-- Mobile reads from the snapshot table, not this RPC directly, so the
-- query can be expensive — we only pay the cost once per run.

create or replace function leaderboard_by_net_sales(period date)
returns jsonb
language sql stable security definer set search_path = public as $$
    with totals as (
        select
            sr.employee_id,
            sum(sr.net_amount) as total
          from sales_records sr
         where sr.employee_id is not null
           and sr.superseded_by is null
           and sr.sale_date >= period
           and sr.sale_date < (period + interval '1 month')::date
         group by sr.employee_id
    )
    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'employeeId', t.employee_id,
                'name', coalesce(p.full_name, 'Unknown'),
                'value', t.total
            )
            order by t.total desc
        ),
        '[]'::jsonb
    )
      from totals t
      join employees e on e.id = t.employee_id
      join profiles p on p.id = e.profile_id
$$;

grant execute on function leaderboard_by_net_sales(date) to authenticated;
