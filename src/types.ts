// Hunter Autoworks — The Car Lab Domain Types

export type UserRole = 
  | 'OWNER' 
  | 'MANAGER' 
  | 'SERVICE_ADVISOR' 
  | 'TECHNICIAN' 
  | 'CASHIER' 
  | 'INVENTORY_MANAGER' 
  | 'ACCOUNTANT';

export type StaffRole = UserRole;

export interface StaffUser {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  phone: string;
  active: boolean;
}

export type StaffMember = StaffUser;

export type InspectionStatus = 'GOOD' | 'ATTENTION' | 'CRITICAL' | 'NOT_CHECKED';
export type InspectionCondition = InspectionStatus;

export interface InspectionItem {
  id?: string;
  name: string;
  category?: string;
  status?: InspectionStatus;
  condition?: InspectionCondition;
  notes?: string;
  note?: string;
  measurement?: string;
  photoUrl?: string;
}

export type InspectionSectionItem = InspectionItem;

export interface DesignPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  accentColor?: string;
  canvasType?: string;
  [key: string]: any;
}

export type ServiceCategory = 
  | 'DETAILING_WASH'
  | 'MECHANICAL_MAINTENANCE'
  | 'BODY_RESTORATION'
  | 'DIAGNOSTICS_ELECTRICAL'
  | 'TYRES_ALIGNMENT'
  | 'SPECIALITY_SERVICES';

export interface ServiceItem {
  id: string;
  number: string; // e.g. "01", "02", ... "20"
  name: string;
  description: string;
  category: ServiceCategory;
  price: number; // in TZS (0 if quote required)
  priceType: 'FIXED' | 'STARTING_FROM' | 'QUOTE_REQUIRED';
  durationMinutes: number; // e.g. 60
  bookingEnabled: boolean;
  active: boolean;
  featured: boolean;
  requiredBayCapability: 'MECHANICAL' | 'ALIGNMENT' | 'DETAILING' | 'BODYWORK' | 'ELECTRICAL';
  includes: string[];
}

export interface Vehicle {
  id: string;
  registrationNumber: string; // e.g. "T 123 ABC"
  make: string; // e.g. "Toyota"
  model: string; // e.g. "RAV4"
  year?: number; // customer-provided; not fabricated when unknown
  mileageKm?: number; // customer-provided; not fabricated when unknown
  vin?: string;
  color?: string;
  customerId: string;
  lastServiceDate?: string;
  nextServiceKm?: number;
  nextServiceDate?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  notes?: string;
  createdAt: string;
}

export type AppointmentStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED' | 'NO_SHOW' | 'COMPLETED';

export interface Appointment {
  id: string;
  reference: string; // e.g. "HA-APT-1002"
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerWhatsapp?: string;
  vehicleId?: string;
  vehicleRegistration: string;
  vehicleMakeModel: string;
  serviceIds: string[];
  serviceNames: string[];
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  durationMinutes: number;
  status: AppointmentStatus;
  notes?: string;
  idempotencyKey?: string;
  createdAt: string;
}

export type WorkOrderStatus = 
  | 'BOOKED'
  | 'CHECKED_IN'
  | 'INSPECTION'
  | 'ESTIMATE'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'IN_SERVICE'
  | 'QUALITY_CHECK'
  | 'READY'
  | 'COMPLETED';

export interface WorkOrderServiceItem {
  serviceId: string;
  serviceName: string;
  price: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE';
}

export interface WorkOrderPartItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface WorkOrder {
  id: string;
  workOrderNumber: string; // e.g. "HA-WO-000184"
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerWhatsapp?: string;
  vehicleRegistration: string;
  vehicleMakeModel: string;
  vehicleMileage: number;
  status: WorkOrderStatus;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  assignedBayId?: string;
  assignedBayName?: string;
  services: WorkOrderServiceItem[];
  parts: WorkOrderPartItem[];
  inspectionId?: string;
  estimateId?: string;
  invoiceId?: string;
  invoiceNumber?: string; // set when the work order has been invoiced
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  laborCost: number;
  partsCost: number;
  totalCost: number;
  notes: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionReport {
  id: string;
  workOrderId: string;
  vehicleRegistration: string;
  technicianName?: string;
  inspectorName?: string;
  createdAt: string;
  inspectedAt?: string;
  items: InspectionItem[];
  overallSummary?: string;
  overallCondition?: 'GOOD' | 'ATTENTION' | 'CRITICAL';
  recommendations?: string[];
}

/** Internal staff context attached to work orders (never exposed publicly). */
export interface WorkOrderStaffContext {
  leadTechnicianId?: string;
  leadTechnicianName?: string;
  invoiceNumber?: string;
}

export type WorkOrderWithStaffContext = WorkOrder & WorkOrderStaffContext;

export interface EstimateLineItem {
  id: string;
  description: string;
  type: 'SERVICE' | 'PART' | 'LABOUR';
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Estimate {
  id: string;
  workOrderId: string;
  estimateNumber: string; // e.g. "EST-2026-084"
  items: EstimateLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED';
  approvedByCustomerAt?: string;
  createdAt: string;
}

export interface WorkshopBay {
  id: string;
  name: string; // e.g. "Bay 01 - Mechanical"
  capability: 'MECHANICAL' | 'ALIGNMENT' | 'DETAILING' | 'BODYWORK' | 'ELECTRICAL';
  isOccupied: boolean;
  currentWorkOrderNumber?: string;
  currentVehicleRegistration?: string;
}

export interface InventoryItem {
  id: string;
  sku: string; // e.g. "OIL-5W40-FS"
  partNumber?: string; // manufacturer part number when known
  name: string;
  category: 'OILS_FLUIDS' | 'FILTERS' | 'BRAKES' | 'SUSPENSION' | 'TYRES' | 'ELECTRICAL' | 'ACCESSORIES' | 'CAR_CARE';
  costPrice: number; // in TZS
  sellingPrice: number; // in TZS
  currentStock: number;
  reorderLevel: number;
  unit: string; // e.g. "Litre", "Piece", "Set"
  binLocation?: string; // storage location in the workshop
  supplierId?: string;
  supplierName?: string;
  active: boolean;
}

export type StockMovementType = 'PURCHASE' | 'POS_SALE' | 'WORK_ORDER' | 'RETURN' | 'ADJUSTMENT';

export interface InventoryMovement {
  id: string;
  inventoryItemId: string;
  sku: string;
  itemName: string;
  type: StockMovementType;
  quantityChange: number; // e.g. -2 or +10
  previousStock: number;
  resultingStock: number;
  reason: string;
  actor: string;
  referenceId?: string; // Work order or POS sale ID
  timestamp: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string; // e.g. "PO-2026-0042"
  supplierId: string;
  supplierName: string;
  items: { sku: string; name: string; quantity: number; costPrice: number; total: number }[];
  totalCost: number;
  status: 'DRAFT' | 'ISSUED' | 'RECEIVED' | 'CANCELLED';
  receivedAt?: string;
  createdAt: string;
}

export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'REFUNDED' | 'VOID';
export type PaymentMethod = 'CASH' | 'M_PESA' | 'TIGO_PESA' | 'AIRTEL_MONEY' | 'CARD' | 'BANK_TRANSFER';

export interface InvoiceItem {
  description: string;
  type: 'SERVICE' | 'PART' | 'LABOUR';
  quantity: number;
  unitPrice: number;
  total: number;
  totalPrice?: number; // display alias used by invoice documents
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. "HA-2026-000184"
  workOrderId?: string;
  workOrderNumber?: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vehicleRegistration: string;
  vehicleMakeModel: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  verificationHash: string;
  dueDate: string;
  createdAt: string;
  paidAt?: string;
}

export interface PosCartItem {
  id: string; // sku or serviceId
  type: 'SERVICE' | 'PRODUCT';
  name: string;
  unitPrice: number;
  quantity: number;
  total?: number; // convenience: unitPrice * quantity
  totalPrice?: number; // display alias used on receipts
  stockAvailable?: number;
}

export interface PosSale {
  id: string;
  saleNumber: string; // e.g. "POS-2026-081"
  receiptNumber?: string; // display alias of saleNumber
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  vehicleRegistration?: string;
  items: PosCartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountTendered: number;
  change: number;
  timestamp: string;
  createdAt?: string; // alias of timestamp used by receipts
}

export interface CashierSession {
  id: string;
  cashierName: string;
  openingFloat: number;
  openedAt: string;
  closedAt?: string;
  status: 'OPEN' | 'CLOSED';
  cashSalesTotal: number;
  mobileMoneyTotal: number;
  cardTotal: number;
  bankTotal: number;
  totalSales: number;
  expectedCash: number;
  countedCash?: number;
  variance?: number;
  notes?: string;
}

export interface Expense {
  id: string;
  category: 'WORKSHOP_SUPPLIES' | 'UTILITIES' | 'SALARIES' | 'EQUIPMENT_MAINTENANCE' | 'MARKETING' | 'OTHER';
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  actor: string;
  date: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actor: string; // legacy label; prefer actorName/actorRole when present
  actorName?: string;
  actorRole?: string;
  action: string; // e.g. "PRICE_CHANGED", "STOCK_ADJUSTED", "INVOICE_VOIDED"
  entity: string; // e.g. "ServiceItem", "InventoryItem", "Invoice"
  entityType?: string; // alias of entity used by UI
  entityId: string;
  details: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}

export interface WorkshopSettings {
  businessName: string;
  tagline: string;
  address: string;
  block: string;
  city: string;
  phones: string[];
  whatsappNumbers: string[];
  instagram: string;
  operatingHours: {
    weekdays: string;
    saturday: string;
    sunday: string;
  };
  enableOnlineBooking: boolean;
  taxRatePercent: number; // 0 or configured
  currency: string;
}
