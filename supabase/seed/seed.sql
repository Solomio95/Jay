-- Seed data for local dev. Not used in production.
--
-- Everything here is idempotent (INSERT … ON CONFLICT DO NOTHING) so you can
-- re-run after schema changes without wiping the DB.

-- --- Leave types -----------------------------------------------------------
insert into leave_types(code, name, paid, requires_attachment, max_days_per_year) values
    ('AL',   'Annual Leave',       true,  false, 14),
    ('MC',   'Medical Leave',      true,  true,  14),
    ('UPL',  'Unpaid Leave',       false, false, null),
    ('REPL', 'Replacement Leave',  true,  false, null),
    ('MAT',  'Maternity Leave',    true,  true,  98),
    ('PAT',  'Paternity Leave',    true,  false, 7)
on conflict (code) do nothing;

-- --- Malaysian states (full list) ------------------------------------------
insert into states(code, name) values
    ('JHR', 'Johor'),
    ('KDH', 'Kedah'),
    ('KTN', 'Kelantan'),
    ('MLK', 'Melaka'),
    ('NSN', 'Negeri Sembilan'),
    ('PHG', 'Pahang'),
    ('PNG', 'Pulau Pinang'),
    ('PRK', 'Perak'),
    ('PLS', 'Perlis'),
    ('SGR', 'Selangor'),
    ('TRG', 'Terengganu'),
    ('SBH', 'Sabah'),
    ('SWK', 'Sarawak'),
    ('KUL', 'Kuala Lumpur'),
    ('LBN', 'Labuan'),
    ('PJY', 'Putrajaya')
on conflict (code) do nothing;

-- --- Public holidays (federal, 2026) ---------------------------------------
-- State-specific observances and moon-sighting-dependent dates are deliberately
-- omitted; HR maintains the full calendar via the admin UI.
insert into public_holidays(holiday_date, name, state_id)
values
    ('2026-01-01', 'New Year''s Day',           null),
    ('2026-02-17', 'Chinese New Year',          null),
    ('2026-02-18', 'Chinese New Year (Day 2)',  null),
    ('2026-05-01', 'Labour Day',                null),
    ('2026-05-31', 'Wesak Day',                 null),
    ('2026-06-01', 'Agong''s Birthday',         null),
    ('2026-08-31', 'National Day',              null),
    ('2026-09-16', 'Malaysia Day',              null),
    ('2026-12-25', 'Christmas Day',             null)
on conflict (holiday_date, state_id) do nothing;

-- --- Statutory rate tables -------------------------------------------------
-- The in-code tables in @bentop/payroll-my are the source of truth until HR
-- uploads the authoritative CSVs. These existence rows are what lets the
-- payroll orchestrator's assertRatesCoverPayDate check pass for 2026.
insert into statutory_rate_tables(kind, effective_from, data, source_url)
values
    ('epf',   '2026-01-01',
        jsonb_build_object('source', '@bentop/payroll-my/tables/epf-third-schedule'),
        'https://www.kwsp.gov.my/employer/rates'),
    ('socso', '2026-01-01',
        jsonb_build_object('source', '@bentop/payroll-my/tables/socso-categories'),
        'https://www.perkeso.gov.my/en/rate-of-contribution.html'),
    ('eis',   '2026-01-01',
        jsonb_build_object('source', '@bentop/payroll-my/tables/eis-table'),
        'https://www.perkeso.gov.my/en/eis-contribution.html'),
    ('pcb',   '2026-01-01',
        jsonb_build_object('source', '@bentop/payroll-my/pcb'),
        'https://www.hasil.gov.my/')
on conflict (kind, effective_from) do nothing;
