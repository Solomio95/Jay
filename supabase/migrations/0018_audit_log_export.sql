-- Long-term audit log export. Supabase retains up to a bounded window of
-- audit_log rows online; for statutory / company-record-keeping we archive
-- older rows as JSONL blobs to Supabase Storage under the `audit-exports`
-- bucket, then prune online rows older than 18 months.

create or replace function audit_log_range(
    p_from timestamptz,
    p_to timestamptz
) returns setof audit_log
language sql
security definer
set search_path = public
as $$
    select a.*
      from audit_log a
     where a.at >= p_from
       and a.at <  p_to
       and auth_role() in ('hr_admin','super_admin')
     order by a.at asc;
$$;

-- Prune audit_log rows older than p_cutoff. Intended to be called by the
-- archival Edge Function *after* it has uploaded the JSONL export. HR-only.
create or replace function audit_log_prune_before(p_cutoff timestamptz)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count int;
begin
    if auth_role() not in ('hr_admin','super_admin') then
        raise exception 'not authorised';
    end if;
    with deleted as (
        delete from audit_log where at < p_cutoff returning 1
    )
    select count(*) into v_count from deleted;
    return v_count;
end;
$$;

grant execute on function audit_log_range(timestamptz, timestamptz) to authenticated;
grant execute on function audit_log_prune_before(timestamptz) to authenticated;

-- Storage bucket for the monthly JSONL archives. Private; only the service
-- role reads/writes it from the audit-log-archive Edge Function, and HR can
-- fetch signed URLs on demand.
insert into storage.buckets (id, name, public)
values ('audit-exports', 'audit-exports', false)
on conflict (id) do nothing;
