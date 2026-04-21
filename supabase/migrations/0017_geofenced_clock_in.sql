-- Geofenced clock-in. Outlets grow a geo location + allowed radius; a
-- promoter calls clock_in_geofenced(lat, lng) which:
--   1. Resolves their current counter assignment.
--   2. Computes the haversine distance to that counter's outlet.
--   3. If within allowed_radius_m, writes an attendance_logs row and returns it.
--   4. Otherwise raises and the UI can prompt the manager instead.

alter table outlets
    add column if not exists geo_lat numeric(9,6),
    add column if not exists geo_lng numeric(9,6),
    add column if not exists allowed_radius_m int not null default 200;

-- Haversine distance in metres. Inlined so we don't depend on PostGIS.
create or replace function haversine_m(
    lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric
) returns numeric
language sql immutable as $$
    select 6371000 * 2 * asin(sqrt(
        power(sin(radians(lat2 - lat1) / 2), 2) +
        cos(radians(lat1)) * cos(radians(lat2)) *
        power(sin(radians(lng2 - lng1) / 2), 2)
    ));
$$;

create or replace function clock_in_geofenced(
    p_lat numeric, p_lng numeric
) returns attendance_logs
language plpgsql
security definer
set search_path = public
as $$
declare
    v_employee uuid := auth_employee_id();
    v_counter uuid;
    v_outlet outlets;
    v_dist numeric;
    v_row attendance_logs;
begin
    if v_employee is null then
        raise exception 'no employee record for caller';
    end if;

    select ea.counter_id into v_counter
      from employee_assignments ea
     where ea.employee_id = v_employee
       and ea.counter_id is not null
       and ea.effective_from <= current_date
       and (ea.effective_to is null or ea.effective_to >= current_date)
     order by ea.effective_from desc
     limit 1;

    if v_counter is null then
        raise exception 'no active counter assignment';
    end if;

    select o.* into v_outlet
      from counters c
      join outlets o on o.id = c.outlet_id
     where c.id = v_counter;

    if v_outlet.id is null then
        raise exception 'counter has no outlet';
    end if;
    if v_outlet.geo_lat is null or v_outlet.geo_lng is null then
        raise exception 'outlet % has no geo coordinates set', v_outlet.code;
    end if;

    v_dist := haversine_m(v_outlet.geo_lat, v_outlet.geo_lng, p_lat, p_lng);
    if v_dist > v_outlet.allowed_radius_m then
        raise exception 'outside geofence: % metres from outlet (allowed %)',
            round(v_dist)::int, v_outlet.allowed_radius_m;
    end if;

    -- Block duplicate clock-in within the same calendar day (open shift).
    if exists (
        select 1 from attendance_logs
         where employee_id = v_employee
           and clock_out is null
           and clock_in >= date_trunc('day', now())
    ) then
        raise exception 'already clocked in today; clock out first';
    end if;

    insert into attendance_logs
        (employee_id, clock_in, counter_id, geo_lat, geo_lng, source)
    values
        (v_employee, now(), v_counter, p_lat, p_lng, 'mobile_geo')
    returning * into v_row;

    return v_row;
end;
$$;

create or replace function clock_out_geofenced(
    p_lat numeric, p_lng numeric
) returns attendance_logs
language plpgsql
security definer
set search_path = public
as $$
declare
    v_employee uuid := auth_employee_id();
    v_row attendance_logs;
begin
    if v_employee is null then
        raise exception 'no employee record for caller';
    end if;

    update attendance_logs
       set clock_out = now(),
           geo_lat = coalesce(geo_lat, p_lat),
           geo_lng = coalesce(geo_lng, p_lng)
     where employee_id = v_employee
       and clock_out is null
       and clock_in >= date_trunc('day', now())
    returning * into v_row;

    if v_row.id is null then
        raise exception 'no open shift to clock out from';
    end if;
    return v_row;
end;
$$;

grant execute on function clock_in_geofenced(numeric, numeric) to authenticated;
grant execute on function clock_out_geofenced(numeric, numeric) to authenticated;

-- Promoter can insert + update their own attendance rows; read is unchanged.
drop policy if exists attendance_self_write on attendance_logs;
create policy attendance_self_write on attendance_logs for all
    using (
        employee_id = auth_employee_id()
        or auth_role() in ('hr_admin','super_admin')
    )
    with check (
        employee_id = auth_employee_id()
        or auth_role() in ('hr_admin','super_admin')
    );
