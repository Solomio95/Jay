-- Seed data for local dev. Not used in production.

insert into leave_types(code, name, paid, requires_attachment, max_days_per_year) values
    ('AL',   'Annual Leave',       true,  false, 14),
    ('MC',   'Medical Leave',      true,  true,  14),
    ('UPL',  'Unpaid Leave',       false, false, null),
    ('REPL', 'Replacement Leave',  true,  false, null),
    ('MAT',  'Maternity Leave',    true,  true,  98),
    ('PAT',  'Paternity Leave',    true,  false, 7);

insert into states(code, name) values
    ('KUL', 'Kuala Lumpur'),
    ('SEL', 'Selangor'),
    ('PEN', 'Penang'),
    ('JHR', 'Johor');

-- National public holidays (partial — HR loads the full calendar annually).
insert into public_holidays(holiday_date, name, state_id)
select '2026-01-01'::date, 'New Year''s Day', null
where not exists (select 1 from public_holidays where holiday_date = '2026-01-01' and state_id is null);
