-- ============================================================
-- HUNTER AUTOWORKS — CORRECTIVE MIGRATION #3 (live remediation)
-- 20260912130000_normalize_sequences.sql
--
-- Normalizes the document-number sequences so the next drawn value is
-- beyond every existing row. Discovered LIVE by the transactional
-- verification: migrated work orders occupy HA-WO-000183/184 while
-- work_order_seq began at 184 — the first real booking after cutover
-- would have failed with a duplicate work-order number.
-- Idempotent; safe to run any time (including after future imports).
-- ============================================================

select setval('work_order_seq',
  greatest(184, coalesce((select max(substring(work_order_number from '[0-9]+$')::bigint) from work_orders), 184)), true);

select setval('invoice_seq',
  greatest(1000, coalesce((select max(substring(invoice_number from '[0-9]+$')::bigint) from invoices), 999)), true);

select setval('pos_sale_seq',
  coalesce((select max(substring(sale_number from '[0-9]+$')::bigint) from pos_sales), 1), true);
