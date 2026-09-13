-- ============================================================
-- HUNTER AUTOWORKS — CORRECTIVE MIGRATION #2 (live remediation)
-- 20260912120000_domain_parity_columns.sql
--
-- Adds two columns the data model requires but the core schema lacked,
-- discovered by executing the real data migration against the live
-- database and diffing every written column against PostgREST's schema:
--   1. vehicles.last_service_date   (domain field mapped by the repository;
--                                    used by service-history features)
--   2. cashier_sessions.legacy_id   (idempotency key for the JSON -> Supabase
--                                    migration tool's re-runnable upserts)
-- The canonical migration has been updated with the same columns; this file
-- exists so the ALREADY-DEPLOYED live schema can be brought to parity with a
-- single paste. Idempotent (IF NOT EXISTS).
-- ============================================================

alter table vehicles
  add column if not exists last_service_date date;

alter table cashier_sessions
  add column if not exists legacy_id text;

-- Idempotency for the migration tool's re-runs (upsert target).
-- Must be a full UNIQUE CONSTRAINT (not a partial index): PostgREST upserts
-- resolve ON CONFLICT targets only against full unique constraints/indexes.
-- NULLs are distinct in Postgres, so sessions without legacy_id are unaffected.
alter table cashier_sessions
  drop constraint if exists cashier_sessions_legacy_id_key;

alter table cashier_sessions
  add constraint cashier_sessions_legacy_id_key unique (legacy_id);
