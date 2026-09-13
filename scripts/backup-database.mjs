#!/usr/bin/env node
/**
 * HUNTER AUTOWORKS — LOGICAL DATABASE BACKUP (self-owned, service-role REST).
 *
 * Exports ALL 28 public tables to a timestamped JSON bundle under
 * artifacts/operations/backups/ plus a manifest (row counts, SHA-256
 * checksum, table list). Needs only SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * (already server-side-only credentials) — no pg_dump, no provider plan
 * features, no extra infrastructure.
 *
 * The bundle is consumed by artifacts/operations/restore-database.mjs, which
 * REFUSES to restore into a project whose health reports non-dev markers
 * unless RESTORE_ALLOW=true is explicitly set (guard against restoring over
 * production).
 *
 * Secrets: the file contains ROW DATA ONLY (business records). Credentials
 * are never written to the bundle. Note: audit_logs / business_settings rows
 * may embed operational detail by design — the bundle must be stored
 * wherever other restricted operational data is stored.
 * * Usage: node artifacts/operations/backup-database.mjs
 *
 * Credentials: read from process.env first (Render Cron Job / CI), then from
 * a local .env file (developer workstations). Values are never printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// scripts/ sits one level below the project root (this tracked copy is what
// the Render backup cron runs; the artifacts/ twin is the working original).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const envLine = (k) => fs.readFileSync('.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith(k + '=')) ?? '';
const strip = (s) => s.slice(s.indexOf('=') + 1).trim().replace(/^"|"$/g, '');
const env = (k) => {
  const v = (process.env[k] || '').trim();
  if (v) return v;
  try { return strip(envLine(k)); } catch { return ''; }
};
const SUPABASE_URL = env('SUPABASE_URL') || env('VITE_SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('missing Supabase credentials: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (env or .env)'); process.exit(1); }

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Canonical table list from supabase/migrations/20260912000001_hunter_core_schema.sql (28 tables).
const TABLES = [
  'staff', 'customers', 'vehicles', 'services', 'bays',
  'appointments', 'appointment_services', 'work_orders', 'work_order_services',
  'inspections', 'inspection_items', 'estimates', 'estimate_items',
  'suppliers', 'inventory_products', 'work_order_parts', 'inventory_movements',
  'purchase_orders', 'purchase_order_items', 'pos_sales', 'pos_sale_items',
  'cashier_sessions', 'invoices', 'invoice_items', 'payments', 'expenses',
  'audit_logs', 'business_settings',
];

const started = Date.now();
const bundle = { generatedAt: new Date().toISOString(), sourceProject: SUPABASE_URL.replace(/^https:\/\//, '').split('.')[0], tables: {} };
const counts = {};

for (const t of TABLES) {
  let rows = [], from = 0, loop = true;
  while (loop) {
    // Transient gateway/compute errors (Supabase 504s, free-tier compute
    // wake-ups) must be retried — a scheduled backup that dies on the first
    // blip is operationally useless. 4 attempts, exponential-ish backoff.
    let data = null, error = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await admin.from(t).select('*').range(from, from + 999);
      data = res.data; error = res.error;
      if (!error) break;
      const retryable = /timeout|gateway|502|503|504|fetch failed|network/i.test(error.message) || !error.code;
      console.warn(`  ${t}: attempt ${attempt} failed — ${error.message}${retryable ? ' (retrying…)' : ''}`);
      if (!retryable || attempt === 4) break;
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
    if (error) { console.error(`EXPORT FAILED ${t} after retries: ${error.message}`); process.exit(1); }
    rows = rows.concat(data ?? []);
    if ((data ?? []).length < 1000) loop = false; else from += 1000;
  }
  bundle.tables[t] = rows;
  counts[t] = rows.length;
  console.log(`  ${t}: ${rows.length}`);
}

const payload = JSON.stringify(bundle);
const checksum = crypto.createHash('sha256').update(payload).digest('hex');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = path.join(root, 'artifacts', 'operations', 'backups');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `hunter-logical-${stamp}.json`);
fs.writeFileSync(file, payload);

const manifest = {
  created_at: bundle.generatedAt,
  source_project: bundle.sourceProject,
  file: path.basename(file),
  bytes: Buffer.byteLength(payload),
  sha256: checksum,
  row_counts: counts,
  tables: TABLES,
  total_rows: Object.values(counts).reduce((a, b) => a + b, 0),
  elapsed_ms: Date.now() - started,
};
fs.writeFileSync(path.join(dir, `hunter-logical-${stamp}.manifest.json`), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(dir, 'LATEST.json'), JSON.stringify(manifest, null, 2));
console.log(`\nBACKUP OK: ${path.basename(file)} (${manifest.bytes} bytes, ${manifest.total_rows} rows, sha256 ${checksum.slice(0, 16)}…) in ${manifest.elapsed_ms}ms`);

// ---------------------------------------------------------------------
// OFF-SITE COPY + RETENTION (Phase G / E-5)
// Render Cron instances have EPHEMERAL disks: a bundle written locally is
// lost when the job finishes. BACKUP_UPLOAD=1 copies the bundle + manifest
// into the project's PRIVATE Supabase Storage bucket `hunter-backups`
// (service-role only; the bucket has no public/policy access), giving the
// backups the same durability as the database itself.
// BACKUP_KEEP=N prunes the oldest objects in storage/ and local backups/
// beyond N retained bundles (0 = never prune locally).
// No credentials are printed or written into artifacts.
// ---------------------------------------------------------------------
const KEEP = Math.max(0, parseInt(process.env.BACKUP_KEEP || '0', 10) || 0);
const storageBase = `${SUPABASE_URL}/storage/v1`;
const authHeaders = { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

async function uploadOffsite() {
  const object = `logical/hunter-logical-${stamp}.json`;
  const up = await fetch(`${storageBase}/object/hunter-backups/${encodeURIComponent(object)}`, {
    method: 'POST', headers: { ...authHeaders, 'x-upsert': 'true' }, body: payload,
  });
  if (!up.ok) { console.error(`OFFSITE UPLOAD FAILED (${up.status}) — bundle retained locally at ${file}`); process.exitCode = 1; return; }
  await fetch(`${storageBase}/object/hunter-backups/${encodeURIComponent(`logical/hunter-logical-${stamp}.manifest.json`)}`, {
    method: 'POST', headers: { ...authHeaders, 'x-upsert': 'true' }, body: JSON.stringify(manifest, null, 2),
  });
  console.log(`OFFSITE OK: hunter-backups/${object}`);
  return object;
}

async function pruneOffsite() {
  const list = await fetch(`${storageBase}/object/list/hunter-backups`, {
    method: 'POST', headers: authHeaders, body: JSON.stringify({ prefix: 'logical', limit: 100, sortBy: { column: 'created_at', order: 'asc' } }),
  });
  if (!list.ok) { console.error(`RETENTION: listing failed (${list.status}) — nothing pruned`); return; }
  const objects = (await list.json()).filter((o) => o.name?.endsWith('.json') && !o.name.endsWith('.manifest.json'));
  const excess = objects.length - KEEP;
  if (excess <= 0) { console.log(`RETENTION: ${objects.length} bundles stored (keep ${KEEP}) — nothing pruned`); return; }
  for (const o of objects.slice(0, excess)) {
    // NOTE: no Content-Type on DELETE — an empty JSON-typed body is parsed and rejected by Storage.
    const noCt = { Authorization: `Bearer ${SERVICE_KEY}` };
    const del = await fetch(`${storageBase}/object/hunter-backups/${encodeURIComponent(`logical/${o.name}`)}`, { method: 'DELETE', headers: noCt });
    // prune the matching manifest too, so no orphan manifests accumulate
    await fetch(`${storageBase}/object/hunter-backups/${encodeURIComponent(`logical/${o.name.replace(/\.json$/, '.manifest.json')}`)}`, { method: 'DELETE', headers: noCt });
    console.log(`RETENTION: pruned ${o.name} (${del.ok ? 'ok' : 'failed ' + del.status})`);
  }
}

if (process.env.BACKUP_UPLOAD === '1') {
  await uploadOffsite();
  if (KEEP > 0) await pruneOffsite();
} else if (KEEP === 0 && !process.env.BACKUP_UPLOAD) {
  console.log('OFFSITE: skipped (set BACKUP_UPLOAD=1 to copy into Supabase Storage hunter-backups)');
}
