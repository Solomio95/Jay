# Phased delivery roadmap

## Phase 1 — MVP (~10-12 weeks, pilot one state first)

**In scope**

- Auth (phone OTP), employee master, hierarchy, outlets & counters.
- ERP sync (read-only, hourly, idempotent).
- Promoter mobile app: Today, My Sales, Payslips, Profile, Notifications.
- Manager mobile app: Team view, Approvals inbox (single-step).
- Leave (AL / MC / UPL) with single-step approval.
- Public holidays + replacement leave generation.
- Payroll: monthly run, fixed salary + tiered-personal commission,
  statutory deductions (EPF / SOCSO / EIS / PCB), payslip PDF.
- HR admin web: employee CRUD, payroll preview/run, basic scheme editor.

**Out of Phase 1**: override commissions, KPI bonuses, leaderboards, contests,
OT-in-lieu, EA form, bank file exports.

## Phase 2 — Motivation engine (~6-8 weeks)

- Override commissions for area + state managers.
- Configurable KPI rules and metric ingestion.
- Leaderboards (national / state / outlet) with mobile UI.
- Contests with prize tracking.
- OT tracking with pay-or-time-off-in-lieu.
- Multi-step approval chains with escalation.
- Bank file export (Maybank2u).
- KWSP / PERKESO / LHDN submission file exports.
- EA form generation.

## Phase 3 — Polish & scale (~4-6 weeks)

- Geofenced clock-in; attendance KPI fully automated.
- Offline mode (WatermelonDB) for promoters in low-signal department stores.
- In-app announcements, pulse surveys.
- Manager analytics dashboard.
- Self-serve commission scheme A/B simulator.
- SSO for HR admins.
- Long-term audit-log export to S3 Glacier.

## Pilot gate

Before company-wide rollout: run one full payroll cycle in **one state**
(recommend Selangor + KL since Klang Valley is the largest concentration) in
parallel with Bentop's current manual payroll. Only switch over when the
numbers tie to the sen for three consecutive months.
