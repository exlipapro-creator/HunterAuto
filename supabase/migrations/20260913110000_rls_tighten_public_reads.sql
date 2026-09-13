-- ============================================================
-- HUNTER AUTOWORKS — SECURITY HARDENING: RLS TIGHTENING
-- 20260913110000_rls_tighten_public_reads.sql
--
-- Why: the browser client never queries Supabase tables directly (verified:
-- src/ contains no .from() calls; the anon client is used only for Auth).
-- The legacy anon-read policies on `services` and `business_settings` were
-- required by an earlier direct-query architecture and are now pure attack
-- surface. All customer-facing/staff data access goes through the Express
-- API (service role) which enforces RBAC server-side.
--
-- Effects:
--   * anon can no longer read `services` or `business_settings` rows.
--   * RLS stays ENABLED on every table (nothing is disabled).
--   * The public API serves the same catalogue/business info through
--     /api/v1/services and /api/v1/public/settings — zero customer impact.
--
-- Idempotent; safe to run once on the live project.
-- ============================================================

drop policy if exists services_public_read on services;
drop policy if exists settings_public_read on business_settings;

-- Sanity: report remaining anon-visible policies (expected: none).
select tablename, policyname
from pg_policies
where schemaname = 'public' and policyname like '%public%';
