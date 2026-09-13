import { Router, Request, Response } from 'express';
import { repo } from './lib/repository.js';
import { authRouter } from './lib/routes-auth.js';
import { usersRouter } from './lib/routes-users.js';
import { accountRouter } from './lib/routes-account.js';
import { requireAuth, AuthedRequest } from './lib/auth.js';
import type { AuthenticatedActor } from './lib/supabaseAdmin.js';
import { isSupabaseConfigured, getSupabaseAdmin } from './lib/supabaseAdmin.js';
import type { WorkOrderStatus, InspectionReport } from '../src/types.js';

/**
 * Hunter Autoworks API v1 — access-classified routes over the repository layer.
 *
 * Persistence: Supabase (production, when keys configured) or the JSON domain
 * store (development fallback). Behavior and validation rules are identical.
 *
 * PUBLIC (rate-limited):        /health, /services (read), /services/:id (read),
 *                               /availability (read), /appointments (POST = guest booking),
 *                               /service-status/:reference (read, sanitized),
 *                               /invoices/verify/:token (read, token-gated),
 *                               /public/settings (read, business info only)
 *
 * STAFF (Bearer token + RBAC):  everything else.
 *
 * SECURITY: actor identity is derived server-side from the Supabase Auth
 * token. Client-provided actor headers/fields are ignored.
 */

export const apiRouter = Router();

function publicSettings(s: Awaited<ReturnType<typeof repo.getSettings>>) {
  return {
    businessName: s.businessName,
    tagline: s.tagline,
    address: s.address,
    block: s.block,
    city: s.city,
    phones: s.phones,
    whatsappNumbers: s.whatsappNumbers,
    instagram: s.instagram,
    operatingHours: s.operatingHours,
    enableOnlineBooking: s.enableOnlineBooking,
    currency: s.currency,
    taxRatePercent: s.taxRatePercent,
  };
}

// --- Per-IP rate limiter for public endpoints ---
const pubHits = new Map<string, { count: number; firstAt: number }>();
function publicRateLimited(req: Request): boolean {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const rec = pubHits.get(ip);
  if (!rec || now - rec.firstAt > 60_000) {
    pubHits.set(ip, { count: 1, firstAt: now });
    return false;
  }
  rec.count += 1;
  return rec.count > 60;
}

function actorLabel(actor: AuthenticatedActor | undefined): string {
  if (!actor) return 'System';
  return `${actor.name} (${actor.role})`;
}

// ============================================================
// AUTH (staff identity)
// ============================================================
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/account', accountRouter);

// ============================================================
// PUBLIC: health (liveness + readiness), services catalogue, business info
// ============================================================
// LIVENESS (`/health/live`): process is alive. No dependency checks — cheap,
// always 200 while the event loop runs. This is NOT a Supabase health claim.
apiRouter.get('/health/live', (_req: Request, res: Response) => {
  res.json({ status: 'ok', system: 'Hunter Autoworks The Car Lab API', time: new Date().toISOString() });
});

// READINESS (`/health`): can the service actually perform its production
// dependency work? Exercises a real, cheap Supabase Auth operation — never
// merely "an env var exists". Result is cached for 30 s so monitoring polls
// stay inexpensive. On Supabase failure the endpoint reports 503 with a
// structured body (no crash, no JSON fallback, no secrets); recovery is
// detected on the next uncached probe.
let lastProbe: { at: number; ok: boolean; detail: string } | null = null;
apiRouter.get('/health', async (_req: Request, res: Response) => {
  const cached = lastProbe && Date.now() - lastProbe.at < 30_000 ? lastProbe : null;
  let ok = cached?.ok ?? false;
  let detail = cached?.detail ?? '';
  if (!cached) {
    try {
      if (!isSupabaseConfigured()) {
        ok = false; detail = 'not_configured';
      } else {
        const admin = getSupabaseAdmin();
        const { error } = await admin!.auth.getUser('_probe_invalid_token_for_readiness');
        // A definitive 4xx auth-protocol answer (e.g. 400 for the invalid
        // probe token) is PROOF the Auth service round-tripped. supabase-js
        // marks network failures as AuthRetryableFetchError with status 0,
        // and real outages as 5xx — both mean DOWN.
        const s = error?.status ?? 0;
        ok = error ? s >= 400 && s < 500 : true;
        detail = ok ? 'supabase_auth_reachable' : `supabase_error_${s || 'unreachable'}`;
      }
    } catch (e) {
      ok = false; detail = 'supabase_unreachable';
    }
    lastProbe = { at: Date.now(), ok, detail };
  }
  const body: Record<string, unknown> = {
    status: ok ? 'ok' : 'degraded',
    system: 'Hunter Autoworks The Car Lab API',
    backend: repo.backend,
    readiness: detail,
    time: new Date().toISOString(),
  };
  if (!ok) body.status = 'degraded';
  res.status(ok ? 200 : 503).json(body);
});

apiRouter.get('/services', async (_req: Request, res: Response) => {
  try {
    const services = await repo.getServices();
    res.json({ success: true, data: services });
  } catch {
    res.status(500).json({ success: false, error: 'Services are temporarily unavailable' });
  }
});

apiRouter.get('/services/:id', async (req: Request, res: Response) => {
  const service = await repo.getServiceById(req.params.id);
  if (!service || !service.active) {
    return res.status(404).json({ success: false, error: 'Service not found' });
  }
  res.json({ success: true, data: service });
});

apiRouter.get('/public/settings', async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: publicSettings(await repo.getSettings()) });
  } catch {
    res.status(500).json({ success: false, error: 'Business information temporarily unavailable' });
  }
});

// ============================================================
// PUBLIC: availability + guest booking creation
// ============================================================
apiRouter.get('/availability', async (req: Request, res: Response) => {
  if (publicRateLimited(req)) return res.status(429).json({ success: false, error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' });
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, error: 'Invalid date format' });
  }
  const duration = Math.min(600, Math.max(15, parseInt(req.query.duration as string, 10) || 60));
  const availability = await repo.checkAvailability(date, duration);
  res.json({ success: true, data: availability });
});

apiRouter.post('/appointments', async (req: Request, res: Response) => {
  if (publicRateLimited(req)) return res.status(429).json({ success: false, error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' });
  try {
    const {
      customerName, customerPhone, customerWhatsapp,
      vehicleRegistration, vehicleMakeModel, vehicleYear, vehicleMileage,
      serviceIds, scheduledDate, scheduledTime, notes,
      idempotencyKey,
    } = req.body || {};

    if (!customerName || !customerPhone || !vehicleRegistration || !Array.isArray(serviceIds) || !serviceIds.length || !scheduledDate || !scheduledTime) {
      return res.status(400).json({ success: false, error: 'Missing required booking fields' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(scheduledDate)) || !/^\d{2}:\d{2}$/.test(String(scheduledTime))) {
      return res.status(400).json({ success: false, error: 'Invalid appointment date or time' });
    }
    // Calendar-valid date: the regex alone lets 2026-13-45 through to Postgres,
    // which failed as an unhandled 500. Validate real calendar dates here.
    const parsedDate = new Date(`${scheduledDate}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== String(scheduledDate)) {
      return res.status(400).json({ success: false, error: 'Invalid appointment date or time' });
    }
    // Idempotency replay MUST precede slot-capacity validation: a customer
    // retrying after a network failure replays their key even if the slot
    // filled in between — replaying must never be rejected as "slot full".
    // Genuinely new bookings are still capacity-checked below and the RPC
    // enforces capacity atomically at persist time.
    if (typeof idempotencyKey === 'string' && idempotencyKey.length >= 8) {
      const existing = await repo.findAppointmentByIdempotencyKey(idempotencyKey);
      if (existing) {
        return res.status(200).json({ success: true, data: existing, duplicate: true });
      }
    }

    // Only allow slots published by the availability endpoint
    const availability = await repo.checkAvailability(String(scheduledDate), 60);
    if (!availability.availableSlots.includes(String(scheduledTime))) {
      return res.status(400).json({ success: false, error: 'The selected time is not available. Please choose another slot.' });
    }

    const appointment = await repo.createAppointment({
      customerName: String(customerName).slice(0, 120),
      customerPhone: String(customerPhone).slice(0, 32),
      customerWhatsapp: customerWhatsapp ? String(customerWhatsapp).slice(0, 32) : undefined,
      vehicleRegistration: String(vehicleRegistration).slice(0, 32),
      vehicleMakeModel: String(vehicleMakeModel || 'Vehicle').slice(0, 120),
      vehicleYear: vehicleYear ? parseInt(vehicleYear, 10) : undefined,
      vehicleMileage: vehicleMileage ? parseInt(vehicleMileage, 10) : undefined,
      serviceIds: serviceIds.map(String).slice(0, 20),
      scheduledDate: String(scheduledDate),
      scheduledTime: String(scheduledTime),
      notes: notes ? String(notes).slice(0, 1000) : undefined,
      idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
    });

    // Contract: a brand-new booking is 201; a concurrent request that lost the
    // pre-check race but was caught by the RPC's duplicate branch replays as
    // 200 + duplicate:true — identical semantics to the pre-check replay path.
    if ((appointment as any).duplicate) {
      return res.status(200).json({ success: true, data: appointment, duplicate: true });
    }
    res.status(201).json({ success: true, data: appointment });
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('SLOT_UNAVAILABLE') || msg.includes('SLOT_FULL')) {
      return res.status(400).json({ success: false, error: 'That slot has just filled up. Please pick another time.' });
    }
    if (msg.includes('DATE_IN_PAST')) {
      return res.status(400).json({ success: false, error: 'Please choose a future date.' });
    }
    // Unknown/invalid service references arrive as Postgres uuid-cast errors;
    // they are client input problems (400), not server failures (500).
    if (msg.includes('NO_VALID_SERVICES') || /invalid input syntax for type uuid|malformed (uuid )?literal/i.test(msg)) {
      return res.status(400).json({ success: false, error: 'Some of the selected services are not available. Please review your booking.' });
    }
    // Narrowest race: two requests miss the pre-check, both enter the RPC; the
    // loser hits the appointments.idempotency_key unique index at insert time
    // (the winner has committed by then). The row exists — replay it as the
    // canonical 200 duplicate instead of surfacing a 500 to a real customer
    // retry. Scoped strictly to the idempotency-key constraint. (Key is
    // re-read from req.body here: the try-scoped destructure is not in scope.)
    // Server-side visibility for booking failures (responses stay generic).
    console.error('[booking] failed:', msg.slice(0, 300));
    const replayKey = typeof (req.body as any)?.idempotencyKey === 'string' ? (req.body as any).idempotencyKey : undefined;
    if (replayKey && replayKey.length >= 8 && /duplicate key/i.test(msg) && /idempotency/i.test(msg)) {
      const existing = await repo.findAppointmentByIdempotencyKey(replayKey);
      if (existing) return res.status(200).json({ success: true, data: existing, duplicate: true });
    }
    res.status(500).json({ success: false, error: 'We could not complete your booking right now. Please try again.' });
  }
});

// ============================================================
// PUBLIC: sanitized service status tracking
// ============================================================
apiRouter.get('/service-status/:reference', async (req: Request, res: Response) => {
  if (publicRateLimited(req)) return res.status(429).json({ success: false, error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' });
  const ref = decodeURIComponent(req.params.reference).trim();
  let wo = await repo.getWorkOrderByNumberOrId(ref);
  if (!wo) {
    const matching = await repo.getWorkOrdersByVehicle(ref);
    if (matching.length > 0) wo = matching[matching.length - 1];
  }
  if (!wo) {
    return res.status(404).json({ success: false, error: 'No active service found for this reference' });
  }
  res.json({
    success: true,
    data: {
      workOrderNumber: wo.workOrderNumber,
      vehicleRegistration: wo.vehicleRegistration,
      vehicleMakeModel: wo.vehicleMakeModel,
      status: wo.status,
      services: wo.services.map(s => ({ name: s.serviceName, status: s.status })),
      assignedBay: wo.assignedBayName,
      startedAt: wo.startedAt,
      completedAt: wo.completedAt,
      createdAt: wo.createdAt,
    },
  });
});

// ============================================================
// PUBLIC: invoice verification via unpredictable token
// ============================================================
apiRouter.get('/invoices/verify/:token', async (req: Request, res: Response) => {
  if (publicRateLimited(req)) return res.status(429).json({ success: false, error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' });
  const invoice = await repo.verifyInvoiceByToken(req.params.token);
  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invalid verification token' });
  }
  res.json({
    success: true,
    data: {
      verified: true,
      invoiceNumber: invoice.invoiceNumber,
      vehicleRegistration: invoice.vehicleRegistration,
      total: invoice.total,
      paymentStatus: invoice.paymentStatus,
      paidAt: invoice.paidAt,
      issuedDate: invoice.createdAt,
    },
  });
});

// ============================================================
// STAFF: service catalogue management
// ============================================================
apiRouter.patch('/services/:id', requireAuth('settings'), async (req: AuthedRequest, res: Response) => {
  const allowed: Record<string, unknown> = {};
  const body = req.body || {};
  for (const key of ['name', 'description', 'price', 'priceType', 'durationMinutes', 'bookingEnabled', 'active', 'featured'] as const) {
    if (key in body) allowed[key] = body[key];
  }
  const updated = await repo.updateService(req.params.id, allowed, actorLabel(req.actor));
  if (!updated) return res.status(404).json({ success: false, error: 'Service not found' });
  res.json({ success: true, data: updated });
});

// ============================================================
// STAFF: vehicles & passports
// ============================================================
apiRouter.get('/vehicles', requireAuth('vehicles'), async (_req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: await repo.getVehicles() });
});

// ---------------------------------------------------------------------------
// STAFF: customers list (documented in the API surface; previously missing —
// requests fell through to the SPA fallback and returned HTML with 200, which
// broke API clients and masked the gap. RBAC: read=staff with 'customers',
// write roles enforced in WRITE_ROLES for future write endpoints).
// ---------------------------------------------------------------------------
apiRouter.get('/customers', requireAuth('customers'), async (_req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: await repo.getCustomers() });
});

apiRouter.get('/vehicles/:reg/passport', requireAuth('vehicles'), async (req: AuthedRequest, res: Response) => {
  const reg = decodeURIComponent(req.params.reg);
  const vehicle = await repo.findVehicleByReg(reg);
  if (!vehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });
  const workOrders = await repo.getWorkOrdersByVehicle(reg);
  const inspections = (await Promise.all(workOrders.map(wo => repo.getInspectionByWorkOrderId(wo.id)))).filter(Boolean);
  res.json({ success: true, data: { vehicle, history: workOrders, inspections } });
});

// ============================================================
// STAFF: appointments list
// ============================================================
apiRouter.get('/appointments', requireAuth('appointments'), async (_req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: await repo.getAppointments() });
});

// ============================================================
// STAFF: work orders
// ============================================================
apiRouter.get('/work-orders', requireAuth('work-orders'), async (_req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: await repo.getWorkOrders() });
});

apiRouter.get('/work-orders/:id', requireAuth('work-orders'), async (req: AuthedRequest, res: Response) => {
  const wo = await repo.getWorkOrderByNumberOrId(req.params.id);
  if (!wo) return res.status(404).json({ success: false, error: 'Work order not found' });
  const inspection = await repo.getInspectionByWorkOrderId(wo.id);
  res.json({ success: true, data: { ...wo, inspection } });
});

const WO_STATUSES: WorkOrderStatus[] = ['BOOKED','CHECKED_IN','INSPECTION','ESTIMATE','AWAITING_APPROVAL','APPROVED','IN_SERVICE','QUALITY_CHECK','READY','COMPLETED'];

apiRouter.patch('/work-orders/:id/status', requireAuth('work-orders'), async (req: AuthedRequest, res: Response) => {
  const { status } = req.body || {};
  if (!WO_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid work order status' });
  }
  const updated = await repo.updateWorkOrderStatus(req.params.id, status, actorLabel(req.actor));
  if (!updated) return res.status(404).json({ success: false, error: 'Work order not found' });
  res.json({ success: true, data: updated });
});

apiRouter.patch('/work-orders/:id/assign', requireAuth('work-orders'), async (req: AuthedRequest, res: Response) => {
  const { bayId, technicianId } = req.body || {};
  const updated = await repo.assignWorkOrderBayAndTech(req.params.id, bayId, technicianId, actorLabel(req.actor));
  if (!updated) return res.status(404).json({ success: false, error: 'Work order not found' });
  res.json({ success: true, data: updated });
});

// ============================================================
// STAFF: inspections (DVI)
// ============================================================
apiRouter.get('/inspections/:workOrderId', requireAuth('inspections'), async (req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: (await repo.getInspectionByWorkOrderId(req.params.workOrderId)) || null });
});

apiRouter.post('/inspections', requireAuth('inspections'), async (req: AuthedRequest, res: Response) => {
  try {
    const report = await repo.saveInspection(req.body as InspectionReport, actorLabel(req.actor));
    res.json({ success: true, data: report });
  } catch {
    res.status(400).json({ success: false, error: 'Could not save the inspection report' });
  }
});

// ============================================================
// STAFF: inventory
// ============================================================
apiRouter.get('/inventory', requireAuth('inventory'), async (_req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: await repo.getInventory() });
});

apiRouter.get('/inventory/movements', requireAuth('inventory'), async (_req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: await repo.getInventoryMovements() });
});

apiRouter.post('/inventory/adjust', requireAuth('inventory'), async (req: AuthedRequest, res: Response) => {
  const { itemId, quantityChange, reason } = req.body || {};
  if (!itemId || quantityChange === undefined || !reason) {
    return res.status(400).json({ success: false, error: 'Missing required adjustment fields' });
  }
  // Strict integer validation: reject zero, fractions, and non-numeric strings
  // instead of silently coercing (parseInt('1.5')===1, parseInt(0)===0 both
  // previously produced meaningless journal entries).
  const parsed = typeof quantityChange === 'number' ? quantityChange : parseInt(String(quantityChange), 10);
  if (!Number.isInteger(parsed) || parsed === 0) {
    return res.status(400).json({ success: false, error: 'Quantity must be a non-zero whole number' });
  }
  if (Math.abs(parsed) > 100_000) {
    return res.status(400).json({ success: false, error: 'Quantity change out of range' });
  }
  const result = await repo.adjustInventoryStock(String(itemId), parsed, String(reason).slice(0, 300), actorLabel(req.actor));
  if (!result.success) return res.status(400).json({ success: false, error: result.error });
  res.json({ success: true, data: result.item });
});

// ============================================================
// STAFF: point of sale
// ============================================================
apiRouter.post('/pos/checkout', requireAuth('pos'), async (req: AuthedRequest, res: Response) => {
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  const normalized = items.map((it: any) => ({
    id: String(it.id ?? it.itemId ?? ''),
    type: String(it.type ?? it.itemType ?? '').toUpperCase(),
    quantity: parseInt(it.quantity, 10) || 0,
  })).filter((it: any) => it.id && (it.type === 'SERVICE' || it.type === 'PRODUCT'));

  const result = await repo.processPosSale({
    cashierName: actorLabel(req.actor),
    customerName: body.customerName,
    customerPhone: body.customerPhone,
    vehicleRegistration: body.vehicleRegistration,
    items: normalized,
    paymentMethod: body.paymentMethod,
    amountTendered: Number(body.amountTendered ?? body.tendered ?? 0),
    discount: body.discount ? Number(body.discount) : 0,
  });

  if (!result.success) return res.status(400).json({ success: false, error: result.error });
  res.status(201).json({ success: true, data: result });
});

apiRouter.get('/pos/sessions', requireAuth('pos'), async (_req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: await repo.getCashierSessions() });
});

apiRouter.post('/pos/sessions/:id/close', requireAuth('pos'), async (req: AuthedRequest, res: Response) => {
  const { countedCash, notes } = req.body || {};
  const closed = await repo.closeCashierSession(req.params.id, parseFloat(countedCash) || 0, notes);
  if (!closed) return res.status(404).json({ success: false, error: 'Session not found' });
  res.json({ success: true, data: closed });
});

// ============================================================
// STAFF: invoices
// ============================================================
apiRouter.get('/invoices', requireAuth('invoices'), async (_req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: await repo.getInvoices() });
});

apiRouter.get('/invoices/:number', requireAuth('invoices'), async (req: AuthedRequest, res: Response) => {
  const invoice = await repo.getInvoiceByNumber(req.params.number);
  if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
  res.json({ success: true, data: invoice });
});

// ============================================================
// STAFF: operational data
// ============================================================
apiRouter.get('/bays', requireAuth('workshop'), async (_req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: await repo.getBays() });
});

apiRouter.get('/staff', requireAuth('staff'), async (_req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: await repo.getStaff() });
});

apiRouter.get('/audit-logs', requireAuth('audit'), async (_req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: await repo.getAuditLogs() });
});

apiRouter.get('/settings', requireAuth('settings'), async (_req: AuthedRequest, res: Response) => {
  res.json({ success: true, data: await repo.getSettings() });
});

apiRouter.patch('/settings', requireAuth('settings'), async (req: AuthedRequest, res: Response) => {
  const updated = await repo.updateSettings(req.body || {}, actorLabel(req.actor));
  res.json({ success: true, data: updated });
});

apiRouter.get('/reports/summary', requireAuth('reports'), async (_req: AuthedRequest, res: Response) => {
  const [invoices, workOrders, inventory] = await Promise.all([
    repo.getInvoices(), repo.getWorkOrders(), repo.getInventory(),
  ]);

  const totalRevenue = invoices.filter(i => i.paymentStatus === 'PAID').reduce((acc, i) => acc + i.total, 0);
  const inventoryValuation = inventory.reduce((acc, i) => acc + (i.costPrice * i.currentStock), 0);
  const retailValuation = inventory.reduce((acc, i) => acc + (i.sellingPrice * i.currentStock), 0);
  const completedJobs = workOrders.filter(w => w.status === 'COMPLETED' || w.status === 'READY').length;
  const inProgressJobs = workOrders.filter(w => w.status === 'IN_SERVICE' || w.status === 'INSPECTION').length;

  res.json({
    success: true,
    data: {
      totalRevenue,
      inventoryValuation,
      retailValuation,
      completedJobs,
      inProgressJobs,
      activeVehiclesCount: workOrders.length,
      lowStockItemsCount: inventory.filter(i => i.currentStock <= i.reorderLevel).length,
    },
  });
});

// ------------------------------------------------------------
// OWNER OPERATIONS DASHBOARD (Phase C) — today-at-a-glance.
// Same RBAC family as reports: OWNER + MANAGER + ACCOUNTANT.
// Every number below is derived from real persisted records in a single
// request; no frontend fabrication. "Today" uses the server's timezone
// so the owner's day boundary is authoritative, not the browser's.
// ------------------------------------------------------------
apiRouter.get('/reports/operations', requireAuth('reports'), async (_req: AuthedRequest, res: Response) => {
  const [appointments, workOrders, invoices, inventory, bays] = await Promise.all([
    repo.getAppointments(), repo.getWorkOrders(), repo.getInvoices(), repo.getInventory(), repo.getBays(),
  ]);

  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in server tz

  const todaysAppointments = appointments
    .filter(a => a.scheduledDate === today && a.status !== 'CANCELLED')
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
    .map(a => ({
      reference: a.reference,
      time: a.scheduledTime,
      customerName: a.customerName,
      vehicleRegistration: a.vehicleRegistration,
      serviceNames: a.serviceNames,
      status: a.status,
    }));

  const ACTIVE_FLOW: WorkOrderStatus[] = ['CHECKED_IN', 'INSPECTION', 'ESTIMATE', 'AWAITING_APPROVAL', 'APPROVED', 'IN_SERVICE', 'QUALITY_CHECK'];
  const activeWorkOrders = workOrders
    .filter(w => ACTIVE_FLOW.includes(w.status))
    .sort((a, b) => a.workOrderNumber.localeCompare(b.workOrderNumber))
    .map(w => ({
      workOrderNumber: w.workOrderNumber,
      customerName: w.customerName,
      vehicleRegistration: w.vehicleRegistration,
      status: w.status,
      priority: w.priority,
      assignedBayName: w.assignedBayName ?? null,
      assignedTechnicianName: w.assignedTechnicianName ?? null,
    }));

  const awaitingApproval = workOrders.filter(w => w.status === 'AWAITING_APPROVAL').length;
  const awaitingParts = workOrders.filter(w => w.status === 'ESTIMATE' && w.parts.length === 0).length;

  const completedAwaitingPayment = workOrders
    .filter(w => (w.status === 'COMPLETED' || w.status === 'READY'))
    .map(w => ({ workOrderNumber: w.workOrderNumber, vehicleRegistration: w.vehicleRegistration }));

  // Unpaid invoices: real PaymentStatus values only. Money stays in TZS as
  // persisted (repository layer owns the bigint conversion) — no new math here.
  const unpaidInvoices = invoices
    .filter(i => i.paymentStatus === 'PENDING' || i.paymentStatus === 'PARTIAL')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(i => ({
      invoiceNumber: i.invoiceNumber,
      customerName: i.customerName,
      vehicleRegistration: i.vehicleRegistration,
      total: i.total,
      amountPaid: i.amountPaid,
      balance: i.total - i.amountPaid,
      dueDate: i.dueDate,
    }));
  const unpaidTotal = unpaidInvoices.reduce((acc, i) => acc + i.balance, 0);

  const lowStock = inventory
    .filter(p => p.active && p.currentStock <= p.reorderLevel)
    .sort((a, b) => (a.currentStock - a.reorderLevel) - (b.currentStock - b.reorderLevel))
    .map(p => ({
      sku: p.sku,
      name: p.name,
      currentStock: p.currentStock,
      reorderLevel: p.reorderLevel,
      unit: p.unit,
    }));

  // Bay occupancy is derived from actual assignments on ACTIVE work orders —
  // the persisted isOccupied flag is not maintained by current workflows.
  const activeBayIds = new Set(
    workOrders
      .filter(w => ACTIVE_FLOW.includes(w.status) && w.assignedBayId)
      .map(w => w.assignedBayId as string)
  );
  const baysOccupied = activeBayIds.size;

  res.json({
    success: true,
    data: {
      today,
      todaysAppointments,
      activeWorkOrders,
      awaitingApproval,
      awaitingParts,
      completedAwaitingPayment,
      unpaidInvoices,
      unpaidTotal,
      lowStock,
      bays: { total: bays.length, occupied: baysOccupied },
    },
  });
});
