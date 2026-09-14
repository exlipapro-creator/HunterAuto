import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { db as jsonDb } from '../db.js';
import type {
  ServiceItem, Vehicle, Customer, Appointment, WorkOrder, InspectionReport,
  InventoryItem, InventoryMovement, Invoice, WorkshopBay, WorkshopSettings,
  StaffUser, AuditLog, CashierSession,
} from '../../src/types.js';

/**
 * Repository layer — the ONLY persistence boundary used by the API.
 *
 * Backends:
 *  - Supabase (production): SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set.
 *    Critical operations (POS checkout, booking, stock adjust) run as atomic
 *    database RPCs (see supabase/migrations/..._hunter_core_schema.sql).
 *  - JSON (development fallback): the original HunterDatabase, preserved.
 *
 * SECURITY: this module is server-only. The service-role key bypasses RLS
 * and must never appear in frontend code or VITE_ variables.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let sb: SupabaseClient | null = null;
function client(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  if (!sb) {
    sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return sb;
}

export function repositoryBackend(): 'supabase' | 'json' {
  return client() ? 'supabase' : 'json';
}

// ---------- Row ⇄ domain mapping helpers ----------
type Row = Record<string, any>;

/** Editable product fields accepted by createProduct/updateProduct. */
export interface ProductInput {
  name?: string;
  sku?: string;
  partNumber?: string;
  category?: string;
  costPrice?: number;
  sellingPrice?: number;
  reorderLevel?: number;
  unit?: string;
  binLocation?: string;
  supplierId?: string;
  initialStock?: number;
  active?: boolean;
}

const mapService = (r: Row): ServiceItem => ({
  id: r.legacy_id ?? r.id,
  number: r.number,
  name: r.name,
  description: r.description ?? '',
  category: r.category,
  price: Number(r.price),
  priceType: r.price_type,
  durationMinutes: r.duration_minutes,
  bookingEnabled: r.booking_enabled,
  active: r.active,
  featured: r.featured,
  requiredBayCapability: r.required_bay_capability,
  includes: r.includes ?? [],
});

const mapVehicle = (r: Row): Vehicle => ({
  id: r.legacy_id ?? r.id,
  registrationNumber: r.registration_number,
  make: r.make ?? 'Vehicle',
  model: r.model ?? '',
  year: r.year ?? undefined,
  mileageKm: r.mileage_km ?? undefined,
  vin: r.vin ?? undefined,
  color: r.color ?? undefined,
  customerId: r.customer_id,
  lastServiceDate: r.last_service_date ?? undefined,
});

const mapStaff = (r: Row): StaffUser => ({
  id: r.legacy_id ?? r.id,
  name: r.full_name,
  role: r.role,
  email: r.email ?? '',
  phone: r.phone ?? '',
  active: r.active,
});

const mapBay = (r: Row): WorkshopBay => ({
  id: r.legacy_id ?? r.id,
  name: r.name,
  capability: r.capability,
  isOccupied: false,
});

// Single appointment row mapper (Phase D): shared by the list query and the
// targeted idempotency lookup so both produce the exact same domain shape.
const mapAppointment = (r: Row): Appointment => ({
  id: r.legacy_id ?? r.id,
  reference: r.reference,
  customerId: r.customer_id,
  customerName: r.customers?.full_name ?? '',
  customerPhone: r.customers?.phone ?? '',
  customerWhatsapp: r.customers?.whatsapp ?? undefined,
  vehicleId: r.vehicle_id,
  vehicleRegistration: r.vehicles?.registration_number ?? '',
  vehicleMakeModel: '',
  serviceIds: (r.appointment_services ?? []).map((s: Row) => s.service_id),
  serviceNames: (r.appointment_services ?? []).map((s: Row) => s.services?.name ?? ''),
  scheduledDate: r.scheduled_date,
  scheduledTime: r.scheduled_time.slice(0, 5),
  durationMinutes: r.duration_minutes,
  status: r.status,
  notes: r.notes ?? undefined,
  idempotencyKey: r.idempotency_key ?? undefined,
  createdAt: r.created_at,
});

const mapMovement = (r: Row): InventoryMovement => ({
  id: r.legacy_id ?? r.id,
  inventoryItemId: r.product_id,
  sku: r.inventory_products?.sku ?? '',
  itemName: r.inventory_products?.name ?? '',
  type: r.movement_type,
  quantityChange: r.quantity_change,
  previousStock: r.previous_stock,
  resultingStock: r.resulting_stock,
  reason: r.reason,
  actor: r.staff?.full_name ?? 'System',
  referenceId: r.reference_id ?? undefined,
  timestamp: r.created_at,
});

// ---------- Repository interface (mirrors HunterDatabase) ----------
export interface HunterRepository {
  backend: 'supabase' | 'json';
  getServices(): Promise<ServiceItem[]>;
  getServiceById(id: string): Promise<ServiceItem | undefined>;
  updateService(id: string, updates: Partial<ServiceItem>, actor: string): Promise<ServiceItem | null>;
  getVehicles(): Promise<Vehicle[]>;
  findVehicleByReg(reg: string): Promise<Vehicle | undefined>;
  getCustomers(): Promise<Customer[]>;
  getStaff(): Promise<StaffUser[]>;
  getBays(): Promise<WorkshopBay[]>;
  getAppointments(): Promise<Appointment[]>;
  findAppointmentByIdempotencyKey(key: string): Promise<Appointment | undefined>;
  findAppointmentById(id: string): Promise<Appointment | undefined>;
  createAppointment(data: any): Promise<Appointment>;
  checkAvailability(date: string, duration: number): Promise<{ availableSlots: string[]; bookedCount: number; maxCapacity: number }>;
  getWorkOrders(): Promise<WorkOrder[]>;
  getWorkOrderByNumberOrId(key: string): Promise<WorkOrder | undefined>;
  getWorkOrdersByVehicle(reg: string): Promise<WorkOrder[]>;
  updateWorkOrderStatus(woId: string, status: WorkOrder['status'], actor: string): Promise<WorkOrder | null>;
  assignWorkOrderBayAndTech(woId: string, bayId?: string, technicianId?: string, actor?: string): Promise<WorkOrder | null>;
  getInspectionByWorkOrderId(woId: string): Promise<InspectionReport | undefined>;
  saveInspection(report: InspectionReport, actor: string): Promise<InspectionReport>;
  getInventory(): Promise<InventoryItem[]>;
  getInventoryMovements(): Promise<InventoryMovement[]>;
  adjustInventoryStock(itemId: string, delta: number, reason: string, actor: string, ref?: string): Promise<{ success: boolean; item?: InventoryItem; error?: string }>;
  adjustInventoryStockById(productUuid: string, sku: string, delta: number, reason: string, actor: string, actorId?: string | null, movementType?: 'PURCHASE' | 'ADJUSTMENT' | 'RETURN'): Promise<{ success: boolean; item?: InventoryItem; error?: string }>;
  getSuppliers(): Promise<Array<{ id: string; name: string; contactPerson?: string; phone?: string }>>;
  createProduct(p: ProductInput, actor: string, actorId?: string | null): Promise<{ success: boolean; item?: InventoryItem; error?: string }>;
  updateProduct(id: string, p: ProductInput, actor: string): Promise<{ success: boolean; item?: InventoryItem; error?: string }>;
  setProductActive(id: string, active: boolean, actor: string, actorId?: string | null): Promise<{ success: boolean; item?: InventoryItem; error?: string }>;
  deleteProduct(id: string, actor: string): Promise<{ success: boolean; error?: string }>;
  processPosSale(data: any): Promise<{ success: boolean; sale?: any; receipt?: Invoice; error?: string }>;
  getInvoices(): Promise<Invoice[]>;
  getInvoiceByNumber(num: string): Promise<Invoice | undefined>;
  verifyInvoiceByToken(token: string): Promise<Invoice | undefined>;
  getSettings(): Promise<WorkshopSettings>;
  updateSettings(settings: Partial<WorkshopSettings>, actor: string): Promise<WorkshopSettings>;
  getAuditLogs(): Promise<AuditLog[]>;
  getCashierSessions(): Promise<CashierSession[]>;
  closeCashierSession(sessionId: string, counted: number, notes?: string): Promise<CashierSession | null>;
  logAudit(actor: string, action: string, entity: string, entityId: string, details: string, old?: string, nw?: string): Promise<void>;
}

/**
 * Resolve a domain (legacy) id to its real uuid. Domain ids surfaced to the UI
 * are `legacy_id` values (srv-03, item-04, bay-01...); database RPCs and FK
 * columns take the actual uuid. Every write path resolves through this helper
 * so legacy ids never reach a uuid column.
 */
async function uuidForLegacy(table: string, legacyId: string, column = 'legacy_id'): Promise<string | undefined> {
  if (!legacyId) return undefined;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(legacyId)) return legacyId;
  const { data, error } = await client()!.from(table).select('id').eq(column, legacyId).maybeSingle();
  if (error || !data) return undefined;
  return data.id as string;
}

async function uuidsForLegacyServices(ids: string[]): Promise<string[]> {
  const resolved = await Promise.all(ids.map((id) => uuidForLegacy('services', id)));
  return resolved.filter((x): x is string => Boolean(x));
}

// ---------- JSON fallback (existing domain, unchanged behavior) ----------
const jsonRepo: HunterRepository = {
  backend: 'json',
  getServices: async () => jsonDb.getServices(),
  getServiceById: async (id) => jsonDb.getServiceById(id),
  updateService: async (id, u, a) => jsonDb.updateService(id, u, a),
  getVehicles: async () => jsonDb.getVehicles(),
  findVehicleByReg: async (reg) => jsonDb.findVehicleByReg(reg),
  getCustomers: async () => jsonDb.getCustomers(),
  getStaff: async () => jsonDb.getStaff(),
  getBays: async () => jsonDb.getBays(),
  getAppointments: async () => jsonDb.getAppointments(),
  findAppointmentByIdempotencyKey: async (k) => jsonDb.findAppointmentByIdempotencyKey(k),
  // JSON adapter resolves via the existing list (dev-only path).
  findAppointmentById: async (id) => (await jsonDb.getAppointments()).find((a) => a.id === id),
  createAppointment: async (d) => jsonDb.createAppointment(d),
  async checkAvailability(date: string, duration: number) {
    return jsonDb.checkAvailability(date, duration);
  },
  getWorkOrders: async () => jsonDb.getWorkOrders(),
  getWorkOrderByNumberOrId: async (k) => jsonDb.getWorkOrderByNumberOrId(k),
  getWorkOrdersByVehicle: async (r) => jsonDb.getWorkOrdersByVehicle(r),
  updateWorkOrderStatus: async (id, s, a) => jsonDb.updateWorkOrderStatus(id, s, a),
  assignWorkOrderBayAndTech: async (id, b, t, a) => jsonDb.assignWorkOrderBayAndTech(id, b, t, a),
  getInspectionByWorkOrderId: async (id) => jsonDb.getInspectionByWorkOrderId(id),
  saveInspection: async (r, a) => jsonDb.saveInspection(r, a),
  getInventory: async () => jsonDb.getInventory(),
  getInventoryMovements: async () => jsonDb.getInventoryMovements(),
  adjustInventoryStock: async (id, d, r, a, ref) => jsonDb.adjustInventoryStock(id, d, r, a, ref),
  adjustInventoryStockById: async () => ({ success: false, error: 'Inventory management requires the Supabase backend' }),
  getSuppliers: async () => [],
  createProduct: async () => ({ success: false, error: 'Inventory management requires the Supabase backend' }),
  updateProduct: async () => ({ success: false, error: 'Inventory management requires the Supabase backend' }),
  setProductActive: async () => ({ success: false, error: 'Inventory management requires the Supabase backend' }),
  deleteProduct: async () => ({ success: false, error: 'Inventory management requires the Supabase backend' }),
  processPosSale: async (d) => jsonDb.processPosSale(d),
  getInvoices: async () => jsonDb.getInvoices(),
  getInvoiceByNumber: async (n) => jsonDb.getInvoiceByNumber(n),
  verifyInvoiceByToken: async (t) => jsonDb.verifyInvoiceByToken(t),
  getSettings: async () => jsonDb.getSettings(),
  updateSettings: async (s, a) => jsonDb.updateSettings(s, a),
  getAuditLogs: async () => jsonDb.getAuditLogs(),
  getCashierSessions: async () => jsonDb.getCashierSessions(),
  closeCashierSession: async (id, c, n) => jsonDb.closeCashierSession(id, c, n),
  logAudit: async (a, action, e, id, d, o, n) => jsonDb.logAudit(a, action, e, id, d, o, n),
};

// ---------- Supabase implementation ----------
const SLOT_TIMES = ['08:30', '09:30', '10:30', '11:30', '12:30', '14:00', '15:00', '16:00', '17:00'];

/** Row → domain InventoryItem (same shape as getInventory's mapper). */
function mapProductRow(r: Row): InventoryItem {
  return {
    id: r.legacy_id ?? r.id,
    sku: r.sku,
    partNumber: r.part_number ?? undefined,
    name: r.name,
    category: r.category,
    costPrice: Number(r.cost_price),
    sellingPrice: Number(r.selling_price),
    currentStock: r.current_stock,
    reorderLevel: r.reorder_level,
    unit: r.unit,
    binLocation: r.bin_location ?? undefined,
    supplierId: r.supplier_id ?? undefined,
    supplierName: undefined,
    active: r.active,
  };
}

/** Resolve a product row by legacy id, uuid or SKU → { uuid, row }. Single query. */
async function resolveProductRow(idOrSku: string): Promise<{ product: InventoryItem; productUuid: string; row: Row } | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSku);
  const { data, error } = await client()!
    .from('inventory_products')
    .select('*')
    .or(isUuid
      ? `id.eq.${idOrSku},legacy_id.eq.${idOrSku},sku.eq.${idOrSku}`
      : `legacy_id.eq.${idOrSku},sku.eq.${idOrSku}`)
    .maybeSingle();
  if (error || !data) return null;
  return { product: mapProductRow(data), productUuid: data.id, row: data };
}

const supabaseRepo: HunterRepository = {
  backend: 'supabase',

  async getServices() {
    const { data, error } = await client()!.from('services').select('*').eq('active', true).order('number');
    if (error) throw error;
    return (data ?? []).map(mapService);
  },

  async getServiceById(id) {
    const col = /^srv-\d+$/.test(id) ? 'legacy_id' : id.match(/^\d+$/) ? 'number' : 'legacy_id';
    const { data } = await client()!.from('services').select('*').eq(col, id).maybeSingle();
    return data ? mapService(data) : undefined;
  },

  async updateService(id, updates, actor) {
    const existing = await this.getServiceById(id);
    if (!existing) return null;
    const patch: Row = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.price !== undefined) patch.price = updates.price;
    if (updates.priceType !== undefined) patch.price_type = updates.priceType;
    if (updates.durationMinutes !== undefined) patch.duration_minutes = updates.durationMinutes;
    if (updates.bookingEnabled !== undefined) patch.booking_enabled = updates.bookingEnabled;
    if (updates.active !== undefined) patch.active = updates.active;
    if (updates.featured !== undefined) patch.featured = updates.featured;
    const { data, error } = await client()!.from('services').update(patch).eq('legacy_id', id).select().single();
    if (error) return null;
    await this.logAudit(actor, 'SERVICE_UPDATED', 'ServiceItem', id, `Updated ${existing.name}`, JSON.stringify(existing), JSON.stringify(updates));
    return mapService(data);
  },

  async getVehicles() {
    const { data, error } = await client()!.from('vehicles').select('*').order('created_at');
    if (error) throw error;
    return (data ?? []).map(mapVehicle);
  },

  async findVehicleByReg(reg) {
    const norm = reg.trim().toUpperCase().replace(/\s+/g, ' ');
    const { data } = await client()!.from('vehicles').select('*').eq('reg_normalized', norm).maybeSingle();
    return data ? mapVehicle(data) : undefined;
  },

  async getCustomers() {
    const { data, error } = await client()!.from('customers').select('*').order('created_at');
    if (error) throw error;
    return (data ?? []).map((r: Row) => ({
      id: r.legacy_id ?? r.id,
      name: r.full_name,
      phone: r.phone,
      whatsapp: r.whatsapp ?? undefined,
      email: r.email ?? undefined,
      notes: r.notes ?? undefined,
      createdAt: r.created_at,
    }));
  },

  async getStaff() {
    const { data, error } = await client()!.from('staff').select('*').eq('active', true).order('full_name');
    if (error) throw error;
    return (data ?? []).map(mapStaff);
  },

  async getBays() {
    const { data, error } = await client()!.from('bays').select('*').order('name');
    if (error) throw error;
    return (data ?? []).map(mapBay);
  },

  async getAppointments() {
    const { data, error } = await client()!
      .from('appointments')
      .select('*, customers(full_name, phone, whatsapp), vehicles(registration_number), appointment_services(service_id, services(number, name))')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: Row) => mapAppointment(r));
  },

  async findAppointmentByIdempotencyKey(key) {
    // Targeted unique-key lookup (Phase D): the idempotency pre-check sits on
    // the public booking path, so it must not scan the whole appointments
    // table. idempotency_key is UNIQUE at the DB level — at most one row.
    if (!key) return undefined;
    const { data, error } = await client()!
      .from('appointments')
      .select('*, customers(full_name, phone, whatsapp), vehicles(registration_number), appointment_services(service_id, services(number, name))')
      .eq('idempotency_key', key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return mapAppointment(data as Row);
  },

  async createAppointment(data) {
    // Resolve legacy service ids to real uuids for the RPC
    const uuids = await uuidsForLegacyServices(data.serviceIds);
    if (!uuids.length) throw new Error('NO_VALID_SERVICES');
    const { data: result, error } = await client()!.rpc('hunter_create_appointment', {
      p_customer_name: data.customerName,
      p_phone: data.customerPhone,
      p_registration: data.vehicleRegistration,
      p_service_ids: uuids,
      p_scheduled_date: data.scheduledDate,
      p_scheduled_time: `${data.scheduledTime}:00`,
      p_whatsapp: data.customerWhatsapp ?? null,
      p_make: (data.vehicleMakeModel || 'Vehicle').split(' ')[0] || 'Vehicle',
      p_model: (data.vehicleMakeModel || '').split(' ').slice(1).join(' ') || '',
      p_year: data.vehicleYear ?? null,
      p_mileage: data.vehicleMileage ?? null,
      p_notes: data.notes ?? null,
      p_idempotency_key: data.idempotencyKey ?? null,
    });
    if (error) throw new Error(error.message);
    // Race-honest contract: if another concurrent request with the same
    // idempotency key created the row between the API pre-check and this RPC,
    // the RPC returns {duplicate:true} for the loser. Surface that as a
    // duplicate flag so the API responds 200 replay (not 201 create).
    // Read-back MUST use the RPC's returned appointmentId: bookings without
    // an idempotency key have no key to look up (the previous key-based
    // read-back mis-returned an arbitrary unrelated no-key row), and for
    // replays the RPC returns the ORIGINAL row's id — which is what the API
    // contract needs.
    const appointmentId = (result as Row | null)?.appointmentId as string | undefined;
    if (!appointmentId) throw new Error('Appointment persisted but no id was returned');
    const fresh = await this.findAppointmentById(appointmentId);
    if (!fresh) throw new Error('Appointment persisted but could not be read back');
    return { ...fresh, duplicate: result?.duplicate === true };
  },

  async findAppointmentById(id: string) {
    // Targeted single-row lookup sharing the list mapper (Phase E fix: the
    // create read-back must fetch the exact created row, by id).
    const { data, error } = await client()!
      .from('appointments')
      .select('*, customers(full_name, phone, whatsapp), vehicles(registration_number), appointment_services(service_id, services(number, name))')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return mapAppointment(data as Row);
  },

  async checkAvailability(date, _duration) {
    // Real capacity from persisted bookings; the RPC re-validates atomically on create.
    const { data, error } = await client()!
      .from('appointments')
      .select('scheduled_time')
      .eq('scheduled_date', date)
      .neq('status', 'CANCELLED');
    if (error) throw error;
    const perSlot = new Map<string, number>();
    for (const r of (data ?? []) as Array<{ scheduled_time: string }>) {
      const t = String(r.scheduled_time).slice(0, 5);
      perSlot.set(t, (perSlot.get(t) ?? 0) + 1);
    }
    const availableSlots = SLOT_TIMES.filter((t) => (perSlot.get(t) ?? 0) < 4);
    const bookedCount = (data ?? []).length;
    return { availableSlots, bookedCount, maxCapacity: 4 * SLOT_TIMES.length };
  },

  async getWorkOrders() {
    const { data, error } = await client()!
      .from('work_orders')
      .select(`*,
        customers(full_name, phone, whatsapp),
        vehicles(registration_number, make, model),
        staff(full_name),
        bays(name),
        work_order_services(status, agreed_price, services(number, name)),
        work_order_parts(quantity, unit_price, inventory_products(sku, name))`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: Row): WorkOrder => {
      const services = (r.work_order_services ?? []).map((s: Row) => ({
        serviceId: s.services?.number ?? '',
        serviceName: s.services?.name ?? '',
        price: Number(s.agreed_price),
        status: s.status,
      }));
      const parts = (r.work_order_parts ?? []).map((p: Row) => ({
        sku: p.inventory_products?.sku ?? '',
        name: p.inventory_products?.name ?? '',
        quantity: p.quantity,
        unitPrice: Number(p.unit_price),
        total: Number(p.unit_price) * p.quantity,
      }));
      const labor = Number(r.labor_cost);
      const partsCost = parts.reduce((a, p) => a + p.total, 0);
      return {
        id: r.legacy_id ?? r.id,
        workOrderNumber: r.work_order_number,
        customerId: r.customer_id,
        customerName: r.customers?.full_name ?? '',
        customerPhone: r.customers?.phone ?? '',
        customerWhatsapp: r.customers?.whatsapp ?? undefined,
        vehicleRegistration: r.vehicles?.registration_number ?? '',
        vehicleMakeModel: `${r.vehicles?.make ?? ''} ${r.vehicles?.model ?? ''}`.trim(),
        vehicleMileage: r.vehicle_mileage ?? 0,
        status: r.status,
        assignedTechnicianId: r.assigned_technician ?? undefined,
        assignedTechnicianName: r.staff?.full_name ?? undefined,
        assignedBayId: r.assigned_bay ?? undefined,
        assignedBayName: r.bays?.name ?? undefined,
        services,
        parts,
        priority: r.priority,
        laborCost: labor,
        partsCost,
        totalCost: Number(r.total_cost),
        notes: r.notes ?? '',
        startedAt: r.started_at ?? undefined,
        completedAt: r.completed_at ?? undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  },

  async getWorkOrderByNumberOrId(key) {
    const all = await this.getWorkOrders();
    const clean = key.trim().toUpperCase();
    return all.find((w) => w.workOrderNumber.toUpperCase() === clean || w.id === key);
  },

  async getWorkOrdersByVehicle(reg) {
    const all = await this.getWorkOrders();
    const clean = reg.trim().toUpperCase().replace(/\s+/g, ' ');
    return all.filter((w) => w.vehicleRegistration.toUpperCase().replace(/\s+/g, ' ') === clean);
  },

  async updateWorkOrderStatus(woId, status, actor) {
    const existing = await this.getWorkOrderByNumberOrId(woId);
    if (!existing) return null;
    const patch: Row = { status };
    if (status === 'IN_SERVICE' && !existing.startedAt) patch.started_at = new Date().toISOString();
    if (status === 'READY' || status === 'COMPLETED') patch.completed_at = new Date().toISOString();
    const { data, error } = await client()!.from('work_orders').update(patch).eq('work_order_number', existing.workOrderNumber).select().single();
    if (error) return null;
    await this.logAudit(actor, 'WORK_ORDER_STATUS_CHANGED', 'WorkOrder', existing.workOrderNumber, `Transitioned from ${existing.status} to ${status}`);
    return { ...existing, status: data.status, startedAt: data.started_at ?? undefined, completedAt: data.completed_at ?? undefined };
  },

  async assignWorkOrderBayAndTech(woId, bayId, technicianId, actor = 'Staff') {
    const existing = await this.getWorkOrderByNumberOrId(woId);
    if (!existing) return null;
    const patch: Row = {};
    if (bayId) patch.assigned_bay = await uuidForLegacy('bays', bayId);
    if (technicianId) patch.assigned_technician = await uuidForLegacy('staff', technicianId);
    const { error } = await client()!.from('work_orders').update(patch).eq('work_order_number', existing.workOrderNumber);
    if (error) return null;
    await this.logAudit(actor, 'WORK_ORDER_ASSIGNED', 'WorkOrder', existing.workOrderNumber, `Bay: ${bayId ?? '-'}, Tech: ${technicianId ?? '-'}`);
    return this.getWorkOrderByNumberOrId(woId) as Promise<WorkOrder | null>;
  },

  async getInspectionByWorkOrderId(woId) {
    // woId may be a work order number, legacy id or uuid — resolve first.
    const wo = await this.getWorkOrderByNumberOrId(woId);
    const woUuid = wo
      ? await uuidForLegacy('work_orders', wo.id)
      : (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(woId) ? woId : undefined);
    if (!woUuid) return undefined;
    const { data, error } = await client()!
      .from('inspections')
      .select('*')
      .eq('work_order_id', woUuid)
      .maybeSingle();
    if (error || !data) return undefined;
    const items = await client()!
      .from('inspection_items')
      .select('*')
      .eq('inspection_id', data.id)
      .order('display_order');
    return {
      id: data.legacy_id ?? data.id,
      workOrderId: wo?.id ?? woId,
      vehicleRegistration: wo?.vehicleRegistration ?? '',
      technicianName: wo?.assignedTechnicianName,
      createdAt: data.created_at,
      inspectedAt: data.updated_at,
      items: ((items.data ?? []) as Row[]).map((i) => ({
        id: i.legacy_id ?? i.id,
        name: i.name,
        category: i.category ?? undefined,
        status: i.status,
        measurement: i.measurement ?? undefined,
        note: i.note ?? undefined,
        photoUrl: i.photo_url ?? undefined,
      })),
      overallSummary: data.overall_summary ?? undefined,
      overallCondition: data.overall_condition ?? undefined,
      recommendations: data.recommendations ?? [],
    };
  },

  async saveInspection(report, actor) {
    const { data, error } = await client()!.rpc('hunter_save_inspection', { p_report: report as unknown as Row });
    if (error) throw new Error(error.message);
    // Audit against the durable key (work order number) rather than the caller's label.
    const wo = await this.getWorkOrderByNumberOrId(report.workOrderId);
    await this.logAudit(actor, 'INSPECTION_SAVED', 'WorkOrder', wo?.workOrderNumber ?? report.id, `Inspection saved for ${report.vehicleRegistration}`);
    return report;
  },

  async getInventory() {
    const { data, error } = await client()!.from('inventory_products').select('*').order('sku');
    if (error) throw error;
    return (data ?? []).map((r: Row): InventoryItem => ({
      id: r.legacy_id ?? r.id,
      sku: r.sku,
      partNumber: r.part_number ?? undefined,
      name: r.name,
      category: r.category,
      costPrice: Number(r.cost_price),
      sellingPrice: Number(r.selling_price),
      currentStock: r.current_stock,
      reorderLevel: r.reorder_level,
      unit: r.unit,
      binLocation: r.bin_location ?? undefined,
      supplierId: r.supplier_id ?? undefined,
      supplierName: undefined,
      active: r.active,
    }));
  },

  async getInventoryMovements() {
    const { data, error } = await client()!
      .from('inventory_movements')
      .select('*, inventory_products(sku, name), staff(full_name)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []).map(mapMovement);
  },

  async getSuppliers() {
    const { data, error } = await client()!.from('suppliers').select('id, name, contact_person, phone').order('name');
    if (error) throw error;
    return (data ?? []).map((s: Row) => ({ id: s.id, name: s.name, contactPerson: s.contact_person ?? undefined, phone: s.phone ?? undefined }));
  },

  async createProduct(p, actor, actorId) {
    // SKU uniqueness is enforced by a DB unique constraint; surface it as a
    // structured error rather than a raw 500.
    const { data, error } = await client()!
      .from('inventory_products')
      .insert({
        sku: p.sku,
        part_number: p.partNumber || null,
        name: p.name,
        category: p.category,
        cost_price: p.costPrice,
        selling_price: p.sellingPrice,
        current_stock: 0,
        reorder_level: p.reorderLevel,
        unit: p.unit || 'Piece',
        bin_location: p.binLocation || null,
        supplier_id: p.supplierId || null,
        active: true,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505' || /duplicate key|unique/i.test(error.message)) {
        return { success: false, error: `SKU "${p.sku}" already exists` };
      }
      return { success: false, error: 'Could not create the product' };
    }
    const opening = p.initialStock ?? 0;
    if (opening > 0) {
      // Journaled via hunter_adjust_stock — never a silent stock write.
      const stock = await this.adjustInventoryStockById(data.id, data.sku, opening, `Opening stock: ${p.name}`, actor, actorId, 'PURCHASE');
      if (!stock.success) return { success: false, error: stock.error };
    }
    await this.logAudit(actor, 'PRODUCT_CREATED', 'InventoryItem', p.sku, `${p.name} (${p.category}), opening stock ${opening}`);
    return { success: true, item: mapProductRow(data) };
  },

  /** Journaled stock change addressing the product by uuid or id/SKU (POSTGRES-side actor attribution). */
  async adjustInventoryStockById(productUuid: string, sku: string, delta: number, reason: string, actor: string, actorId?: string | null, movementType: 'PURCHASE' | 'ADJUSTMENT' | 'RETURN' = 'ADJUSTMENT') {
    // The API may address the product by uuid, legacy id or SKU with sku='';
    // resolve to the canonical uuid + sku before touching the database.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productUuid) || !sku) {
      const found = await resolveProductRow(productUuid);
      if (!found) return { success: false as const, error: 'Product not found' };
      productUuid = found.productUuid;
      sku = found.product.sku;
    }
    if (movementType === 'ADJUSTMENT') {
      // Existing proven path (row-lock, refuses negative, journals ADJUSTMENT).
      const { error } = await client()!.rpc('hunter_adjust_stock', {
        p_product_id: productUuid,
        p_delta: delta,
        p_reason: reason,
        p_actor_id: actorId ?? null,
      });
      if (error) {
        const msg = error.message;
        if (msg.includes('INSUFFICIENT_STOCK')) {
          const avail = msg.split(':')[2] ?? '?';
          return { success: false as const, error: `Insufficient stock. Available: ${avail}, Requested: ${Math.abs(delta)}` };
        }
        return { success: false as const, error: 'Stock adjustment failed' };
      }
    } else {
      // PURCHASE / RETURN: prefer the dedicated journaled RPC (migration
      // 20260914100000). If it is not applied yet, fall back to the proven
      // hunter_adjust_stock — the movement is still journaled atomically with
      // the full reason; only the stored movement_type reads ADJUSTMENT.
      const { error } = await client()!.rpc('hunter_apply_stock', {
        p_product_id: productUuid,
        p_delta: delta,
        p_movement_type: movementType,
        p_reason: reason,
        p_actor_id: actorId ?? null,
      });
      if (error) {
        const unavailable = /42883|does not exist|schema cache/i.test(error.message);
        if (!unavailable) {
          const msg = error.message;
          if (msg.includes('INSUFFICIENT_STOCK')) {
            const avail = msg.split(':')[2] ?? '?';
            return { success: false as const, error: `Insufficient stock. Available: ${avail}, Requested: ${Math.abs(delta)}` };
          }
          return { success: false as const, error: 'Stock operation failed' };
        }
        const { error: fallbackError } = await client()!.rpc('hunter_adjust_stock', {
          p_product_id: productUuid,
          p_delta: delta,
          p_reason: reason,
          p_actor_id: actorId ?? null,
        });
        if (fallbackError) {
          const msg = fallbackError.message;
          if (msg.includes('INSUFFICIENT_STOCK')) {
            const avail = msg.split(':')[2] ?? '?';
            return { success: false as const, error: `Insufficient stock. Available: ${avail}, Requested: ${Math.abs(delta)}` };
          }
          return { success: false as const, error: 'Stock operation failed' };
        }
      }
    }
    const updated = await this.getInventory();
    return { success: true as const, item: updated.find((p) => p.sku === sku) };
  },

  async updateProduct(id, p, actor) {
    const found = await resolveProductRow(id);
    if (!found) return { success: false, error: 'Product not found' };
    const { product, productUuid } = found;
    const { data: before, error } = await client()!.from('inventory_products').select('*').eq('id', productUuid).single();
    if (error || !before) return { success: false, error: 'Product not found' };
    const patch: Row = {};
    if (p.name !== undefined) patch.name = p.name;
    if (p.sku !== undefined && p.sku !== product.sku) patch.sku = p.sku;
    if (p.partNumber !== undefined) patch.part_number = p.partNumber || null;
    if (p.category !== undefined) patch.category = p.category;
    if (p.costPrice !== undefined) patch.cost_price = p.costPrice;
    if (p.sellingPrice !== undefined) patch.selling_price = p.sellingPrice;
    if (p.reorderLevel !== undefined) patch.reorder_level = p.reorderLevel;
    if (p.unit !== undefined) patch.unit = p.unit;
    if (p.binLocation !== undefined) patch.bin_location = p.binLocation || null;
    if (p.supplierId !== undefined) patch.supplier_id = p.supplierId || null;
    if (p.active !== undefined) patch.active = p.active;
    if (Object.keys(patch).length === 0) return { success: true, item: product };
    const { data: after, error: updError } = await client()!
      .from('inventory_products')
      .update(patch)
      .eq('id', productUuid)
      .select()
      .single();
    if (updError) {
      if (updError.code === '23505' || /duplicate key|unique/i.test(updError.message)) {
        return { success: false, error: `SKU "${p.sku}" already exists` };
      }
      return { success: false, error: 'Could not update the product' };
    }
    // Current stock is NOT editable here — quantity changes must be journaled.
    await this.logAudit(actor, 'PRODUCT_UPDATED', 'InventoryItem', after.sku,
      `Updated ${Object.keys(patch).join(', ')}`,
      JSON.stringify({ name: before.name, sku: before.sku, cost_price: before.cost_price, selling_price: before.selling_price, reorder_level: before.reorder_level, active: before.active }),
      JSON.stringify({ name: after.name, sku: after.sku, cost_price: after.cost_price, selling_price: after.selling_price, reorder_level: after.reorder_level, active: after.active }));
    return { success: true, item: mapProductRow(after) };
  },

  async setProductActive(id, active, actor, actorId) {
    const found = await resolveProductRow(id);
    if (!found) return { success: false, error: 'Product not found' };
    const { product, productUuid } = found;
    const { data: after, error } = await client()!
      .from('inventory_products')
      .update({ active })
      .eq('id', productUuid)
      .select()
      .single();
    if (error) return { success: false, error: 'Could not change product status' };
    await this.logAudit(actor, active ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED', 'InventoryItem', product.sku, `${product.name} → ${active ? 'ACTIVE' : 'INACTIVE'}`);
    return { success: true, item: mapProductRow(after) };
  },

  async deleteProduct(id, actor) {
    const found = await resolveProductRow(id);
    if (!found) return { success: false, error: 'Product not found' };
    const { product, productUuid } = found;
    // History protection is database-enforced: inventory_movements,
    // work_order_parts and pos_sale_items all reference products with
    // ON DELETE RESTRICT, so a product with any history cannot be deleted —
    // the FK rejects the delete and we return the archival guidance.
    const { error } = await client()!.from('inventory_products').delete().eq('id', productUuid);
    if (error) {
      if (error.code === '23503' || /foreign key|violates/i.test(error.message)) {
        return { success: false, error: `${product.name} has stock movements or workshop/POS history and cannot be deleted. Deactivate it instead to preserve history.` };
      }
      return { success: false, error: 'Could not delete the product' };
    }
    await this.logAudit(actor, 'PRODUCT_DELETED', 'InventoryItem', product.sku, `${product.name} permanently deleted (no history existed)`);
    return { success: true };
  },

  async adjustInventoryStock(itemId, delta, reason, actor, ref) {
    const products = await this.getInventory();
    const product = products.find((p) => p.id === itemId || p.sku === itemId);
    if (!product) return { success: false, error: 'Item not found' };
    const productUuid = await uuidForLegacy('inventory_products', product.id);
    if (!productUuid) return { success: false, error: 'Item not found' };
    const { data, error } = await client()!.rpc('hunter_adjust_stock', {
      p_product_id: productUuid,
      p_delta: delta,
      p_reason: reason,
      p_actor_id: null,
    });
    if (error) {
      const msg = error.message;
      if (msg.includes('INSUFFICIENT_STOCK')) {
        const avail = msg.split(':')[2] ?? '?';
        return { success: false, error: `Insufficient stock for ${product.name}. Available: ${avail}, Requested: ${Math.abs(delta)}` };
      }
      return { success: false, error: 'Stock adjustment failed' };
    }
    await this.logAudit(actor, 'STOCK_MUTATION', 'InventoryItem', product.sku, `${reason}: ${delta > 0 ? '+' : ''}${delta}`);
    const updated = await this.getInventory();
    return { success: true, item: updated.find((p) => p.id === product.id) };
  },

  // NOTE: legacy_id/uuid distinction handled by resolveProduct(); legacy-tagged
  // products keep their JSON-era ids, new products use uuids directly.

  async processPosSale(data) {
    // Resolve cashier uuid from label handled by API layer (passes staff uuid when known)
    const staffList = await this.getStaff();
    const cashier = staffList.find((s) => data.cashierName.includes(s.name));

    const items: Array<{ id?: string; type: string; quantity: number }> = [];
    for (const it of (data.items ?? []) as Array<Row>) {
      let uuid: string | undefined;
      if (it.type === 'SERVICE') {
        uuid = await uuidForLegacy('services', String(it.id));
      } else {
        uuid = await uuidForLegacy('inventory_products', String(it.id));
        if (!uuid) {
          // POS may address products by SKU
          const { data: bySku } = await client()!.from('inventory_products').select('id').eq('sku', String(it.id)).maybeSingle();
          uuid = bySku?.id as string | undefined;
        }
      }
      if (uuid) items.push({ id: uuid, type: it.type, quantity: it.quantity });
    }

    const cashierUuid = cashier ? await uuidForLegacy('staff', cashier.id) : undefined;
    const { data: result, error } = await client()!.rpc('hunter_pos_checkout', {
      p_items: items,
      p_payment_method: data.paymentMethod,
      p_amount_tendered: Math.round(data.amountTendered),
      p_cashier_id: cashierUuid ?? null,
      p_customer_id: null,
      p_vehicle_reg: data.vehicleRegistration ?? null,
      p_discount: Math.round(data.discount ?? 0),
    });
    if (error) {
      const msg = error.message;
      if (msg.includes('INSUFFICIENT_STOCK')) {
        const [, sku, avail] = msg.split(':');
        const { data: p } = await client()!.from('inventory_products').select('name').eq('sku', sku).maybeSingle();
        return { success: false, error: `Insufficient stock for ${p?.name ?? sku}. In stock: ${avail}` };
      }
      if (msg.includes('UNDERPAYMENT')) {
        const [, tendered, total] = msg.split(':');
        return { success: false, error: `Amount tendered (${tendered} TZS) is less than total (${total} TZS)` };
      }
      if (msg.includes('CART_EMPTY')) return { success: false, error: 'Cart is empty' };
      if (msg.includes('NOT_FOUND')) return { success: false, error: 'One or more items could not be found' };
      return { success: false, error: 'Sale could not be completed' };
    }

    // Read back the persisted sale + invoice for the receipt
    const invoice = await this.getInvoiceByNumber(result.invoiceNumber);
    const sale = {
      id: result.saleId,
      saleNumber: result.saleNumber,
      cashierName: data.cashierName,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      vehicleRegistration: data.vehicleRegistration?.toUpperCase(),
      items: data.items,
      subtotal: invoice?.subtotal ?? 0,
      discount: data.discount ?? 0,
      total: result.total,
      paymentMethod: data.paymentMethod,
      amountTendered: data.amountTendered,
      change: result.change,
      timestamp: new Date().toISOString(),
    };
    return { success: true, sale, receipt: invoice };
  },

  async getInvoices() {
    const { data, error } = await client()!
      .from('invoices')
      .select('*, invoice_items(*), customers(full_name, phone), vehicles(registration_number, make, model)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []).map((r: Row): Invoice => ({
      id: r.legacy_id ?? r.id,
      invoiceNumber: r.invoice_number,
      customerId: r.customer_id ?? 'walkin',
      customerName: r.customers?.full_name ?? 'Walk-in Customer',
      customerPhone: r.customers?.phone ?? 'N/A',
      vehicleRegistration: r.vehicles?.registration_number ?? 'WALK-IN',
      vehicleMakeModel: r.vehicles ? `${r.vehicles.make} ${r.vehicles.model}`.trim() : 'Counter Sale',
      items: (r.invoice_items ?? []).map((i: Row) => ({
        description: i.description,
        type: i.item_type,
        quantity: i.quantity,
        unitPrice: Number(i.unit_price),
        total: Number(i.line_total),
      })),
      subtotal: Number(r.subtotal),
      discount: Number(r.discount),
      tax: Number(r.tax),
      total: Number(r.total),
      amountPaid: Number(r.amount_paid),
      paymentStatus: r.payment_status,
      verificationHash: r.public_token,
      dueDate: r.due_date ?? '',
      createdAt: r.created_at,
      paidAt: r.payment_status === 'PAID' ? r.updated_at : undefined,
    }));
  },

  async getInvoiceByNumber(num) {
    const all = await this.getInvoices();
    const clean = num.trim().toUpperCase();
    return all.find((i) => i.invoiceNumber.toUpperCase() === clean || i.id === num);
  },

  async verifyInvoiceByToken(token) {
    const { data } = await client()!.from('invoices').select('invoice_number').eq('public_token', token).maybeSingle();
    return data ? this.getInvoiceByNumber(data.invoice_number) : undefined;
  },

  async getSettings() {
    const { data } = await client()!.from('business_settings').select('*').eq('id', 1).maybeSingle();
    if (!data) return jsonDb.getSettings(); // seed not yet applied
    return {
      businessName: data.business_name,
      tagline: data.tagline,
      address: data.address,
      block: data.block,
      city: data.city,
      phones: data.phones ?? [],
      whatsappNumbers: data.whatsapp_numbers ?? [],
      instagram: data.instagram,
      operatingHours: data.operating_hours ?? {},
      enableOnlineBooking: data.enable_online_booking,
      taxRatePercent: Number(data.tax_rate_percent),
      currency: data.currency,
    } as WorkshopSettings;
  },

  async updateSettings(settings, actor) {
    const patch: Row = {};
    const keyMap: Record<string, string> = {
      businessName: 'business_name', tagline: 'tagline', address: 'address', block: 'block',
      city: 'city', phones: 'phones', whatsappNumbers: 'whatsapp_numbers', instagram: 'instagram',
      operatingHours: 'operating_hours', enableOnlineBooking: 'enable_online_booking',
      taxRatePercent: 'tax_rate_percent', currency: 'currency',
    };
    for (const [k, v] of Object.entries(settings)) {
      if (keyMap[k]) patch[keyMap[k]] = v;
    }
    await client()!.from('business_settings').update(patch).eq('id', 1);
    await this.logAudit(actor, 'SETTINGS_UPDATED', 'Settings', 'global', 'Workshop settings updated');
    return this.getSettings();
  },

  async getAuditLogs() {
    const { data, error } = await client()!
      .from('audit_logs')
      .select('*, staff(full_name, role)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []).map((r: Row): AuditLog => ({
      id: String(r.id),
      actor: r.staff?.full_name ?? r.actor_label,
      actorName: r.staff?.full_name ?? r.actor_label,
      actorRole: r.actor_role ?? r.staff?.role ?? undefined,
      action: r.action,
      entity: r.entity_type,
      entityType: r.entity_type,
      entityId: r.entity_id,
      details: r.details ?? '',
      oldValue: r.old_value ? JSON.stringify(r.old_value) : undefined,
      newValue: r.new_value ? JSON.stringify(r.new_value) : undefined,
      timestamp: r.created_at,
    }));
  },

  async getCashierSessions() {
    const { data, error } = await client()!
      .from('cashier_sessions')
      .select('*, staff(full_name)')
      .order('opened_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: Row): CashierSession => ({
      id: r.id,
      cashierName: r.staff?.full_name ?? 'Cashier',
      openingFloat: Number(r.opening_float),
      openedAt: r.opened_at,
      closedAt: r.closed_at ?? undefined,
      status: r.status,
      cashSalesTotal: Number(r.cash_total),
      mobileMoneyTotal: Number(r.mobile_money_total),
      cardTotal: Number(r.card_total),
      bankTotal: Number(r.bank_total),
      totalSales: Number(r.total_sales),
      expectedCash: Number(r.expected_cash),
      countedCash: r.counted_cash != null ? Number(r.counted_cash) : undefined,
      variance: r.variance != null ? Number(r.variance) : undefined,
      notes: r.notes ?? undefined,
    }));
  },

  async closeCashierSession(sessionId, counted, notes) {
    // Compute variance server-side for parity with the JSON store: variance = counted - expected.
    const { data: session } = await client()!.from('cashier_sessions').select('expected_cash').eq('id', sessionId).eq('status', 'OPEN').maybeSingle();
    if (!session) return null;
    const variance = counted - Number(session.expected_cash);
    const { data, error } = await client()!
      .from('cashier_sessions')
      .update({ status: 'CLOSED', closed_at: new Date().toISOString(), counted_cash: counted, variance, notes: notes ?? null })
      .eq('id', sessionId)
      .eq('status', 'OPEN')
      .select()
      .single();
    if (error || !data) return null;
    return (await this.getCashierSessions()).find((s) => s.id === sessionId) ?? null;
  },

  async logAudit(actor, action, entity, entityId, details, oldValue, newValue) {
    const staffList = await this.getStaff().catch(() => []);
    const match = staffList.find((s) => actor.includes(s.name));
    await client()!.rpc('hunter_log_audit', {
      p_actor_id: match ? await uuidForLegacy('staff', match.id) : null,
      p_actor_label: actor,
      p_actor_role: (match?.role ?? null) as any,
      p_action: action,
      p_entity_type: entity,
      p_entity_id: entityId,
      p_details: details,
      p_old: oldValue ? JSON.parse(oldValue) : null,
      p_new: newValue ? JSON.parse(newValue) : null,
    });
  },
};

/** Active repository: Supabase when configured, otherwise the JSON domain store. */
export const repo: HunterRepository = client() ? supabaseRepo : jsonRepo;
