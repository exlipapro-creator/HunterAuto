-- ============================================================
-- HUNTER AUTOWORKS — THE CAR LAB
-- Core relational schema (Phase 1)
-- Target: existing project https://nnhdgeuvcpltszgmijml.supabase.co
--
-- Conventions
--   * Money: BIGINT in TZS minor units (Tanzanian shilling has no practical
--     subunit in daily use; 1 unit = 1 TZS). BIGINT avoids float drift and
--     the 2.1B ceiling of INT for large cumulative values.
--   * Timestamps: timestamptz, defaults now().
--   * IDs: uuid defaults; legacy string ids from hunter_db.json are kept in
--     legacy_id columns for the one-time migration and audit traceability.
--   * Statuses: postgres enums matching src/types.ts exactly.
-- ============================================================

-- ---------- Extensions (required by citext columns below) ----------
create extension if not exists citext;

-- ---------- Enumerated domain states ----------
create type staff_role      as enum ('OWNER','MANAGER','SERVICE_ADVISOR','TECHNICIAN','CASHIER','INVENTORY_MANAGER','ACCOUNTANT');
create type price_type      as enum ('FIXED','STARTING_FROM','QUOTE_REQUIRED');
create type service_category as enum ('DETAILING_WASH','MECHANICAL_MAINTENANCE','BODY_RESTORATION','DIAGNOSTICS_ELECTRICAL','TYRES_ALIGNMENT','SPECIALITY_SERVICES');
create type bay_capability  as enum ('MECHANICAL','ALIGNMENT','DETAILING','BODYWORK','ELECTRICAL');
create type appt_status     as enum ('CONFIRMED','CHECKED_IN','CANCELLED','NO_SHOW','COMPLETED');
create type wo_status       as enum ('BOOKED','CHECKED_IN','INSPECTION','ESTIMATE','AWAITING_APPROVAL','APPROVED','IN_SERVICE','QUALITY_CHECK','READY','COMPLETED');
create type wo_service_status as enum ('PENDING','IN_PROGRESS','DONE');
create type wo_priority     as enum ('LOW','NORMAL','HIGH','URGENT');
create type inspect_status  as enum ('GOOD','ATTENTION','CRITICAL','NOT_CHECKED');
create type estimate_status as enum ('DRAFT','SENT','APPROVED','REJECTED');
create type movement_type   as enum ('PURCHASE','POS_SALE','WORK_ORDER','RETURN','ADJUSTMENT');
create type po_status       as enum ('DRAFT','ISSUED','RECEIVED','CANCELLED');
create type payment_status  as enum ('PENDING','PARTIAL','PAID','REFUNDED','VOID');
create type payment_method  as enum ('CASH','M_PESA','TIGO_PESA','AIRTEL_MONEY','CARD','BANK_TRANSFER');
create type expense_category as enum ('WORKSHOP_SUPPLIES','UTILITIES','SALARIES','EQUIPMENT_MAINTENANCE','MARKETING','OTHER');

-- ---------- Sequences (created BEFORE the RPCs that draw from them) ----------
create sequence if not exists pos_sale_seq start 1;
create sequence if not exists invoice_seq start 1000;
create sequence if not exists work_order_seq start 184;

-- ---------- Staff ----------
create table staff (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  full_name     text not null,
  role          staff_role not null,
  email         citext unique,
  phone         text,
  active        boolean not null default true,
  legacy_id     text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_staff_role on staff(role) where active;

-- ---------- Customers ----------
create table customers (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null check (length(full_name) between 2 and 120),
  phone         text not null,
  phone_digits  text generated always as (regexp_replace(phone, '[^0-9]', '', 'g')) stored,
  whatsapp      text,
  email         citext,
  notes         text,
  legacy_id     text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (phone_digits)
);
create index idx_customers_phone on customers(phone_digits);

-- ---------- Vehicles ----------
create table vehicles (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references customers(id) on delete restrict,
  registration_number text not null,
  reg_normalized      text generated always as (upper(regexp_replace(registration_number, '\\s+', ' ', 'g'))) stored,
  make                text not null default 'Vehicle',
  model               text not null default '',
  year                int check (year is null or year between 1950 and 2100),
  mileage_km          int check (mileage_km is null or mileage_km >= 0),
  last_service_date   date,
  vin                 text,
  color               text,
  legacy_id           text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (reg_normalized)
);
create index idx_vehicles_reg on vehicles(reg_normalized);
create index idx_vehicles_customer on vehicles(customer_id);

-- ---------- Services (canonical 20) ----------
create table services (
  id                      uuid primary key default gen_random_uuid(),
  number                  text not null unique,
  name                    text not null,
  description             text not null default '',
  category                service_category not null,
  price                   bigint not null check (price >= 0),
  price_type              price_type not null default 'FIXED',
  duration_minutes        int not null check (duration_minutes between 5 and 1440),
  booking_enabled         boolean not null default true,
  active                  boolean not null default true,
  featured                boolean not null default false,
  required_bay_capability bay_capability not null,
  includes                jsonb not null default '[]'::jsonb,
  legacy_id               text unique,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index idx_services_active on services(active, number);
create index idx_services_featured on services(featured) where active and featured;

-- ---------- Bays ----------
create table bays (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  capability    bay_capability not null,
  legacy_id     text unique,
  created_at    timestamptz not null default now()
);

-- ---------- Appointments ----------
create table appointments (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique,
  customer_id       uuid not null references customers(id) on delete restrict,
  vehicle_id        uuid not null references vehicles(id) on delete restrict,
  scheduled_date    date not null,
  scheduled_time    time not null,
  duration_minutes  int not null check (duration_minutes between 5 and 1440),
  status            appt_status not null default 'CONFIRMED',
  notes             text,
  idempotency_key   text unique,
  legacy_id         text unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_appt_date_time on appointments(scheduled_date, scheduled_time) where status <> 'CANCELLED';
create index idx_appt_customer on appointments(customer_id);
create index idx_appt_vehicle on appointments(vehicle_id);

create table appointment_services (
  appointment_id uuid not null references appointments(id) on delete cascade,
  service_id     uuid not null references services(id) on delete restrict,
  PRIMARY KEY (appointment_id, service_id)
);

-- ---------- Work orders (the operational spine) ----------
create table work_orders (
  id                  uuid primary key default gen_random_uuid(),
  work_order_number   text not null unique,
  appointment_id      uuid references appointments(id) on delete set null,
  customer_id         uuid not null references customers(id) on delete restrict,
  vehicle_id          uuid not null references vehicles(id) on delete restrict,
  status              wo_status not null default 'BOOKED',
  priority            wo_priority not null default 'NORMAL',
  assigned_technician uuid references staff(id) on delete set null,
  assigned_bay        uuid references bays(id) on delete set null,
  vehicle_mileage     int check (vehicle_mileage is null or vehicle_mileage >= 0),
  labor_cost          bigint not null default 0 check (labor_cost >= 0),
  parts_cost          bigint not null default 0 check (parts_cost >= 0),
  total_cost          bigint not null default 0 check (total_cost >= 0),
  notes               text,
  inspection_id       uuid,
  estimate_id         uuid,
  started_at          timestamptz,
  completed_at        timestamptz,
  legacy_id           text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_wo_status on work_orders(status);
create index idx_wo_vehicle on work_orders(vehicle_id);
create index idx_wo_customer on work_orders(customer_id);
create index idx_wo_tech on work_orders(assigned_technician) where assigned_technician is not null;

create table work_order_services (
  work_order_id uuid not null references work_orders(id) on delete cascade,
  service_id    uuid not null references services(id) on delete restrict,
  status        wo_service_status not null default 'PENDING',
  agreed_price  bigint not null check (agreed_price >= 0),
  PRIMARY KEY (work_order_id, service_id)
);

-- ---------- Inspections (DVI) ----------
create table inspections (
  id                  uuid primary key default gen_random_uuid(),
  work_order_id       uuid not null unique references work_orders(id) on delete cascade,
  technician          uuid references staff(id) on delete set null,
  overall_summary     text,
  overall_condition   inspect_status,
  recommendations     jsonb not null default '[]'::jsonb,
  legacy_id           text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table inspection_items (
  id            uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references inspections(id) on delete cascade,
  name          text not null,
  category      text,
  status        inspect_status not null default 'NOT_CHECKED',
  measurement   text,
  note          text,
  photo_url     text,
  display_order int not null default 0
);
create index idx_inspection_items on inspection_items(inspection_id, display_order);

-- ---------- Estimates ----------
create table estimates (
  id              uuid primary key default gen_random_uuid(),
  estimate_number text not null unique,
  work_order_id   uuid not null unique references work_orders(id) on delete cascade,
  status          estimate_status not null default 'DRAFT',
  subtotal        bigint not null default 0 check (subtotal >= 0),
  tax             bigint not null default 0 check (tax >= 0),
  total           bigint not null default 0 check (total >= 0),
  approved_at     timestamptz,
  legacy_id       text unique,
  created_at      timestamptz not null default now()
);

create table estimate_items (
  id          uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  description text not null,
  item_type   text not null check (item_type in ('SERVICE','PART','LABOUR')),
  quantity    int not null check (quantity > 0),
  unit_price  bigint not null check (unit_price >= 0),
  line_total  bigint not null check (line_total >= 0)
);

-- ---------- Inventory ----------
create table suppliers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  contact_person text,
  phone          text,
  email          citext,
  address        text,
  legacy_id      text unique,
  created_at     timestamptz not null default now()
);

create table inventory_products (
  id             uuid primary key default gen_random_uuid(),
  sku            text not null unique,
  part_number    text,
  name           text not null,
  category       text not null,
  cost_price     bigint not null check (cost_price >= 0),
  selling_price  bigint not null check (selling_price >= 0),
  current_stock  int not null default 0 check (current_stock >= 0),
  reorder_level  int not null default 0 check (reorder_level >= 0),
  unit           text not null default 'Piece',
  bin_location   text,
  supplier_id    uuid references suppliers(id) on delete set null,
  active         boolean not null default true,
  legacy_id      text unique,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_inventory_category on inventory_products(category) where active;
create index idx_inventory_low on inventory_products(current_stock) where current_stock <= reorder_level and active;

-- Parts fitted to work orders (placed here: references inventory_products).
create table work_order_parts (
  work_order_id uuid not null references work_orders(id) on delete cascade,
  product_id    uuid not null references inventory_products(id) on delete restrict,
  quantity      int not null check (quantity > 0),
  unit_price    bigint not null check (unit_price >= 0),
  PRIMARY KEY (work_order_id, product_id)
);

create table inventory_movements (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references inventory_products(id) on delete restrict,
  movement_type    movement_type not null,
  quantity_change  int not null,
  previous_stock   int not null,
  resulting_stock  int not null check (resulting_stock >= 0),
  reason           text not null,
  actor_staff_id   uuid references staff(id) on delete set null,
  reference_id     text,
  legacy_id        text unique,
  created_at       timestamptz not null default now()
);
create index idx_movements_product on inventory_movements(product_id, created_at desc);
create index idx_movements_type on inventory_movements(movement_type, created_at desc);

-- ---------- Purchasing ----------
create table purchase_orders (
  id           uuid primary key default gen_random_uuid(),
  po_number    text not null unique,
  supplier_id  uuid not null references suppliers(id) on delete restrict,
  status       po_status not null default 'DRAFT',
  total_cost   bigint not null default 0 check (total_cost >= 0),
  received_at  timestamptz,
  legacy_id    text unique,
  created_at   timestamptz not null default now()
);

create table purchase_order_items (
  id          uuid primary key default gen_random_uuid(),
  po_id       uuid not null references purchase_orders(id) on delete cascade,
  product_id  uuid not null references inventory_products(id) on delete restrict,
  quantity    int not null check (quantity > 0),
  cost_price  bigint not null check (cost_price >= 0),
  line_total  bigint not null check (line_total >= 0)
);

-- ---------- POS ----------
create table pos_sales (
  id               uuid primary key default gen_random_uuid(),
  sale_number      text not null unique,
  cashier_id       uuid references staff(id) on delete set null,
  customer_id      uuid references customers(id) on delete set null,
  vehicle_reg      text,
  subtotal         bigint not null check (subtotal >= 0),
  discount         bigint not null default 0 check (discount >= 0),
  total            bigint not null check (total >= 0),
  payment_method   payment_method not null,
  amount_tendered  bigint not null check (amount_tendered >= 0),
  change_given     bigint not null default 0 check (change_given >= 0),
  invoice_id       uuid,
  session_id       uuid,
  legacy_id        text unique,
  created_at       timestamptz not null default now()
);
create index idx_pos_sales_cashier on pos_sales(cashier_id, created_at desc);

create table pos_sale_items (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references pos_sales(id) on delete cascade,
  product_id  uuid references inventory_products(id) on delete set null,
  service_id  uuid references services(id) on delete set null,
  line_type   text not null check (line_type in ('SERVICE','PRODUCT')),
  name        text not null,
  quantity    int not null check (quantity > 0),
  unit_price  bigint not null check (unit_price >= 0),
  line_total  bigint not null check (line_total >= 0)
);

create table cashier_sessions (
  id                 uuid primary key default gen_random_uuid(),
  legacy_id          text unique,  -- full unique constraint: PostgREST upsert ON CONFLICT target
  cashier_id         uuid not null references staff(id) on delete restrict,
  opening_float      bigint not null default 0 check (opening_float >= 0),
  opened_at          timestamptz not null default now(),
  closed_at          timestamptz,
  status             text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  cash_total         bigint not null default 0 check (cash_total >= 0),
  mobile_money_total bigint not null default 0 check (mobile_money_total >= 0),
  card_total         bigint not null default 0 check (card_total >= 0),
  bank_total         bigint not null default 0 check (bank_total >= 0),
  total_sales        bigint not null default 0 check (total_sales >= 0),
  expected_cash      bigint not null default 0 check (expected_cash >= 0),
  counted_cash       bigint check (counted_cash is null or counted_cash >= 0),
  variance           bigint,
  notes              text
);
-- One open drawer per cashier at a time (closed sessions accumulate freely).
create unique index idx_cashier_open_session on cashier_sessions(cashier_id) where status = 'OPEN';

-- ---------- Invoices & payments ----------
create table invoices (
  id                uuid primary key default gen_random_uuid(),
  invoice_number    text not null unique,
  work_order_id     uuid references work_orders(id) on delete set null,
  pos_sale_id       uuid references pos_sales(id) on delete set null,
  customer_id       uuid references customers(id) on delete set null,
  vehicle_id        uuid references vehicles(id) on delete set null,
  subtotal          bigint not null check (subtotal >= 0),
  discount          bigint not null default 0 check (discount >= 0),
  tax               bigint not null default 0 check (tax >= 0),
  total             bigint not null check (total >= 0),
  amount_paid       bigint not null default 0 check (amount_paid >= 0),
  balance           bigint not null check (balance >= 0),
  payment_status    payment_status not null default 'PENDING',
  public_token      text not null unique default encode(gen_random_bytes(24), 'base64'),
  due_date          date,
  notes             text,
  legacy_id         text unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (amount_paid <= total or payment_status in ('PAID','REFUNDED'))
);

create table invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  description text not null,
  item_type   text not null check (item_type in ('SERVICE','PART','LABOUR')),
  quantity    int not null check (quantity > 0),
  unit_price  bigint not null check (unit_price >= 0),
  line_total  bigint not null check (line_total >= 0)
);
create index idx_invoice_items on invoice_items(invoice_id);

create table payments (
  id             uuid primary key default gen_random_uuid(),
  invoice_id     uuid not null references invoices(id) on delete restrict,
  amount         bigint not null check (amount > 0),
  method         payment_method not null,
  reference      text,
  received_by    uuid references staff(id) on delete set null,
  received_at    timestamptz not null default now(),
  reversed       boolean not null default false,
  legacy_id      text unique
);
create index idx_payments_invoice on payments(invoice_id) where not reversed;

-- ---------- Expenses ----------
create table expenses (
  id             uuid primary key default gen_random_uuid(),
  category       expense_category not null,
  description    text not null,
  amount         bigint not null check (amount > 0),
  method         payment_method not null,
  reference      text,
  recorded_by    uuid references staff(id) on delete set null,
  expense_date   date not null default current_date,
  legacy_id      text unique,
  created_at     timestamptz not null default now()
);
create index idx_expenses_date on expenses(expense_date desc);

-- ---------- Audit log (append-only) ----------
create table audit_logs (
  id           bigint generated always as identity primary key,
  actor_staff_id   uuid references staff(id) on delete set null,
  actor_label      text not null,
  actor_role       staff_role,
  action       text not null,
  entity_type  text not null,
  entity_id    text not null,
  details      text,
  old_value    jsonb,
  new_value    jsonb,
  created_at   timestamptz not null default now()
);
create index idx_audit_time on audit_logs(created_at desc);
create index idx_audit_entity on audit_logs(entity_type, entity_id);

-- ---------- Business settings (single row) ----------
create table business_settings (
  id                    int primary key default 1 check (id = 1),
  business_name         text not null default 'Hunter Autoworks',
  tagline               text not null default 'The Car Lab',
  address               text not null default 'Kinondoni Morocco, BLOCK 41',
  block                 text not null default 'Block 41',
  city                  text not null default 'Dar es Salaam',
  phones                jsonb not null default '[]'::jsonb,
  whatsapp_numbers      jsonb not null default '[]'::jsonb,
  instagram             text not null default '',
  operating_hours       jsonb not null default '{}'::jsonb,
  enable_online_booking boolean not null default true,
  tax_rate_percent      numeric(5,2) not null default 0 check (tax_rate_percent between 0 and 100),
  currency              text not null default 'TZS',
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — defense in depth.
-- The Express API uses the service-role key (bypasses RLS) and enforces
-- RBAC; RLS protects against direct anon/authenticated PostgREST access
-- with the publishable key.
-- ============================================================
alter table staff               enable row level security;
alter table customers           enable row level security;
alter table vehicles            enable row level security;
alter table services            enable row level security;
alter table bays                enable row level security;
alter table appointments        enable row level security;
alter table appointment_services enable row level security;
alter table work_orders         enable row level security;
alter table work_order_services enable row level security;
alter table work_order_parts    enable row level security;
alter table inspections         enable row level security;
alter table inspection_items    enable row level security;
alter table estimates           enable row level security;
alter table estimate_items      enable row level security;
alter table suppliers           enable row level security;
alter table inventory_products  enable row level security;
alter table inventory_movements enable row level security;
alter table purchase_orders     enable row level security;
alter table purchase_order_items enable row level security;
alter table pos_sales           enable row level security;
alter table pos_sale_items      enable row level security;
alter table cashier_sessions    enable row level security;
alter table invoices            enable row level security;
alter table invoice_items       enable row level security;
alter table payments            enable row level security;
alter table expenses            enable row level security;
alter table audit_logs          enable row level security;
alter table business_settings   enable row level security;

-- Public (anon) direct reads were REMOVED 2026-09-13 (security hardening):
-- the browser client never queries tables directly (Auth only), so anon-read
-- policies on services/business_settings were pure attack surface. The public
-- API serves the catalogue/business info via the Express layer (see migration
-- 20260913110000_rls_tighten_public_reads.sql).

-- Authenticated staff read business data via the API (service role); direct
-- PostgREST access with a user token is limited to their own linked record.
create policy staff_self_read on staff for select to authenticated
  using (auth_user_id = auth.uid());

-- Everything else: no anon/authenticated policies → direct access denied.
-- (Server access uses the service-role connection, which bypasses RLS.)

-- RPC hardening: hunter_* RPCs default to PUBLIC EXECUTE, which would let
-- anon/authenticated PostgREST clients call them directly and bypass the API's
-- RBAC. They are revoked from public/anon/authenticated and granted ONLY to
-- service_role AFTER all functions are created (end of this file).

-- ---------- updated_at trigger ----------
create or replace function hunter_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_staff_touch before update on staff for each row execute function hunter_touch_updated_at();
create trigger trg_customers_touch before update on customers for each row execute function hunter_touch_updated_at();
create trigger trg_vehicles_touch before update on vehicles for each row execute function hunter_touch_updated_at();
create trigger trg_services_touch before update on services for each row execute function hunter_touch_updated_at();
create trigger trg_appt_touch before update on appointments for each row execute function hunter_touch_updated_at();
create trigger trg_wo_touch before update on work_orders for each row execute function hunter_touch_updated_at();
create trigger trg_inv_touch before update on inventory_products for each row execute function hunter_touch_updated_at();
create trigger trg_invoices_touch before update on invoices for each row execute function hunter_touch_updated_at();

-- ---------- Sequence normalization (run AFTER data migration, idempotent) ----------
-- Guarantees the next drawn number is beyond any existing row. Critical when
-- migrated rows already occupy numbers at or above the sequence start.
select setval('work_order_seq',
  greatest(184, coalesce((select max(substring(work_order_number from '[0-9]+$')::bigint) from work_orders), 184)), true);
select setval('invoice_seq',
  greatest(1000, coalesce((select max(substring(invoice_number from '[0-9]+$')::bigint) from invoices), 999)), true);
select setval('pos_sale_seq',
  coalesce((select max(substring(sale_number from '[0-9]+$')::bigint) from pos_sales), 1), true);

-- ============================================================
-- TRANSACTIONAL DOMAIN RPCs (server-authoritative core paths)
-- These are called by the repository layer with the service role so that
-- critical business operations are atomic INSIDE the database.
-- ============================================================

-- POS checkout: validates stock, resolves authoritative prices, deducts
-- stock, writes the sale + invoice + payment + movements in ONE transaction.
create or replace function hunter_pos_checkout(
  p_items             jsonb,      -- [{ id, type: 'SERVICE'|'PRODUCT', quantity }]
  p_payment_method    payment_method,
  p_amount_tendered   bigint,
  p_cashier_id        uuid default null,
  p_customer_id       uuid default null,
  p_vehicle_reg       text default null,
  p_discount          bigint default 0
) returns jsonb
language plpgsql
as $$
declare
  v_subtotal   bigint := 0;
  v_discount   bigint := greatest(0, p_discount);
  v_total      bigint;
  v_sale_id    uuid;
  v_invoice_id uuid;
  v_sale_no    text;
  v_inv_no     text;
  v_item       jsonb;
  v_prod       record;
  v_svc        record;
  v_line_total bigint;
  v_new_stock  int;
  v_prev_stock int;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'CART_EMPTY';
  end if;

  -- Resolve authoritative prices and validate stock
  for v_item in select * from jsonb_array_elements(p_items) loop
    if v_item->>'type' = 'PRODUCT' then
      select * into v_prod from inventory_products where id = (v_item->>'id')::uuid for update;
      if not found then raise exception 'PRODUCT_NOT_FOUND:%', v_item->>'id'; end if;
      if v_prod.current_stock < (v_item->>'quantity')::int then
        raise exception 'INSUFFICIENT_STOCK:%:%', v_prod.sku, v_prod.current_stock;
      end if;
      v_line_total := v_prod.selling_price * (v_item->>'quantity')::int;
      v_subtotal := v_subtotal + v_line_total;
    elsif v_item->>'type' = 'SERVICE' then
      select * into v_svc from services where id = (v_item->>'id')::uuid and active for update;
      if not found then raise exception 'SERVICE_NOT_FOUND:%', v_item->>'id'; end if;
      v_line_total := v_svc.price * (v_item->>'quantity')::int;
      v_subtotal := v_subtotal + v_line_total;
    else
      raise exception 'BAD_ITEM_TYPE';
    end if;
  end loop;

  v_total := greatest(0, v_subtotal - v_discount);
  if p_amount_tendered < v_total then
    raise exception 'UNDERPAYMENT:%:%', p_amount_tendered, v_total;
  end if;

  select format('POS-%s-%s', to_char(now(),'YYYY'), lpad(nextval('pos_sale_seq')::text, 5, '0')) into v_sale_no;
  insert into pos_sales (sale_number, cashier_id, customer_id, vehicle_reg, subtotal, discount, total, payment_method, amount_tendered, change_given)
  values (v_sale_no, p_cashier_id, p_customer_id, upper(coalesce(p_vehicle_reg,'')), v_subtotal, v_discount, v_total, p_payment_method, p_amount_tendered, p_amount_tendered - v_total)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if v_item->>'type' = 'PRODUCT' then
      select * into v_prod from inventory_products where id = (v_item->>'id')::uuid for update;
      v_prev_stock := v_prod.current_stock;
      v_new_stock := v_prev_stock - (v_item->>'quantity')::int;
      update inventory_products set current_stock = v_new_stock where id = v_prod.id;
      insert into pos_sale_items (sale_id, product_id, line_type, name, quantity, unit_price, line_total)
      values (v_sale_id, v_prod.id, 'PRODUCT', v_prod.name, (v_item->>'quantity')::int, v_prod.selling_price, v_prod.selling_price * (v_item->>'quantity')::int);
      insert into inventory_movements (product_id, movement_type, quantity_change, previous_stock, resulting_stock, reason, actor_staff_id, reference_id)
      values (v_prod.id, 'POS_SALE', -((v_item->>'quantity')::int), v_prev_stock, v_new_stock, 'POS ' || v_sale_no, p_cashier_id, v_sale_no);
    else
      select * into v_svc from services where id = (v_item->>'id')::uuid;
      insert into pos_sale_items (sale_id, service_id, line_type, name, quantity, unit_price, line_total)
      values (v_sale_id, v_svc.id, 'SERVICE', v_svc.name, (v_item->>'quantity')::int, v_svc.price, v_svc.price * (v_item->>'quantity')::int);
    end if;
  end loop;

  -- Receipt invoice (paid in full at the counter)
  select format('HA-%s-%s', to_char(now(),'YYYY'), lpad(nextval('invoice_seq')::text, 6, '0')) into v_inv_no;
  insert into invoices (invoice_number, pos_sale_id, customer_id, subtotal, discount, tax, total, amount_paid, balance, payment_status, due_date)
  values (v_inv_no, v_sale_id, p_customer_id, v_subtotal, v_discount, 0, v_total, v_total, 0, 'PAID', current_date)
  returning id into v_invoice_id;

  insert into invoice_items (invoice_id, description, item_type, quantity, unit_price, line_total)
  select v_invoice_id, name,
         case line_type when 'PRODUCT' then 'PART' else line_type end,
         quantity, unit_price, line_total
  from pos_sale_items where sale_id = v_sale_id;

  insert into payments (invoice_id, amount, method, reference, received_by)
  values (v_invoice_id, v_total, p_payment_method, v_sale_no, p_cashier_id);

  update pos_sales set invoice_id = v_invoice_id where id = v_sale_id;

  -- Cashier session accumulation
  update cashier_sessions
  set total_sales = total_sales + v_total,
      cash_total = cash_total + case when p_payment_method = 'CASH' then v_total else 0 end,
      mobile_money_total = mobile_money_total + case when p_payment_method in ('M_PESA','TIGO_PESA','AIRTEL_MONEY') then v_total else 0 end,
      card_total = card_total + case when p_payment_method = 'CARD' then v_total else 0 end,
      bank_total = bank_total + case when p_payment_method = 'BANK_TRANSFER' then v_total else 0 end,
      expected_cash = opening_float + cash_total + case when p_payment_method = 'CASH' then v_total else 0 end
  where status = 'OPEN' and cashier_id = p_cashier_id;

  return jsonb_build_object('saleId', v_sale_id, 'saleNumber', v_sale_no, 'invoiceId', v_invoice_id, 'invoiceNumber', v_inv_no, 'total', v_total, 'change', p_amount_tendered - v_total);
end $$;

-- Booking creation: validates slot against capacity + duration, idempotent.
create or replace function hunter_create_appointment(
  p_customer_name   text,
  p_phone           text,
  p_registration    text,
  p_service_ids     uuid[],
  p_scheduled_date  date,
  p_scheduled_time  time,
  p_whatsapp        text default null,
  p_make            text default 'Vehicle',
  p_model           text default '',
  p_year            int default null,
  p_mileage         int default null,
  p_notes           text default null,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
as $$
declare
  v_customer_id uuid;
  v_vehicle_id  uuid;
  v_appt_id     uuid;
  v_wo_id       uuid;
  v_wo_number   text;
  v_duration    int := 0;
  v_reference   text;
  v_existing    appointments;
  v_concurrent  int;
begin
  -- Idempotency: return the original booking for a retried submission
  if p_idempotency_key is not null then
    select * into v_existing from appointments where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('appointmentId', v_existing.id, 'reference', v_existing.reference, 'duplicate', true);
    end if;
  end if;

  -- Business hours & published slot validation
  if p_scheduled_time not in ('08:30','09:30','10:30','11:30','12:30','14:00','15:00','16:00','17:00') then
    raise exception 'SLOT_UNAVAILABLE';
  end if;
  if p_scheduled_date < current_date then
    raise exception 'DATE_IN_PAST';
  end if;

  -- Capacity correctness under concurrency (Phase D): serialize attempts on
  -- the SAME slot only. Transaction-scoped lock held until COMMIT/ROLLBACK.
  perform pg_advisory_xact_lock(
    hashtext('hunter_appointment_slot')::bigint * 1000000000
    + hashtext(p_scheduled_date::text || ' ' || p_scheduled_time::text)::bigint
  );

  select sum(duration_minutes) into v_duration from services where id = any(p_service_ids) and active and booking_enabled;
  if v_duration is null then raise exception 'NO_VALID_SERVICES'; end if;

  -- Capacity: at most 4 concurrent jobs per published slot (matches availability rules)
  select count(*) into v_concurrent from appointments
  where scheduled_date = p_scheduled_date and scheduled_time = p_scheduled_time and status <> 'CANCELLED';
  if v_concurrent >= 4 then raise exception 'SLOT_FULL'; end if;

  -- Customer + vehicle upserts (no fabricated facts)
  insert into customers (full_name, phone, whatsapp)
  values (p_customer_name, p_phone, coalesce(p_whatsapp, p_phone))
  on conflict (phone_digits) do update set full_name = excluded.full_name, whatsapp = coalesce(excluded.whatsapp, customers.whatsapp)
  returning id into v_customer_id;

  insert into vehicles (customer_id, registration_number, make, model, year, mileage_km)
  values (v_customer_id, p_registration, p_make, p_model, p_year, p_mileage)
  on conflict (reg_normalized) do update set
    customer_id = excluded.customer_id,
    make = coalesce(nullif(excluded.make, ''), vehicles.make),
    model = coalesce(excluded.model, vehicles.model),
    year = coalesce(excluded.year, vehicles.year),
    mileage_km = coalesce(excluded.mileage_km, vehicles.mileage_km)
  returning id into v_vehicle_id;

  select format('HA-APT-%s', lpad((1000 + floor(random()*9000))::int::text, 4, '0')) into v_reference;
  insert into appointments (reference, customer_id, vehicle_id, scheduled_date, scheduled_time, duration_minutes, notes, idempotency_key)
  values (v_reference, v_customer_id, v_vehicle_id, p_scheduled_date, p_scheduled_time, v_duration, p_notes, p_idempotency_key)
  returning id into v_appt_id;

  insert into appointment_services (appointment_id, service_id)
  select v_appt_id, s.id from services s where s.id = any(p_service_ids);

  -- Work order: bookings immediately become the operational spine (domain parity:
  -- the JSON store creates the WO at booking time; the WO number is reserved).
  select format('HA-WO-%s', lpad(nextval('work_order_seq')::text, 6, '0')) into v_wo_number;
  insert into work_orders (work_order_number, appointment_id, customer_id, vehicle_id, status, vehicle_mileage, notes)
  values (v_wo_number, v_appt_id, v_customer_id, v_vehicle_id, 'BOOKED', p_mileage, p_notes)
  returning id into v_wo_id;

  -- Copy chosen services onto the work order at list price (advisors adjust later).
  insert into work_order_services (work_order_id, service_id, status, agreed_price)
  select v_wo_id, s.id, 'PENDING', s.price from services s where s.id = any(p_service_ids);

  return jsonb_build_object(
    'appointmentId', v_appt_id, 'reference', v_reference, 'duplicate', false,
    'durationMinutes', v_duration, 'workOrderId', v_wo_id, 'workOrderNumber', v_wo_number
  );
end $$;

-- Stock adjustment: atomic, refuses negative stock, writes the movement.
create or replace function hunter_adjust_stock(
  p_product_id uuid,
  p_delta      int,
  p_reason     text,
  p_actor_id   uuid default null
) returns jsonb
language plpgsql
as $$
declare
  v_prod record;
  v_new  int;
begin
  select * into v_prod from inventory_products where id = p_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  v_new := v_prod.current_stock + p_delta;
  if v_new < 0 then raise exception 'INSUFFICIENT_STOCK:%:%', v_prod.sku, v_prod.current_stock; end if;
  update inventory_products set current_stock = v_new where id = p_product_id;
  insert into inventory_movements (product_id, movement_type, quantity_change, previous_stock, resulting_stock, reason, actor_staff_id)
  values (p_product_id, 'ADJUSTMENT', p_delta, v_prod.current_stock, v_new, p_reason, p_actor_id);
  return jsonb_build_object('productId', p_product_id, 'stock', v_new);
end $$;

-- Audit write helper (server-side only)
create or replace function hunter_log_audit(
  p_actor_id    uuid,
  p_actor_label text,
  p_actor_role  staff_role,
  p_action      text,
  p_entity_type text,
  p_entity_id   text,
  p_details     text default null,
  p_old         jsonb default null,
  p_new         jsonb default null
) returns void
language sql
as $$
  insert into audit_logs (actor_staff_id, actor_label, actor_role, action, entity_type, entity_id, details, old_value, new_value)
  values (p_actor_id, p_actor_label, p_actor_role, p_action, p_entity_type, p_entity_id, p_details, p_old, p_new);
$$;

-- Inspection (DVI) save: upserts the one-per-work-order header and atomically
-- replaces its item checklist. Accepts the domain report shape from the app.
create or replace function hunter_save_inspection(
  p_report jsonb
) returns jsonb
language plpgsql
as $$
declare
  v_wo      work_orders;
  v_insp_id uuid;
  v_item    jsonb;
  v_status  inspect_status;
  v_i       int := 0;
begin
  -- Work order referenced by number, legacy id or uuid
  select * into v_wo from work_orders
  where work_order_number = upper(coalesce(p_report->>'workOrderId', ''))
     or legacy_id         = coalesce(p_report->>'workOrderId', '')
     or id::text          = coalesce(p_report->>'workOrderId', '')
  for update;
  if not found then raise exception 'WORK_ORDER_NOT_FOUND'; end if;

  insert into inspections (work_order_id, overall_summary, overall_condition, recommendations)
  values (
    v_wo.id,
    p_report->>'overallSummary',
    nullif(p_report->>'overallCondition', '')::inspect_status,
    coalesce(p_report->'recommendations', '[]'::jsonb)
  )
  on conflict (work_order_id) do update set
    overall_summary   = excluded.overall_summary,
    overall_condition = excluded.overall_condition,
    recommendations   = excluded.recommendations,
    updated_at        = now()
  returning id into v_insp_id;

  delete from inspection_items where inspection_id = v_insp_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_report->'items', '[]'::jsonb)) loop
    v_i := v_i + 1;
    begin
      v_status := coalesce(nullif(v_item->>'status', ''), nullif(v_item->>'condition', ''))::inspect_status;
    exception when invalid_text_representation then
      v_status := 'NOT_CHECKED';
    end;
    if v_status is null then v_status := 'NOT_CHECKED'; end if;

    insert into inspection_items
      (inspection_id, name, category, status, measurement, note, photo_url, display_order)
    values (
      v_insp_id,
      coalesce(nullif(v_item->>'name', ''), 'Unnamed item'),
      v_item->>'category',
      v_status,
      v_item->>'measurement',
      coalesce(nullif(v_item->>'note', ''), nullif(v_item->>'notes', '')),
      v_item->>'photoUrl',
      coalesce((v_item->>'displayOrder')::int, v_i)
    );
  end loop;

  return jsonb_build_object('inspectionId', v_insp_id, 'workOrderId', v_wo.id, 'itemCount', v_i);
end $$;

-- ============================================================
-- RPC EXECUTION HARDENING (applied after function creation)
-- Only the service role — used by the Express API server — may execute
-- the transactional hunter_* RPCs. Direct PostgREST calls with the anon
-- or an authenticated user token are rejected.
-- ============================================================
revoke execute on function hunter_pos_checkout(jsonb, payment_method, bigint, uuid, uuid, text, bigint) from public, anon, authenticated;
revoke execute on function hunter_create_appointment(text, text, text, uuid[], date, time, text, text, text, int, int, text, text) from public, anon, authenticated;
revoke execute on function hunter_adjust_stock(uuid, int, text, uuid) from public, anon, authenticated;
revoke execute on function hunter_log_audit(uuid, text, staff_role, text, text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function hunter_save_inspection(jsonb) from public, anon, authenticated;
grant execute on function hunter_pos_checkout(jsonb, payment_method, bigint, uuid, uuid, text, bigint) to service_role;
grant execute on function hunter_create_appointment(text, text, text, uuid[], date, time, text, text, text, int, int, text, text) to service_role;
grant execute on function hunter_adjust_stock(uuid, int, text, uuid) to service_role;
grant execute on function hunter_log_audit(uuid, text, staff_role, text, text, text, text, jsonb, jsonb) to service_role;
grant execute on function hunter_save_inspection(jsonb) to service_role;
