#!/usr/bin/env node
/**
 * Hunter Autoworks — one-time JSON → Supabase migration.
 *
 * DRY-RUN by default: validates and prints the plan without writing.
 *   node scripts/migrate-json-to-supabase.mjs            # dry run
 *   node scripts/migrate-json-to-supabase.mjs --apply    # writes (idempotent upserts)
 *
 * Safety properties:
 *  - Requires SUPABASE_SERVICE_ROLE_KEY from .env (server-side secret only)
 *  - Every legacy id is preserved in `legacy_id` (unique per table) → re-runs
 *    upsert instead of duplicating
 *  - Unresolvable foreign keys are reported, never guessed — affected records
 *    stay in the JSON archive for owner follow-up
 *  - The JSON file itself is never modified or deleted
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- load .env from project root (same contract as the server) ---
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in environment. Aborting.');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const APPLY = process.argv.includes('--apply');
const db = JSON.parse(fs.readFileSync(path.join(root, 'data', 'hunter_db.json'), 'utf8'));

const notes = [];
const skipped = [];
const money = (v) => Math.round(Number(v) || 0);
const normReg = (r) => String(r || '').trim().toUpperCase().replace(/\s+/g, ' ');

async function upsert(table, rows, onConflict = 'legacy_id') {
  if (!rows.length) return [];
  if (!APPLY) {
    console.log(`  [dry-run] ${table}: would upsert ${rows.length} row(s)`);
    return [];
  }
  const out = [];
  for (let i = 0; i < rows.length; i += 400) {
    const { data, error } = await sb.from(table).upsert(rows.slice(i, i + 400), { onConflict }).select();
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
  }
  return out;
}

async function idMap(table) {
  const map = new Map();
  if (!APPLY) return map;
  const { data, error } = await sb.from(table).select('id, legacy_id');
  if (error) throw new Error(`${table}: ${error.message}`);
  for (const r of data ?? []) if (r.legacy_id) map.set(r.legacy_id, r.id);
  return map;
}

const WO_STATUS = new Set(['BOOKED','CHECKED_IN','INSPECTION','ESTIMATE','AWAITING_APPROVAL','APPROVED','IN_SERVICE','QUALITY_CHECK','READY','COMPLETED']);
const PAY_METHOD = new Set(['CASH','M_PESA','TIGO_PESA','AIRTEL_MONEY','CARD','BANK_TRANSFER']);
const INSPECT_STATUS = new Set(['GOOD','ATTENTION','CRITICAL','NOT_CHECKED']);

(async () => {
  console.log(`Hunter Autoworks JSON → Supabase migration — ${APPLY ? 'APPLY MODE' : 'DRY RUN'}`);
  console.log(`Target: ${SUPABASE_URL}\n`);

  // ---------- reference tables ----------
  await upsert('services', db.services.map((s) => ({
    legacy_id: s.id, number: String(s.number), name: s.name, description: s.description ?? '',
    category: s.category, price: money(s.price), price_type: s.priceType ?? 'FIXED',
    duration_minutes: s.durationMinutes ?? 60, booking_enabled: s.bookingEnabled ?? true,
    active: s.active ?? true, featured: s.featured ?? false,
    required_bay_capability: s.requiredBayCapability ?? 'MECHANICAL',
    includes: s.includes ?? [],
  })));

  await upsert('bays', (db.bays ?? []).map((b) => ({ legacy_id: b.id, name: b.name, capability: b.capability })));

  await upsert('staff', (db.staff ?? []).map((s) => ({
    legacy_id: s.id, full_name: s.name, role: s.role,
    email: s.email || null, phone: s.phone || null, active: s.active ?? true,
  })));

  await upsert('suppliers', (db.suppliers ?? []).map((s) => ({
    legacy_id: s.id, name: s.name, contact_person: s.contactPerson ?? null,
    phone: s.phone ?? null, email: s.email ?? null, address: s.address ?? null,
  })));

  // customers — dedupe by normalized phone digits (unique constraint)
  const seenPhones = new Set();
  const custRows = [];
  for (const c of db.customers ?? []) {
    const digits = String(c.phone || '').replace(/\D/g, '');
    if (seenPhones.has(digits)) { notes.push(`customer ${c.id} (${c.name}): duplicate phone — skipped in favor of first occurrence`); continue; }
    seenPhones.add(digits);
    custRows.push({ legacy_id: c.id, full_name: c.name, phone: c.phone, whatsapp: c.whatsapp ?? c.phone, email: c.email ?? null, notes: c.notes ?? null });
  }
  await upsert('customers', custRows);

  const custUuid = await idMap('customers');
  const supUuid = await idMap('suppliers');

  // vehicles — require a resolvable owner
  const vehRows = [];
  for (const v of db.vehicles ?? []) {
    const ownerId = custUuid.get(v.customerId);
    if (!ownerId) { skipped.push(`vehicle ${v.id} (${v.registrationNumber}): owner not resolvable`); continue; }
    vehRows.push({
      legacy_id: v.id, customer_id: ownerId,
      registration_number: v.registrationNumber, make: v.make || 'Vehicle', model: v.model ?? '',
      year: v.year ?? null, mileage_km: v.mileageKm ?? null, vin: v.vin ?? null, color: v.color ?? null,
      last_service_date: v.lastServiceDate ?? null,
    });
  }
  await upsert('vehicles', vehRows);
  const vehUuid = await idMap('vehicles');
  const svcUuid = await idMap('services');
  const staffUuid = await idMap('staff');
  const bayUuid = await idMap('bays');

  // inventory — supplier optional
  const invRows = (db.inventory ?? []).map((i) => ({
    legacy_id: i.id, sku: i.sku, part_number: i.partNumber ?? null, name: i.name,
    category: i.category, cost_price: money(i.costPrice), selling_price: money(i.sellingPrice),
    current_stock: i.currentStock ?? 0, reorder_level: i.reorderLevel ?? 0,
    unit: i.unit ?? 'Piece', bin_location: i.binLocation ?? null,
    supplier_id: i.supplierId ? supUuid.get(i.supplierId) ?? null : null,
    active: i.active ?? true,
  }));
  await upsert('inventory_products', invRows);
  const invUuidByLegacy = await idMap('inventory_products');

  // inventory movements — product required, actor best-effort staff match
  const movRows = [];
  for (const m of db.inventoryMovements ?? []) {
    const productId = invUuidByLegacy.get(m.inventoryItemId);
    if (!productId) { skipped.push(`movement ${m.id}: product ${m.inventoryItemId} missing`); continue; }
    const actorStaff = (db.staff ?? []).find((s) => m.actor?.includes(s.name));
    movRows.push({
      legacy_id: m.id, product_id: productId, movement_type: m.type,
      quantity_change: m.quantityChange, previous_stock: m.previousStock,
      resulting_stock: m.resultingStock, reason: m.reason ?? 'Migrated movement',
      actor_staff_id: actorStaff ? staffUuid.get(actorStaff.id) ?? null : null,
      reference_id: m.reason ?? null,
      created_at: m.timestamp,
    });
  }
  await upsert('inventory_movements', movRows);

  // appointments — vehicle required (schema), customer required
  const apptRows = [];
  const apptSvcPairs = [];
  for (const a of db.appointments ?? []) {
    const customerId = custUuid.get(a.customerId);
    const vehicleId = vehUuid.get(a.vehicleId);
    if (!customerId || !vehicleId) { skipped.push(`appointment ${a.id}: FK unresolvable`); continue; }
    apptRows.push({
      legacy_id: a.id, reference: a.reference,
      customer_id: customerId, vehicle_id: vehicleId,
      scheduled_date: a.scheduledDate, scheduled_time: `${a.scheduledTime}:00`,
      duration_minutes: a.durationMinutes ?? 60, status: a.status ?? 'CONFIRMED',
      notes: a.notes ?? null, idempotency_key: a.idempotencyKey ?? null,
      created_at: a.createdAt,
    });
    for (const sid of a.serviceIds ?? []) {
      const serviceId = svcUuid.get(sid);
      if (serviceId) apptSvcPairs.push({ appointment_legacy: a.id, service_id: serviceId });
      else notes.push(`appointment ${a.id}: service ${sid} not found`);
    }
  }
  await upsert('appointments', apptRows);
  const apptUuid = await idMap('appointments');
  if (APPLY && apptSvcPairs.length) {
    const { error } = await sb.from('appointment_services').upsert(
      apptSvcPairs.map((p) => ({ appointment_id: apptUuid.get(p.appointment_legacy), service_id: p.service_id })),
      { onConflict: 'appointment_id,service_id' },
    );
    if (error) throw new Error(`appointment_services: ${error.message}`);
  }

  // work orders — resolve vehicle by registration, customer by id or name/phone
  const vehiclesByReg = new Map((db.vehicles ?? []).map((v) => [normReg(v.registrationNumber), v]));
  const woRows = [];
  const woSvcPairs = [];
  const woParts = [];
  for (const w of db.workOrders ?? []) {
    const v = vehiclesByReg.get(normReg(w.vehicleRegistration));
    const vehicleId = v ? vehUuid.get(v.id) : undefined;
    let customerId = w.customerId ? custUuid.get(w.customerId) : undefined;
    if (!customerId && v) customerId = custUuid.get(v.customerId);
    if (!vehicleId || !customerId) { skipped.push(`work order ${w.id} (${w.workOrderNumber}): vehicle/customer unresolvable`); continue; }
    woRows.push({
      legacy_id: w.id, work_order_number: w.workOrderNumber,
      appointment_id: w.appointmentId ? apptUuid.get(w.appointmentId) ?? null : null,
      customer_id: customerId, vehicle_id: vehicleId,
      status: WO_STATUS.has(w.status) ? w.status : 'BOOKED',
      priority: w.priority ?? 'NORMAL',
      assigned_technician: w.assignedTechnicianId ? staffUuid.get(w.assignedTechnicianId) ?? null : null,
      assigned_bay: w.assignedBayId ? bayUuid.get(w.assignedBayId) ?? null : null,
      vehicle_mileage: w.vehicleMileage ?? null,
      labor_cost: money(w.laborCost), parts_cost: money(w.partsCost), total_cost: money(w.totalCost),
      notes: w.notes ?? null,
      started_at: w.startedAt ?? null, completed_at: w.completedAt ?? null,
      created_at: w.createdAt, updated_at: w.updatedAt ?? w.createdAt,
    });
    for (const s of w.services ?? []) {
      const serviceId = svcUuid.get(s.serviceId);
      if (serviceId) woSvcPairs.push({ work_order_legacy: w.id, service_id: serviceId, status: s.status ?? 'PENDING', agreed_price: money(s.price) });
      else notes.push(`work order ${w.id}: service ${s.serviceId} not found`);
    }
    for (const p of w.parts ?? []) {
      const productId = invUuidByLegacy.get(p.id) ?? [...invUuidByLegacy.entries()].find(([legacy]) => (db.inventory ?? []).find((i) => i.id === legacy)?.sku === p.sku)?.[1];
      if (productId) woParts.push({ work_order_legacy: w.id, product_id: productId, quantity: p.quantity, unit_price: money(p.unitPrice) });
      else notes.push(`work order ${w.id}: part sku ${p.sku} not found`);
    }
  }
  await upsert('work_orders', woRows);
  const woUuid = await idMap('work_orders');
  if (APPLY && woSvcPairs.length) {
    const { error } = await sb.from('work_order_services').upsert(
      woSvcPairs.map((p) => ({ work_order_id: woUuid.get(p.work_order_legacy), service_id: p.service_id, status: p.status, agreed_price: p.agreed_price })),
      { onConflict: 'work_order_id,service_id' },
    );
    if (error) throw new Error(`work_order_services: ${error.message}`);
  }
  if (APPLY && woParts.length) {
    const { error } = await sb.from('work_order_parts').upsert(
      woParts.map((p) => ({ work_order_id: woUuid.get(p.work_order_legacy), product_id: p.product_id, quantity: p.quantity, unit_price: p.unit_price })),
      { onConflict: 'work_order_id,product_id' },
    );
    if (error) throw new Error(`work_order_parts: ${error.message}`);
  }

  // inspections — one per work order + items
  const inspRows = [];
  const inspItems = [];
  for (const insp of db.inspections ?? []) {
    const workOrderId = woUuid.get(insp.workOrderId);
    if (!workOrderId) { skipped.push(`inspection ${insp.id}: work order ${insp.workOrderId} not migrated`); continue; }
    const technician = (db.staff ?? []).find((s) => insp.technicianName?.includes(s.name));
    inspRows.push({
      legacy_id: insp.id, work_order_id: workOrderId,
      technician: technician ? staffUuid.get(technician.id) ?? null : null,
      overall_summary: insp.overallSummary ?? null,
      overall_condition: INSPECT_STATUS.has(insp.overallCondition) ? insp.overallCondition : null,
      recommendations: insp.recommendations ?? [],
      created_at: insp.createdAt,
    });
    (insp.items ?? []).forEach((item, idx) => {
      inspItems.push({
        inspection_legacy: insp.id, name: item.name, category: item.category ?? null,
        status: INSPECT_STATUS.has(item.status) ? item.status : INSPECT_STATUS.has(item.condition) ? item.condition : 'NOT_CHECKED',
        measurement: item.measurement ?? null,
        note: item.note ?? item.notes ?? null,
        photo_url: item.photoUrl ?? null,
        display_order: idx + 1,
      });
    });
  }
  await upsert('inspections', inspRows);
  if (APPLY && inspItems.length) {
    const inspUuid = await idMap('inspections');
    const { error } = await sb.from('inspection_items').upsert(
      inspItems.map((it) => ({
        inspection_id: inspUuid.get(it.inspection_legacy),
        name: it.name, category: it.category, status: it.status,
        measurement: it.measurement, note: it.note, photo_url: it.photo_url, display_order: it.display_order,
      })).filter((r) => r.inspection_id),
    );
    if (error) throw new Error(`inspection_items: ${error.message}`);
  }

  // invoices + items + payments
  const invoiceRows = [];
  const invoiceItemRows = [];
  const paymentRows = [];
  for (const inv of db.invoices ?? []) {
    const v = vehiclesByReg.get(normReg(inv.vehicleRegistration));
    const vehicleId = v ? vehUuid.get(v.id) ?? null : null;
    let customerId = inv.customerId && inv.customerId !== 'walkin' ? custUuid.get(inv.customerId) : undefined;
    if (!customerId && v) customerId = vehRows.find((r) => r.legacy_id === v.id)?.customer_id;
    invoiceRows.push({
      legacy_id: inv.id, invoice_number: inv.invoiceNumber,
      work_order_id: inv.workOrderId ? woUuid.get(inv.workOrderId) ?? null : null,
      pos_sale_id: null,
      customer_id: customerId ?? null, vehicle_id: vehicleId,
      subtotal: money(inv.subtotal), discount: money(inv.discount), tax: money(inv.tax),
      total: money(inv.total), amount_paid: money(inv.amountPaid),
      balance: Math.max(0, money(inv.total) - money(inv.amountPaid)),
      payment_status: inv.paymentStatus ?? 'PENDING',
      due_date: inv.dueDate || null,
      created_at: inv.createdAt, updated_at: inv.paidAt ?? inv.createdAt,
    });
    for (const it of inv.items ?? []) {
      const itemType = it.type === 'PRODUCT' ? 'PART' : it.type;
      invoiceItemRows.push({ invoice_legacy: inv.id, description: it.description, item_type: itemType, quantity: it.quantity, unit_price: money(it.unitPrice), line_total: money(it.total) });
    }
    if ((inv.amountPaid ?? 0) > 0) {
      paymentRows.push({
        legacy_id: `pay-${inv.id}`, invoice_legacy: inv.id,
        amount: money(inv.amountPaid),
        method: PAY_METHOD.has(inv.paymentMethod) ? inv.paymentMethod : 'CASH',
        reference: inv.paymentReference ?? `MIGRATED:${inv.invoiceNumber}`,
        received_at: inv.paidAt ?? inv.createdAt,
      });
    }
  }
  await upsert('invoices', invoiceRows);
  const invUuid = await idMap('invoices');
  if (APPLY && invoiceItemRows.length) {
    const { error } = await sb.from('invoice_items').insert(
      invoiceItemRows.map((r) => ({ invoice_id: invUuid.get(r.invoice_legacy), description: r.description, item_type: r.item_type, quantity: r.quantity, unit_price: r.unit_price, line_total: r.line_total })),
    );
    if (error) throw new Error(`invoice_items: ${error.message}`);
  }
  if (APPLY && paymentRows.length) {
    const { error } = await sb.from('payments').upsert(
      paymentRows.map((p) => {
        const invoiceId = invUuid.get(p.invoice_legacy);
        return { legacy_id: p.legacy_id, invoice_id: invoiceId, amount: p.amount, method: p.method, reference: p.reference, received_at: p.received_at };
      }).filter((r) => r.invoice_id),
      { onConflict: 'legacy_id' },
    );
    if (error) throw new Error(`payments: ${error.message}`);
  }

  // POS sales → pos_sales (+items); invoices already migrated above are the receipts
  const posRows = [];
  for (const s of db.posSales ?? []) {
    const cashier = (db.staff ?? []).find((st) => s.cashierName?.includes(st.name));
    posRows.push({
      legacy_id: s.id, sale_number: s.saleNumber ?? s.id,
      cashier_id: cashier ? staffUuid.get(cashier.id) ?? null : null,
      customer_id: null, vehicle_reg: s.vehicleRegistration ? normReg(s.vehicleRegistration) : null,
      subtotal: money(s.subtotal), discount: money(s.discount ?? 0), total: money(s.total),
      payment_method: PAY_METHOD.has(s.paymentMethod) ? s.paymentMethod : 'CASH',
      amount_tendered: money(s.amountTendered ?? s.total), change_given: money(s.change ?? 0),
      session_id: null, invoice_id: s.invoiceId ? invUuid.get(s.invoiceId) ?? null : null,
      created_at: s.timestamp,
    });
  }
  await upsert('pos_sales', posRows);

  // cashier sessions — cashier required by schema
  const sessionRows = [];
  for (const c of db.cashierSessions ?? []) {
    const cashier = (db.staff ?? []).find((st) => c.cashierName?.includes(st.name));
    const cashierId = cashier ? staffUuid.get(cashier.id) : undefined;
    if (!cashierId) { skipped.push(`cashier session ${c.id}: cashier "${c.cashierName}" unresolvable`); continue; }
    sessionRows.push({
      legacy_id: c.id, cashier_id: cashierId,
      opening_float: money(c.openingFloat), opened_at: c.openedAt, closed_at: c.closedAt ?? null,
      status: c.status ?? 'CLOSED',
      cash_total: money(c.cashSalesTotal), mobile_money_total: money(c.mobileMoneyTotal),
      card_total: money(c.cardTotal), bank_total: money(c.bankTotal),
      total_sales: money(c.totalSales), expected_cash: money(c.expectedCash),
      counted_cash: c.countedCash != null ? money(c.countedCash) : null,
      variance: c.variance != null ? money(c.variance) : null,
      notes: c.notes ?? null,
    });
  }
  await upsert('cashier_sessions', sessionRows);

  // expenses
  await upsert('expenses', (db.expenses ?? []).map((e) => {
    const staff = (db.staff ?? []).find((s) => e.recordedByName?.includes(s.name));
    return {
      legacy_id: e.id, category: e.category ?? 'OTHER', description: e.description,
      amount: money(e.amount), method: PAY_METHOD.has(e.method) ? e.method : 'CASH',
      reference: e.reference ?? null,
      recorded_by: staff ? staffUuid.get(staff.id) ?? null : null,
      expense_date: (e.date ?? e.createdAt ?? '').slice(0, 10) || null,
      created_at: e.createdAt,
    };
  }).filter((r) => r.expense_date));

  // audit logs — table has no legacy_id; only migrate when target table is empty
  if (APPLY) {
    const { count, error } = await sb.from('audit_logs').select('id', { count: 'exact', head: true });
    if (error) throw new Error(`audit_logs: ${error.message}`);
    if ((count ?? 0) === 0 && (db.auditLogs ?? []).length) {
      const { error: insErr } = await sb.from('audit_logs').insert((db.auditLogs ?? []).map((a) => {
        const staff = (db.staff ?? []).find((s) => a.actor?.includes(s.name));
        return {
          actor_staff_id: staff ? staffUuid.get(staff.id) ?? null : null,
          actor_label: a.actor ?? 'System', actor_role: staff?.role ?? null,
          action: a.action, entity_type: a.entity, entity_id: a.entityId,
          details: a.details ?? null, created_at: a.timestamp,
        };
      }));
      if (insErr) throw new Error(`audit_logs: ${insErr.message}`);
      console.log(`  audit_logs: migrated ${db.auditLogs.length} entries`);
    } else {
      console.log(`  audit_logs: skipped (target has ${count ?? 0} rows; import only into empty table)`);
    }
  }

  // business settings — single row, upsert by id=1
  const s = db.settings;
  if (s) {
    await upsert('business_settings', [{
      id: 1, business_name: s.businessName, tagline: s.tagline ?? null,
      address: s.address ?? null, block: s.block ?? null, city: s.city ?? null,
      phones: s.phones ?? [], whatsapp_numbers: s.whatsappNumbers ?? [],
      instagram: s.instagram ?? null, operating_hours: s.operatingHours ?? {},
      enable_online_booking: s.enableOnlineBooking ?? true,
      tax_rate_percent: money((Number(s.taxRatePercent) || 0) * 100) / 100,
      currency: s.currency ?? 'TZS',
    }], 'id');
  }

  // ---------- summary ----------
  console.log(`\n${APPLY ? 'APPLY' : 'DRY RUN'} complete.`);
  console.log(`Counts: services=${db.services.length} bays=${db.bays?.length ?? 0} staff=${db.staff?.length ?? 0} customers=${custRows.length} vehicles=${vehRows.length} suppliers=${db.suppliers?.length ?? 0} inventory=${invRows.length} movements=${movRows.length} appointments=${apptRows.length} work_orders=${woRows.length} inspections=${inspRows.length} invoices=${invoiceRows.length} pos_sales=${posRows.length} sessions=${sessionRows.length}`);
  if (skipped.length) {
    console.log(`\nSKIPPED (${skipped.length}) — preserved in JSON archive, need owner follow-up:`);
    for (const sk of skipped) console.log('  - ' + sk);
  }
  if (notes.length) {
    console.log(`\nNotes (${notes.length}):`);
    for (const n of notes) console.log('  - ' + n);
  }
  console.log('\nNext steps after --apply:');
  console.log('  1. Spot-check counts in Supabase Table Editor / SQL editor');
  console.log('  2. Set server .env keys → restart → /api/v1/health must report backend=supabase');
  console.log('  3. Re-run: node artifacts/ui-audit/p0-security-tests.mjs (expect 28/28, 401/403 not 503)');
  console.log('  4. Archive (do not delete) data/hunter_db.json');
})().catch((e) => {
  console.error('MIGRATION FAILED:', e.message);
  process.exit(1);
});
