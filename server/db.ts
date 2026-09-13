import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  ServiceItem,
  Vehicle,
  Customer,
  Appointment,
  WorkOrder,
  InspectionReport,
  Estimate,
  WorkshopBay,
  InventoryItem,
  InventoryMovement,
  Supplier,
  PurchaseOrder,
  Invoice,
  PosSale,
  CashierSession,
  Expense,
  AuditLog,
  WorkshopSettings,
  StaffUser,
} from '../src/types.js';

interface DatabaseSchema {
  services: ServiceItem[];
  vehicles: Vehicle[];
  customers: Customer[];
  appointments: Appointment[];
  workOrders: WorkOrder[];
  inspections: InspectionReport[];
  estimates: Estimate[];
  bays: WorkshopBay[];
  inventory: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  invoices: Invoice[];
  posSales: PosSale[];
  cashierSessions: CashierSession[];
  expenses: Expense[];
  auditLogs: AuditLog[];
  settings: WorkshopSettings;
  staff: StaffUser[];
}

const DB_FILE = path.join(process.cwd(), 'data', 'hunter_db.json');

// Canonical 20 Flyer Services
const INITIAL_SERVICES: ServiceItem[] = [
  {
    id: 'srv-01',
    number: '01',
    name: 'Royal Car Wash',
    description: 'Deep exterior foam decontamination, undercarriage high-pressure flush, hand rim detailing, and pH-neutral hydrophobic rinse.',
    category: 'DETAILING_WASH',
    price: 30000,
    priceType: 'STARTING_FROM',
    durationMinutes: 45,
    bookingEnabled: true,
    active: true,
    featured: true,
    requiredBayCapability: 'DETAILING',
    includes: ['High pressure chassis wash', 'pH-neutral foam bath', 'Wheel & tyre deep scrub', 'Microfibre touchless blow dry']
  },
  {
    id: 'srv-02',
    number: '02',
    name: 'Car Services',
    description: 'Comprehensive multi-point mechanical inspection, fluid top-up, filter check, battery health diagnostic, and roadworthiness certification.',
    category: 'MECHANICAL_MAINTENANCE',
    price: 80000,
    priceType: 'STARTING_FROM',
    durationMinutes: 120,
    bookingEnabled: true,
    active: true,
    featured: true,
    requiredBayCapability: 'MECHANICAL',
    includes: ['42-point safety check', 'Brake & suspension review', 'Fluid levels & coolant check', 'Diagnostic scan']
  },
  {
    id: 'srv-03',
    number: '03',
    name: 'Oil Change',
    description: 'Precision engine oil drain and flush, OEM specification synthetic oil refill, OEM filter replacement, and maintenance interval reset.',
    category: 'MECHANICAL_MAINTENANCE',
    price: 95000,
    priceType: 'STARTING_FROM',
    durationMinutes: 45,
    bookingEnabled: true,
    active: true,
    featured: true,
    requiredBayCapability: 'MECHANICAL',
    includes: ['Full synthetic grade oil', 'Genuine oil filter element', 'Sump plug gasket replacement', 'Service light reset']
  },
  {
    id: 'srv-04',
    number: '04',
    name: 'Car Polishing',
    description: 'Multi-stage rotary and dual-action paint correction, swirl mark elimination, clear-coat restoration, and high-gloss polymer sealant.',
    category: 'DETAILING_WASH',
    price: 150000,
    priceType: 'STARTING_FROM',
    durationMinutes: 180,
    bookingEnabled: true,
    active: true,
    featured: true,
    requiredBayCapability: 'DETAILING',
    includes: ['Paint clay bar decontamination', 'Dual-action compound cutting', 'Finishing micro-polish', 'Sealant protective coat']
  },
  {
    id: 'srv-05',
    number: '05',
    name: 'Interior Vacuum & Detailing',
    description: 'Deep carpet hot water extraction, leather conditioning, dashboard UV ceramic shield, headliner treatment, and ozone anti-bacterial fogging.',
    category: 'DETAILING_WASH',
    price: 85000,
    priceType: 'STARTING_FROM',
    durationMinutes: 90,
    bookingEnabled: true,
    active: true,
    featured: false,
    requiredBayCapability: 'DETAILING',
    includes: ['Deep pile carpet extraction', 'Leather conditioning balm', 'Vent & crevice steamer', 'Ozone odour sanitization']
  },
  {
    id: 'srv-06',
    number: '06',
    name: 'Engine Steam Clean & Wash',
    description: 'Dry steam electrical-safe degreasing of engine block, heat shield decontamination, hose conditioning, and anti-static dressing.',
    category: 'DETAILING_WASH',
    price: 60000,
    priceType: 'STARTING_FROM',
    durationMinutes: 60,
    bookingEnabled: true,
    active: true,
    featured: false,
    requiredBayCapability: 'DETAILING',
    includes: ['Electrical harness masking', 'High-temp dry steam blast', 'Specialized grime solvent', 'Matte silicon engine dressing']
  },
  {
    id: 'srv-07',
    number: '07',
    name: 'Plastic Restoration',
    description: 'Oxidized trim rejuvenation, UV barrier application, bumper and cowl blackening, and hydrophobic weather protection.',
    category: 'BODY_RESTORATION',
    price: 45000,
    priceType: 'FIXED',
    durationMinutes: 40,
    bookingEnabled: true,
    active: true,
    featured: false,
    requiredBayCapability: 'BODYWORK',
    includes: ['Trim surface prep & solvent wash', 'Polymer molecular bonding', 'Deep OEM satin finish restore']
  },
  {
    id: 'srv-08',
    number: '08',
    name: 'Headlight Restoration',
    description: 'Wet-sanding yellowed polycarbonate lenses, optical compounding, ultra-high clarity polish, and ceramic UV protective coating.',
    category: 'BODY_RESTORATION',
    price: 50000,
    priceType: 'FIXED',
    durationMinutes: 45,
    bookingEnabled: true,
    active: true,
    featured: false,
    requiredBayCapability: 'DETAILING',
    includes: ['P1000 - P3000 wet sanding', 'Optical clarity polishing', 'UV ceramic lens sealant']
  },
  {
    id: 'srv-09',
    number: '09',
    name: 'Scratch Removal',
    description: 'Precision spot clear-coat leveling, localized wet-block micro-abrasion, and multi-stage rotary compounding.',
    category: 'BODY_RESTORATION',
    price: 70000,
    priceType: 'STARTING_FROM',
    durationMinutes: 60,
    bookingEnabled: true,
    active: true,
    featured: false,
    requiredBayCapability: 'BODYWORK',
    includes: ['Paint gauge depth measurement', 'Localized wet-sand correction', 'Clear coat heat blending']
  },
  {
    id: 'srv-10',
    number: '10',
    name: 'Water Stop Moval',
    description: 'Specialized chemical acid-free mineral deposit breakdown, hard water glass spot extraction, and exterior surface mineral removal.',
    category: 'DETAILING_WASH',
    price: 55000,
    priceType: 'STARTING_FROM',
    durationMinutes: 60,
    bookingEnabled: true,
    active: true,
    featured: false,
    requiredBayCapability: 'DETAILING',
    includes: ['Windscreen mineral spot polishing', 'Bodywork calcium ring removal', 'Hydrophobic glass repellant']
  },
  {
    id: 'srv-11',
    number: '11',
    name: 'Car Waxing',
    description: 'High-carnauba Brazilian paste wax application, deep reflective gloss enhancement, and 90-day hydrophobic protective shield.',
    category: 'DETAILING_WASH',
    price: 65000,
    priceType: 'FIXED',
    durationMinutes: 60,
    bookingEnabled: true,
    active: true,
    featured: false,
    requiredBayCapability: 'DETAILING',
    includes: ['Hand applied Carnauba blend', 'Orbital buffing finish', 'Hydrophobic water-bead coating']
  },
  {
    id: 'srv-12',
    number: '12',
    name: 'A/C Cleaning',
    description: 'Evaporator antibacterial foam sanitization, cabin pollen filter renewal, refrigerant gas level diagnosis, and blower duct decontamination.',
    category: 'MECHANICAL_MAINTENANCE',
    price: 65000,
    priceType: 'STARTING_FROM',
    durationMinutes: 45,
    bookingEnabled: true,
    active: true,
    featured: false,
    requiredBayCapability: 'MECHANICAL',
    includes: ['Evaporator core disinfection', 'Cabin filter inspection', 'Vent pressure & temp test', 'Odour elimination']
  },
  {
    id: 'srv-13',
    number: '13',
    name: 'Tyre Air Pressure Fill',
    description: 'Digital tyre gauge pressure calibration, nitrogen option check, tread wear measurement, and valve stem inspection.',
    category: 'TYRES_ALIGNMENT',
    price: 10000,
    priceType: 'FIXED',
    durationMinutes: 15,
    bookingEnabled: true,
    active: true,
    featured: false,
    requiredBayCapability: 'ALIGNMENT',
    includes: ['All 4 tyres + spare check', 'Digital bar/psi calibration', 'Valve cap replacement']
  },
  {
    id: 'srv-14',
    number: '14',
    name: 'Puncture Repair',
    description: 'Internal vulcanized radial patch and plug, wheel rim bead inspection, balancing check, and immersion pressure test.',
    category: 'TYRES_ALIGNMENT',
    price: 25000,
    priceType: 'FIXED',
    durationMinutes: 30,
    bookingEnabled: true,
    active: true,
    featured: false,
    requiredBayCapability: 'ALIGNMENT',
    includes: ['Tyre dismount & casing inspection', 'Vulcanized internal patch', 'Bead reseal & leak immersion check']
  },
  {
    id: 'srv-15',
    number: '15',
    name: 'Household Carpets & Rugs',
    description: 'Professional industrial grade high-power shampoo washing, centrifugal water extraction, and sanitized drying for home carpets and car floor rugs.',
    category: 'SPECIALITY_SERVICES',
    price: 40000,
    priceType: 'STARTING_FROM',
    durationMinutes: 120,
    bookingEnabled: true,
    active: true,
    featured: false,
    requiredBayCapability: 'DETAILING',
    includes: ['Deep fibre agitation', 'High-temp sanitizing wash', 'Fast moisture extraction drying']
  },
  {
    id: 'srv-16',
    number: '16',
    name: 'Panel Beating & Respraying',
    description: 'Hydraulic chassis puller realignment, precision metal panel reshaping, computerized spectral paint matching, and oven-baked clearcoat spray.',
    category: 'BODY_RESTORATION',
    price: 250000,
    priceType: 'QUOTE_REQUIRED',
    durationMinutes: 360,
    bookingEnabled: true,
    active: true,
    featured: true,
    requiredBayCapability: 'BODYWORK',
    includes: ['Precision panel beat & ding pull', 'Anti-corrosion epoxy primer', 'Computerized color-matched paint', 'Oven baked 2K clear coat']
  },
  {
    id: 'srv-17',
    number: '17',
    name: 'Body Kit Upgrade & Interior Upgrade',
    description: 'Custom aerodynamic lip and bumper fitment, carbon fiber accents, customized ambient LED integration, and bespoke steering/seat retrimming.',
    category: 'BODY_RESTORATION',
    price: 450000,
    priceType: 'QUOTE_REQUIRED',
    durationMinutes: 300,
    bookingEnabled: true,
    active: true,
    featured: false,
    requiredBayCapability: 'BODYWORK',
    includes: ['Aerodynamic bracket fabrication', 'Seamless OEM gap alignment', 'Interior trim upgrade']
  },
  {
    id: 'srv-18',
    number: '18',
    name: 'Mechanical Maintenance',
    description: 'Engine overhaul, timing belt/chain kit renewal, transmission service, suspension overhaul, cooling system pressure test, and alternator rebuild.',
    category: 'MECHANICAL_MAINTENANCE',
    price: 180000,
    priceType: 'STARTING_FROM',
    durationMinutes: 240,
    bookingEnabled: true,
    active: true,
    featured: true,
    requiredBayCapability: 'MECHANICAL',
    includes: ['Engine mechanical check', 'Timing & belt tensioning', 'Braking system overhaul', 'Suspension bushing inspection']
  },
  {
    id: 'srv-19',
    number: '19',
    name: 'Computerized Diagnosis & Electrical',
    description: 'OBD-II live telemetry streaming, ECU fault code interrogation, sensor calibration, wiring harness trace, CAN-bus diagnosis, and battery charging test.',
    category: 'DIAGNOSTICS_ELECTRICAL',
    price: 50000,
    priceType: 'FIXED',
    durationMinutes: 60,
    bookingEnabled: true,
    active: true,
    featured: true,
    requiredBayCapability: 'ELECTRICAL',
    includes: ['Full ECU system scan', 'Live sensor stream readout', 'Clearing fault codes', 'Diagnostic printout report']
  },
  {
    id: 'srv-20',
    number: '20',
    name: 'Wheel Alignment',
    description: '3D computerized digital laser alignment, camber, caster, toe-in adjustment to manufacturer specs, steering angle sensor zeroing.',
    category: 'TYRES_ALIGNMENT',
    price: 50000,
    priceType: 'FIXED',
    durationMinutes: 45,
    bookingEnabled: true,
    active: true,
    featured: true,
    requiredBayCapability: 'ALIGNMENT',
    includes: ['3D digital sensor scan', 'Front & rear camber/toe calibrate', 'Road pull & drift prevention test', 'Alignment printout certificate']
  }
];

const INITIAL_BAYS: WorkshopBay[] = [
  { id: 'bay-01', name: 'Bay 01 — Mechanical & Powertrain', capability: 'MECHANICAL', isOccupied: true, currentWorkOrderNumber: 'HA-WO-000184', currentVehicleRegistration: 'T 123 ABC' },
  { id: 'bay-02', name: 'Bay 02 — 3D Wheel Alignment & Suspension', capability: 'ALIGNMENT', isOccupied: false },
  { id: 'bay-03', name: 'Bay 03 — Detailing & Ceramic Lab', capability: 'DETAILING', isOccupied: false },
  { id: 'bay-04', name: 'Bay 04 — Electrical & ECU Diagnostics', capability: 'ELECTRICAL', isOccupied: false },
  { id: 'bay-05', name: 'Bay 05 — Panel Beating & Spray Booth', capability: 'BODYWORK', isOccupied: false },
];

const INITIAL_STAFF: StaffUser[] = [
  { id: 'staff-01', name: 'Juma Hunter', role: 'OWNER', email: 'juma@hunterautoworks.co.tz', phone: '0654686962', active: true },
  { id: 'staff-02', name: 'Denis Makoye', role: 'MANAGER', email: 'denis@hunterautoworks.co.tz', phone: '0627629345', active: true },
  { id: 'staff-03', name: 'Frank Kimaro', role: 'SERVICE_ADVISOR', email: 'frank@hunterautoworks.co.tz', phone: '0712345678', active: true },
  { id: 'staff-04', name: 'Rashid Ally', role: 'TECHNICIAN', email: 'rashid@hunterautoworks.co.tz', phone: '0755998877', active: true },
  { id: 'staff-05', name: 'Emmanuel Peter', role: 'TECHNICIAN', email: 'emmanuel@hunterautoworks.co.tz', phone: '0766112233', active: true },
  { id: 'staff-06', name: 'Neema Joseph', role: 'CASHIER', email: 'neema@hunterautoworks.co.tz', phone: '0788445566', active: true },
  { id: 'staff-07', name: 'Baraka Said', role: 'INVENTORY_MANAGER', email: 'baraka@hunterautoworks.co.tz', phone: '0744332211', active: true },
  { id: 'staff-08', name: 'Grace Mlay', role: 'ACCOUNTANT', email: 'grace@hunterautoworks.co.tz', phone: '0755443322', active: true }
];

const INITIAL_INVENTORY: InventoryItem[] = [
  { id: 'inv-01', sku: 'OIL-5W40-TQ', name: 'Total Quartz 9000 5W-40 Synthetic (4L)', category: 'OILS_FLUIDS', costPrice: 65000, sellingPrice: 85000, currentStock: 28, reorderLevel: 10, unit: 'Bottle', active: true },
  { id: 'inv-02', sku: 'OIL-10W40-HE', name: 'Shell Helix HX7 10W-40 Synthetic Blend (4L)', category: 'OILS_FLUIDS', costPrice: 50000, sellingPrice: 70000, currentStock: 18, reorderLevel: 8, unit: 'Bottle', active: true },
  { id: 'inv-03', sku: 'FLT-OIL-TOY', name: 'Toyota Genuine Oil Filter 90915-YZZE2', category: 'FILTERS', costPrice: 15000, sellingPrice: 25000, currentStock: 42, reorderLevel: 15, unit: 'Piece', active: true },
  { id: 'inv-04', sku: 'FLT-AIR-RAV', name: 'OEM Engine Air Filter Toyota RAV4 2013-18', category: 'FILTERS', costPrice: 22000, sellingPrice: 38000, currentStock: 14, reorderLevel: 6, unit: 'Piece', active: true },
  { id: 'inv-05', sku: 'BRK-PAD-FR', name: 'Brembo Ceramic Front Brake Pads (RAV4/Vanguard)', category: 'BRAKES', costPrice: 65000, sellingPrice: 95000, currentStock: 9, reorderLevel: 5, unit: 'Set', active: true },
  { id: 'inv-06', sku: 'BRK-PAD-RR', name: 'Brembo Rear Brake Pads (RAV4/Harrier)', category: 'BRAKES', costPrice: 50000, sellingPrice: 75000, currentStock: 12, reorderLevel: 5, unit: 'Set', active: true },
  { id: 'inv-07', sku: 'SPK-NGK-IR', name: 'NGK Laser Iridium Spark Plugs ILKAR7B11 (Set of 4)', category: 'ELECTRICAL', costPrice: 70000, sellingPrice: 110000, currentStock: 16, reorderLevel: 6, unit: 'Set', active: true },
  { id: 'inv-08', sku: 'TYR-225-65', name: 'Michelin Primacy 4 225/65 R17 102V Tyre', category: 'TYRES', costPrice: 240000, sellingPrice: 320000, currentStock: 8, reorderLevel: 4, unit: 'Piece', active: true },
  { id: 'inv-09', sku: 'CLN-AC-WUR', name: 'Wurth Professional A/C Evaporator Cleaner (300ml)', category: 'CAR_CARE', costPrice: 20000, sellingPrice: 35000, currentStock: 22, reorderLevel: 8, unit: 'Can', active: true },
  { id: 'inv-10', sku: 'DET-WAX-MG', name: "Meguiar's Ultimate Liquid Polymer Wax (473ml)", category: 'CAR_CARE', costPrice: 45000, sellingPrice: 70000, currentStock: 15, reorderLevel: 5, unit: 'Bottle', active: true },
];

const INITIAL_SETTINGS: WorkshopSettings = {
  businessName: 'Hunter Autoworks',
  tagline: 'The Car Lab',
  address: 'Kinondoni Morocco, BLOCK 41',
  block: 'Block 41',
  city: 'Dar es Salaam',
  phones: ['0654686962', '0627629345'],
  whatsappNumbers: ['0654686962', '0627629345'],
  instagram: '@hunter_autoworks',
  operatingHours: {
    weekdays: '08:00 — 18:30',
    saturday: '08:30 — 17:00',
    sunday: '09:30 — 15:00'
  },
  enableOnlineBooking: true,
  taxRatePercent: 0,
  currency: 'TZS'
};

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'cust-01', name: 'Mohamed Bakari', phone: '0754123456', whatsapp: '0754123456', email: 'm.bakari@gmail.com', notes: 'Prefers synthetic oil only. Very prompt customer.', createdAt: '2026-08-10T09:00:00Z' },
  { id: 'cust-02', name: 'Sarah Kweka', phone: '0784987654', whatsapp: '0784987654', email: 'sarah.kweka@yahoo.com', createdAt: '2026-08-14T11:30:00Z' },
  { id: 'cust-03', name: 'David Mrosso', phone: '0713556677', whatsapp: '0713556677', createdAt: '2026-08-20T14:15:00Z' }
];

const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'veh-01',
    registrationNumber: 'T 123 ABC',
    make: 'Toyota',
    model: 'RAV4',
    year: 2018,
    mileageKm: 124850,
    color: 'Metallic Pearl White',
    customerId: 'cust-01',
    lastServiceDate: '2026-08-12',
    nextServiceKm: 130000,
    nextServiceDate: '2026-11-12'
  },
  {
    id: 'veh-02',
    registrationNumber: 'T 789 DXY',
    make: 'BMW',
    model: 'X5 xDrive40i',
    year: 2020,
    mileageKm: 86200,
    color: 'Carbon Black',
    customerId: 'cust-02',
    lastServiceDate: '2026-08-28',
    nextServiceKm: 95000,
    nextServiceDate: '2026-11-28'
  },
  {
    id: 'veh-03',
    registrationNumber: 'T 456 EFG',
    make: 'Toyota',
    model: 'Harrier',
    year: 2017,
    mileageKm: 102400,
    color: 'Dark Blue Mica',
    customerId: 'cust-03',
    lastServiceDate: '2026-07-15'
  }
];

const INITIAL_WORK_ORDERS: WorkOrder[] = [
  {
    id: 'wo-01',
    workOrderNumber: 'HA-WO-000184',
    customerId: 'cust-01',
    customerName: 'Mohamed Bakari',
    customerPhone: '0754123456',
    customerWhatsapp: '0754123456',
    vehicleRegistration: 'T 123 ABC',
    vehicleMakeModel: 'Toyota RAV4 2018',
    vehicleMileage: 124850,
    status: 'IN_SERVICE',
    assignedTechnicianId: 'staff-04',
    assignedTechnicianName: 'Rashid Ally',
    assignedBayId: 'bay-01',
    assignedBayName: 'Bay 01 — Mechanical & Powertrain',
    priority: 'NORMAL',
    services: [
      { serviceId: 'srv-03', serviceName: 'Oil Change', price: 95000, status: 'DONE' },
      { serviceId: 'srv-20', serviceName: 'Wheel Alignment', price: 50000, status: 'IN_PROGRESS' },
      { serviceId: 'srv-19', serviceName: 'Computerized Diagnosis & Electrical', price: 50000, status: 'PENDING' }
    ],
    parts: [
      { sku: 'OIL-5W40-TQ', name: 'Total Quartz 9000 5W-40 Synthetic (4L)', quantity: 1, unitPrice: 85000, total: 85000 },
      { sku: 'FLT-OIL-TOY', name: 'Toyota Genuine Oil Filter 90915-YZZE2', quantity: 1, unitPrice: 25000, total: 25000 }
    ],
    laborCost: 195000,
    partsCost: 110000,
    totalCost: 305000,
    notes: 'Customer noticed slight steering pull to the left at highway speeds. Check front suspension bushings during alignment.',
    startedAt: '2026-09-11T08:30:00Z',
    createdAt: '2026-09-11T08:00:00Z',
    updatedAt: '2026-09-11T09:45:00Z'
  },
  {
    id: 'wo-02',
    workOrderNumber: 'HA-WO-000183',
    customerId: 'cust-02',
    customerName: 'Sarah Kweka',
    customerPhone: '0784987654',
    customerWhatsapp: '0784987654',
    vehicleRegistration: 'T 789 DXY',
    vehicleMakeModel: 'BMW X5 2020',
    vehicleMileage: 86200,
    status: 'READY',
    assignedTechnicianId: 'staff-05',
    assignedTechnicianName: 'Emmanuel Peter',
    assignedBayId: 'bay-03',
    assignedBayName: 'Bay 03 — Detailing & Ceramic Lab',
    priority: 'HIGH',
    services: [
      { serviceId: 'srv-04', serviceName: 'Car Polishing', price: 150000, status: 'DONE' },
      { serviceId: 'srv-01', serviceName: 'Royal Car Wash', price: 30000, status: 'DONE' }
    ],
    parts: [],
    laborCost: 180000,
    partsCost: 0,
    totalCost: 180000,
    notes: 'Ceramic top coat applied. Ready for collection.',
    startedAt: '2026-09-11T07:15:00Z',
    completedAt: '2026-09-11T11:00:00Z',
    createdAt: '2026-09-11T07:00:00Z',
    updatedAt: '2026-09-11T11:05:00Z'
  }
];

const INITIAL_INSPECTIONS: InspectionReport[] = [
  {
    id: 'insp-01',
    workOrderId: 'wo-01',
    vehicleRegistration: 'T 123 ABC',
    technicianName: 'Rashid Ally',
    createdAt: '2026-09-11T08:45:00Z',
    overallSummary: 'Powertrain in excellent health. Front tyres have uneven camber wear; steering pull confirmed by 3D rig.',
    items: [
      { id: 'i-1', name: 'Front Left Tyre', condition: 'ATTENTION', measurement: '2.1 bar | 3.2 mm tread', note: 'Inside shoulder shows accelerated wear due to toe divergence.' },
      { id: 'i-2', name: 'Front Right Tyre', condition: 'GOOD', measurement: '2.2 bar | 4.6 mm tread', note: 'Within safe spec.' },
      { id: 'i-3', name: 'Rear Tyres (Both)', condition: 'GOOD', measurement: '2.2 bar | 5.1 mm tread', note: 'Even wear pattern.' },
      { id: 'i-4', name: 'Front Brake Pads', condition: 'ATTENTION', measurement: '4.0 mm', note: 'Approx 30% life remaining. Recommend replacement at next interval.' },
      { id: 'i-5', name: 'Rear Brake Pads', condition: 'GOOD', measurement: '6.5 mm', note: 'Good condition.' },
      { id: 'i-6', name: 'Engine Oil & Viscosity', condition: 'GOOD', measurement: 'Fresh 5W-40 Synthetic', note: 'Freshly replaced with OEM filter.' },
      { id: 'i-7', name: '12V Battery Health', condition: 'GOOD', measurement: '12.65V (100% CCA)', note: 'Terminal posts cleaned & greased.' },
      { id: 'i-8', name: 'Coolant & Hoses', condition: 'GOOD', measurement: '-35°C Freeze Point', note: 'No leaks detected.' },
      { id: 'i-9', name: 'A/C Evaporator & Temp', condition: 'GOOD', measurement: '5.8°C vent output', note: 'Cold and crisp.' },
      { id: 'i-10', name: 'Front Suspension & Bushings', condition: 'ATTENTION', measurement: 'Left stabilizer link', note: 'Minor play in link rod.' }
    ]
  }
];

const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-183',
    invoiceNumber: 'HA-2026-000183',
    workOrderId: 'wo-02',
    customerId: 'cust-02',
    customerName: 'Sarah Kweka',
    customerPhone: '0784987654',
    vehicleRegistration: 'T 789 DXY',
    vehicleMakeModel: 'BMW X5 2020',
    items: [
      { description: 'Car Polishing — Multi-Stage Correction & Sealant', type: 'SERVICE', quantity: 1, unitPrice: 150000, total: 150000 },
      { description: 'Royal Car Wash & Undercarriage Flush', type: 'SERVICE', quantity: 1, unitPrice: 30000, total: 30000 }
    ],
    subtotal: 180000,
    discount: 0,
    tax: 0,
    total: 180000,
    amountPaid: 180000,
    paymentStatus: 'PAID',
    paymentMethod: 'M_PESA',
    paymentReference: 'MP-994827104',
    verificationHash: 'ha-ver-83a91f',
    dueDate: '2026-09-11',
    createdAt: '2026-09-11T11:10:00Z',
    paidAt: '2026-09-11T11:15:00Z'
  }
];

const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud-01',
    actor: 'Juma Hunter (Owner)',
    action: 'SYSTEM_INITIALIZED',
    entity: 'System',
    entityId: 'sys-01',
    details: 'Hunter Autoworks The Car Lab digital workshop platform initialized.',
    timestamp: '2026-09-11T06:00:00Z'
  },
  {
    id: 'aud-02',
    actor: 'Denis Makoye (Manager)',
    action: 'WORK_ORDER_CREATED',
    entity: 'WorkOrder',
    entityId: 'wo-01',
    details: 'Created Work Order HA-WO-000184 for Toyota RAV4 (T 123 ABC).',
    timestamp: '2026-09-11T08:00:00Z'
  }
];

class HunterDatabase {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadData();
  }

  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Could not read hunter_db.json, using defaults', e);
    }

    const defaultData: DatabaseSchema = {
      services: INITIAL_SERVICES,
      vehicles: INITIAL_VEHICLES,
      customers: INITIAL_CUSTOMERS,
      appointments: [],
      workOrders: INITIAL_WORK_ORDERS,
      inspections: INITIAL_INSPECTIONS,
      estimates: [],
      bays: INITIAL_BAYS,
      inventory: INITIAL_INVENTORY,
      inventoryMovements: [],
      suppliers: [
        { id: 'sup-01', name: 'TotalEnergies Tanzania Ltd', contactPerson: 'Hassan M.', phone: '0222123456', address: 'Dar es Salaam Port Zone' },
        { id: 'sup-02', name: 'AutoZone Parts Supply Ltd', contactPerson: 'Kelvin R.', phone: '0715998877', address: 'Kariakoo, Dar es Salaam' }
      ],
      purchaseOrders: [],
      invoices: INITIAL_INVOICES,
      posSales: [],
      cashierSessions: [
        {
          id: 'sess-01',
          cashierName: 'Neema Joseph',
          openingFloat: 100000,
          openedAt: '2026-09-11T07:30:00Z',
          status: 'OPEN',
          cashSalesTotal: 0,
          mobileMoneyTotal: 180000,
          cardTotal: 0,
          bankTotal: 0,
          totalSales: 180000,
          expectedCash: 100000
        }
      ],
      expenses: [],
      auditLogs: INITIAL_AUDIT_LOGS,
      settings: INITIAL_SETTINGS,
      staff: INITIAL_STAFF
    };

    this.persist(defaultData);
    return defaultData;
  }

  private persist(dataToSave?: DatabaseSchema) {
    try {
      const data = dataToSave || this.data;
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write database file', e);
    }
  }

  public logAudit(actor: string, action: string, entity: string, entityId: string, details: string, oldValue?: string, newValue?: string) {
    const log: AuditLog = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actor,
      action,
      entity,
      entityId,
      details,
      oldValue,
      newValue,
      timestamp: new Date().toISOString()
    };
    this.data.auditLogs.unshift(log);
    // Keep max 500 logs in memory/disk
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 500);
    }
    this.persist();
  }

  // --- Services ---
  public getServices(): ServiceItem[] {
    return this.data.services;
  }

  public getServiceById(id: string): ServiceItem | undefined {
    return this.data.services.find(s => s.id === id || s.number === id);
  }

  public updateService(id: string, updates: Partial<ServiceItem>, actor: string): ServiceItem | null {
    const idx = this.data.services.findIndex(s => s.id === id);
    if (idx === -1) return null;
    const old = { ...this.data.services[idx] };
    this.data.services[idx] = { ...this.data.services[idx], ...updates };
    this.persist();
    this.logAudit(actor, 'SERVICE_UPDATED', 'ServiceItem', id, `Updated service ${old.name}`, JSON.stringify(old), JSON.stringify(this.data.services[idx]));
    return this.data.services[idx];
  }

  // --- Vehicles & Customers ---
  public getVehicles(): Vehicle[] {
    return this.data.vehicles;
  }

  public findVehicleByReg(reg: string): Vehicle | undefined {
    const clean = reg.trim().toUpperCase().replace(/\s+/g, ' ');
    return this.data.vehicles.find(v => v.registrationNumber.toUpperCase().replace(/\s+/g, ' ') === clean);
  }

  public upsertVehicle(v: Omit<Vehicle, 'id'> & { id?: string }): Vehicle {
    const existing = this.findVehicleByReg(v.registrationNumber);
    if (existing) {
      // Only update fields the customer actually provided — never fabricate.
      if (v.make) existing.make = v.make;
      if (v.model) existing.model = v.model;
      if (v.year !== undefined) existing.year = v.year;
      if (v.mileageKm !== undefined) existing.mileageKm = v.mileageKm;
      if (v.color) existing.color = v.color;
      if (v.customerId) existing.customerId = v.customerId;
      this.persist();
      return existing;
    }
    const newVehicle: Vehicle = {
      id: v.id || `veh-${Date.now()}`,
      ...v,
      registrationNumber: v.registrationNumber.trim().toUpperCase()
    };
    this.data.vehicles.push(newVehicle);
    this.persist();
    return newVehicle;
  }

  public getCustomers(): Customer[] {
    return this.data.customers;
  }

  public upsertCustomer(c: { name: string; phone: string; whatsapp?: string; email?: string }): Customer {
    const cleanPhone = c.phone.trim().replace(/\D/g, '');
    const existing = this.data.customers.find(item => item.phone.replace(/\D/g, '') === cleanPhone);
    if (existing) {
      if (c.name) existing.name = c.name;
      if (c.whatsapp) existing.whatsapp = c.whatsapp;
      if (c.email) existing.email = c.email;
      this.persist();
      return existing;
    }
    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: c.name,
      phone: c.phone,
      whatsapp: c.whatsapp || c.phone,
      email: c.email,
      createdAt: new Date().toISOString()
    };
    this.data.customers.push(newCust);
    this.persist();
    return newCust;
  }

  // --- Appointments & Real Availability ---
  public getAppointments(): Appointment[] {
    return this.data.appointments;
  }

  public findAppointmentByIdempotencyKey(key: string): Appointment | undefined {
    return this.data.appointments.find(a => a.idempotencyKey === key);
  }

  public checkAvailability(dateStr: string, requiredMinutes: number): { availableSlots: string[]; bookedCount: number; maxCapacity: number } {
    // Workshop capacity: 5 bays, operating hours 08:00 - 18:00 (10 hours = 600 mins total capacity per bay = 3000 mins)
    const existingForDate = this.data.appointments.filter(a => a.scheduledDate === dateStr && a.status !== 'CANCELLED');
    const bookedMinutes = existingForDate.reduce((acc, a) => acc + (a.durationMinutes || 60), 0);
    const standardSlots = [
      '08:30', '09:30', '10:30', '11:30', '12:30',
      '14:00', '15:00', '16:00', '17:00'
    ];

    // Filter out slots where bay capacity (max 5 simultaneous) is exceeded
    const availableSlots = standardSlots.filter(time => {
      const concurrentAtSlot = existingForDate.filter(a => a.scheduledTime === time).length;
      return concurrentAtSlot < 4; // leave buffer for walk-ins
    });

    return {
      availableSlots,
      bookedCount: existingForDate.length,
      maxCapacity: 5 * 8 // 40 max jobs/day across 5 bays
    };
  }

  public createAppointment(data: {
    customerName: string;
    customerPhone: string;
    customerWhatsapp?: string;
    vehicleRegistration: string;
    vehicleMakeModel: string;
    vehicleYear?: number;
    vehicleMileage?: number;
    serviceIds: string[];
    scheduledDate: string;
    scheduledTime: string;
    notes?: string;
    idempotencyKey?: string;
  }): Appointment {
    // 1. Ensure Customer
    const customer = this.upsertCustomer({
      name: data.customerName,
      phone: data.customerPhone,
      whatsapp: data.customerWhatsapp || data.customerPhone
    });

    // 2. Ensure Vehicle — only with customer-provided facts (no fabricated defaults)
    const [make, ...modelParts] = data.vehicleMakeModel.split(' ');
    const vehicle = this.upsertVehicle({
      registrationNumber: data.vehicleRegistration,
      make: make || 'Vehicle',
      model: modelParts.join(' '),
      year: data.vehicleYear,
      mileageKm: data.vehicleMileage,
      customerId: customer.id
    });

    // 3. Resolve Services
    const matchedServices = data.serviceIds.map(id => this.getServiceById(id)).filter(Boolean) as ServiceItem[];
    const totalDuration = matchedServices.reduce((acc, s) => acc + (s.durationMinutes || 45), 0);
    const serviceNames = matchedServices.map(s => s.name);

    const refNumber = `HA-APT-${Math.floor(1000 + Math.random() * 9000)}`;
    const appointment: Appointment = {
      id: `apt-${Date.now()}`,
      reference: refNumber,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerWhatsapp: customer.whatsapp,
      vehicleId: vehicle.id,
      vehicleRegistration: vehicle.registrationNumber,
      vehicleMakeModel: `${vehicle.make} ${vehicle.model}`,
      serviceIds: matchedServices.map(s => s.id),
      serviceNames,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      durationMinutes: totalDuration,
      status: 'CONFIRMED',
      notes: data.notes,
      idempotencyKey: data.idempotencyKey,
      createdAt: new Date().toISOString()
    };

    this.data.appointments.push(appointment);

    // Auto create Initial Work Order in BOOKED status
    const woNum = `HA-WO-00${Math.floor(185 + this.data.workOrders.length)}`;
    const wo: WorkOrder = {
      id: `wo-${Date.now()}`,
      workOrderNumber: woNum,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerWhatsapp: customer.whatsapp,
      vehicleRegistration: vehicle.registrationNumber,
      vehicleMakeModel: `${vehicle.make} ${vehicle.model}`,
      vehicleMileage: vehicle.mileageKm,
      status: 'BOOKED',
      priority: 'NORMAL',
      services: matchedServices.map(s => ({
        serviceId: s.id,
        serviceName: s.name,
        price: s.price,
        status: 'PENDING'
      })),
      parts: [],
      laborCost: matchedServices.reduce((a, s) => a + s.price, 0),
      partsCost: 0,
      totalCost: matchedServices.reduce((a, s) => a + s.price, 0),
      notes: data.notes || 'Online appointment booking',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data.workOrders.push(wo);

    this.persist();
    this.logAudit('Customer (Guest)', 'APPOINTMENT_BOOKED', 'Appointment', appointment.id, `Booked ${refNumber} for ${vehicle.registrationNumber}`);
    return appointment;
  }

  // --- Work Orders ---
  public getWorkOrders(): WorkOrder[] {
    return this.data.workOrders;
  }

  public getWorkOrderByNumberOrId(key: string): WorkOrder | undefined {
    const clean = key.trim().toUpperCase();
    return this.data.workOrders.find(wo => wo.workOrderNumber.toUpperCase() === clean || wo.id === key);
  }

  public getWorkOrdersByVehicle(reg: string): WorkOrder[] {
    const clean = reg.trim().toUpperCase().replace(/\s+/g, ' ');
    return this.data.workOrders.filter(wo => wo.vehicleRegistration.toUpperCase().replace(/\s+/g, ' ') === clean);
  }

  public updateWorkOrderStatus(woId: string, newStatus: WorkOrder['status'], actor: string): WorkOrder | null {
    const wo = this.data.workOrders.find(w => w.id === woId || w.workOrderNumber === woId);
    if (!wo) return null;
    const oldStatus = wo.status;
    wo.status = newStatus;
    wo.updatedAt = new Date().toISOString();

    if (newStatus === 'IN_SERVICE' && !wo.startedAt) {
      wo.startedAt = new Date().toISOString();
    }
    if (newStatus === 'READY' || newStatus === 'COMPLETED') {
      wo.completedAt = new Date().toISOString();
    }

    // Auto assign bay / free bay
    if (newStatus === 'COMPLETED' && wo.assignedBayId) {
      const bay = this.data.bays.find(b => b.id === wo.assignedBayId);
      if (bay) {
        bay.isOccupied = false;
        bay.currentWorkOrderNumber = undefined;
        bay.currentVehicleRegistration = undefined;
      }
    }

    this.persist();
    this.logAudit(actor, 'WORK_ORDER_STATUS_CHANGED', 'WorkOrder', wo.workOrderNumber, `Transitioned from ${oldStatus} to ${newStatus}`);
    return wo;
  }

  public assignWorkOrderBayAndTech(woId: string, bayId?: string, technicianId?: string, actor: string = 'Staff'): WorkOrder | null {
    const wo = this.data.workOrders.find(w => w.id === woId || w.workOrderNumber === woId);
    if (!wo) return null;

    if (bayId) {
      const bay = this.data.bays.find(b => b.id === bayId);
      if (bay) {
        wo.assignedBayId = bay.id;
        wo.assignedBayName = bay.name;
        bay.isOccupied = true;
        bay.currentWorkOrderNumber = wo.workOrderNumber;
        bay.currentVehicleRegistration = wo.vehicleRegistration;
      }
    }
    if (technicianId) {
      const tech = this.data.staff.find(s => s.id === technicianId);
      if (tech) {
        wo.assignedTechnicianId = tech.id;
        wo.assignedTechnicianName = tech.name;
      }
    }
    wo.updatedAt = new Date().toISOString();
    this.persist();
    this.logAudit(actor, 'WORK_ORDER_ASSIGNED', 'WorkOrder', wo.workOrderNumber, `Assigned Bay: ${wo.assignedBayName}, Tech: ${wo.assignedTechnicianName}`);
    return wo;
  }

  // --- Inspections ---
  public getInspectionByWorkOrderId(woId: string): InspectionReport | undefined {
    return this.data.inspections.find(i => i.workOrderId === woId);
  }

  public saveInspection(report: InspectionReport, actor: string): InspectionReport {
    const idx = this.data.inspections.findIndex(i => i.workOrderId === report.workOrderId);
    if (idx >= 0) {
      this.data.inspections[idx] = report;
    } else {
      this.data.inspections.push(report);
    }

    // Link in work order
    const wo = this.data.workOrders.find(w => w.id === report.workOrderId || w.workOrderNumber === report.workOrderId);
    if (wo) {
      wo.inspectionId = report.id;
      if (wo.status === 'CHECKED_IN') {
        wo.status = 'INSPECTION';
      }
      wo.updatedAt = new Date().toISOString();
    }

    this.persist();
    this.logAudit(actor, 'INSPECTION_SAVED', 'InspectionReport', report.id, `Vehicle ${report.vehicleRegistration} inspected by ${report.technicianName}`);
    return report;
  }

  // --- Inventory & Authoritative Stock Movement ---
  public getInventory(): InventoryItem[] {
    return this.data.inventory;
  }

  public getInventoryMovements(): InventoryMovement[] {
    return this.data.inventoryMovements;
  }

  public adjustInventoryStock(itemId: string, quantityChange: number, reason: string, actor: string, referenceId?: string): { success: boolean; item?: InventoryItem; error?: string } {
    const item = this.data.inventory.find(i => i.id === itemId || i.sku === itemId);
    if (!item) return { success: false, error: 'Item not found' };

    const newStock = item.currentStock + quantityChange;
    if (newStock < 0) {
      return { success: false, error: `Insufficient stock for ${item.name}. Available: ${item.currentStock}, Requested: ${Math.abs(quantityChange)}` };
    }

    const prev = item.currentStock;
    item.currentStock = newStock;

    const movement: InventoryMovement = {
      id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      inventoryItemId: item.id,
      sku: item.sku,
      itemName: item.name,
      type: quantityChange < 0 ? (referenceId?.startsWith('POS') ? 'POS_SALE' : 'WORK_ORDER') : 'ADJUSTMENT',
      quantityChange,
      previousStock: prev,
      resultingStock: newStock,
      reason,
      actor,
      referenceId,
      timestamp: new Date().toISOString()
    };
    this.data.inventoryMovements.unshift(movement);

    this.persist();
    this.logAudit(actor, 'STOCK_MUTATION', 'InventoryItem', item.sku, `${reason}: ${quantityChange > 0 ? '+' : ''}${quantityChange} (${prev} -> ${newStock})`);
    return { success: true, item };
  }

  // --- POS Transactions & Server-Authoritative Totals ---
  public processPosSale(data: {
    cashierName: string;
    customerName?: string;
    customerPhone?: string;
    vehicleRegistration?: string;
    items: { id: string; type: 'SERVICE' | 'PRODUCT'; quantity: number }[];
    paymentMethod: PosSale['paymentMethod'];
    amountTendered: number;
    discount?: number;
  }): { success: boolean; sale?: PosSale; receipt?: Invoice; error?: string } {
    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'Cart is empty' };
    }

    // 1. Server recalculates authoritative pricing
    const lineItems: PosSale['items'] = [];
    let subtotal = 0;

    for (const itemRequest of data.items) {
      if (itemRequest.type === 'PRODUCT') {
        const product = this.data.inventory.find(i => i.id === itemRequest.id || i.sku === itemRequest.id);
        if (!product) return { success: false, error: `Product SKU ${itemRequest.id} not found` };
        if (product.currentStock < itemRequest.quantity) {
          return { success: false, error: `Insufficient stock for ${product.name}. In stock: ${product.currentStock}` };
        }
        lineItems.push({
          id: product.sku,
          type: 'PRODUCT',
          name: product.name,
          unitPrice: product.sellingPrice,
          quantity: itemRequest.quantity,
          stockAvailable: product.currentStock
        });
        subtotal += product.sellingPrice * itemRequest.quantity;
      } else {
        const service = this.data.services.find(s => s.id === itemRequest.id || s.number === itemRequest.id);
        if (!service) return { success: false, error: `Service ${itemRequest.id} not found` };
        lineItems.push({
          id: service.id,
          type: 'SERVICE',
          name: service.name,
          unitPrice: service.price,
          quantity: itemRequest.quantity
        });
        subtotal += service.price * itemRequest.quantity;
      }
    }

    const discount = Math.max(0, data.discount || 0);
    const total = Math.max(0, subtotal - discount);

    if (data.amountTendered < total) {
      return { success: false, error: `Amount tendered (${data.amountTendered} TZS) is less than total (${total} TZS)` };
    }

    const change = data.amountTendered - total;
    const saleNumber = `POS-2026-0${Math.floor(82 + this.data.posSales.length)}`;

    // 2. Atomically deduct inventory
    for (const item of lineItems) {
      if (item.type === 'PRODUCT') {
        this.adjustInventoryStock(item.id, -item.quantity, `POS Sale ${saleNumber}`, data.cashierName, saleNumber);
      }
    }

    const sale: PosSale = {
      id: `pos-${Date.now()}`,
      saleNumber,
      cashierName: data.cashierName,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      vehicleRegistration: data.vehicleRegistration?.toUpperCase(),
      items: lineItems,
      subtotal,
      discount,
      total,
      paymentMethod: data.paymentMethod,
      amountTendered: data.amountTendered,
      change,
      timestamp: new Date().toISOString()
    };
    this.data.posSales.push(sale);

    // 3. Generate authoritative Invoice / Receipt record
    const invoiceNumber = `HA-2026-00${Math.floor(185 + this.data.invoices.length)}`;
    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber,
      customerId: 'pos-walkin',
      customerName: data.customerName || 'Walk-in Customer',
      customerPhone: data.customerPhone || 'N/A',
      vehicleRegistration: data.vehicleRegistration?.toUpperCase() || 'WALK-IN',
      vehicleMakeModel: 'Counter Sale',
      items: lineItems.map(i => ({
        description: i.name,
        type: i.type === 'PRODUCT' ? 'PART' : 'SERVICE',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.unitPrice * i.quantity
      })),
      subtotal,
      discount,
      tax: 0,
      total,
      amountPaid: total,
      paymentStatus: 'PAID',
      paymentMethod: data.paymentMethod,
      paymentReference: saleNumber,
      verificationHash: `haver-${crypto.randomBytes(24).toString('base64url')}`,
      dueDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      paidAt: new Date().toISOString()
    };
    this.data.invoices.push(invoice);

    // Update active cashier session
    const openSession = this.data.cashierSessions.find(s => s.status === 'OPEN');
    if (openSession) {
      openSession.totalSales += total;
      if (data.paymentMethod === 'CASH') openSession.cashSalesTotal += total;
      else if (data.paymentMethod === 'M_PESA' || data.paymentMethod === 'TIGO_PESA' || data.paymentMethod === 'AIRTEL_MONEY') openSession.mobileMoneyTotal += total;
      else if (data.paymentMethod === 'CARD') openSession.cardTotal += total;
      else if (data.paymentMethod === 'BANK_TRANSFER') openSession.bankTotal += total;
      openSession.expectedCash = openSession.openingFloat + openSession.cashSalesTotal;
    }

    this.persist();
    this.logAudit(data.cashierName, 'POS_SALE_COMPLETED', 'PosSale', saleNumber, `Total: ${total} TZS via ${data.paymentMethod}`);
    return { success: true, sale, receipt: invoice };
  }

  // --- Invoices ---
  public getInvoices(): Invoice[] {
    return this.data.invoices;
  }

  public getInvoiceByNumber(num: string): Invoice | undefined {
    const clean = num.trim().toUpperCase();
    return this.data.invoices.find(i => i.invoiceNumber.toUpperCase() === clean || i.id === num);
  }

  public verifyInvoiceByToken(token: string): Invoice | undefined {
    return this.data.invoices.find(i => i.verificationHash === token);
  }

  // --- Workshop Bays ---
  public getBays(): WorkshopBay[] {
    return this.data.bays;
  }

  // --- Settings & CMS ---
  public getSettings(): WorkshopSettings {
    return this.data.settings;
  }

  public updateSettings(settings: Partial<WorkshopSettings>, actor: string): WorkshopSettings {
    this.data.settings = { ...this.data.settings, ...settings };
    this.persist();
    this.logAudit(actor, 'SETTINGS_UPDATED', 'Settings', 'global', 'Workshop settings updated');
    return this.data.settings;
  }

  // --- Audit Logs ---
  public getAuditLogs(): AuditLog[] {
    return this.data.auditLogs;
  }

  // --- Staff ---
  public getStaff(): StaffUser[] {
    return this.data.staff;
  }

  // --- Cashier Sessions ---
  public getCashierSessions(): CashierSession[] {
    return this.data.cashierSessions;
  }

  public closeCashierSession(sessionId: string, countedCash: number, notes?: string): CashierSession | null {
    const sess = this.data.cashierSessions.find(s => s.id === sessionId);
    if (!sess) return null;
    sess.status = 'CLOSED';
    sess.closedAt = new Date().toISOString();
    sess.countedCash = countedCash;
    sess.variance = countedCash - sess.expectedCash;
    sess.notes = notes;
    this.persist();
    this.logAudit(sess.cashierName, 'CASHIER_SESSION_CLOSED', 'CashierSession', sess.id, `Counted: ${countedCash} TZS, Variance: ${sess.variance} TZS`);
    return sess;
  }
}

export const db = new HunterDatabase();
