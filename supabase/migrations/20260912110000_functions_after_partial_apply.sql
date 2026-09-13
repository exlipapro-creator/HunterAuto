-- ============================================================
-- HUNTER AUTOWORKS — CORRECTIVE MIGRATION (live remediation)
-- 20260912110000_functions_after_partial_apply.sql
--
-- WHY THIS EXISTS
-- The live project already has the 28 tables (an earlier SQL-editor run
-- applied the file up to its then-defective revoke-before-create line,
-- which aborted there). Sequences, the updated_at trigger function, all
-- five transactional RPCs and their service-role grants were never
-- created. Re-running the full migration would collide with the existing
-- tables. This corrective file extracts — byte-identical in behaviour —
-- exactly the missing tail of 20260912000001_hunter_core_schema.sql:
--   1. sequences (before the RPCs that call nextval() on them)
--   2. updated_at trigger function + table triggers
--   3. the five transactional hunter_* RPCs
--   4. RPC execution hardening (revoke public/anon/authenticated,
--      grant service_role) AFTER function creation
-- Idempotent: every statement is CREATE ... IF NOT EXISTS / OR REPLACE /
-- idempotent GRANT/REVOKE, so re-running is safe.
-- ============================================================

-- ---------- 1. Sequences ----------
create sequence if not exists pos_sale_seq start 1;
create sequence if not exists invoice_seq start 1000;
create sequence if not exists work_order_seq start 184;

-- ---------- 2. updated_at trigger ----------
create or replace function hunter_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- (drop-if-exists guards make this migration replayable from an empty
-- database; the core schema already defines these triggers, but this file was
-- originally written to repair a partially-applied production state)
drop trigger if exists trg_staff_touch on staff;
create trigger trg_staff_touch before update on staff for each row execute function hunter_touch_updated_at();
drop trigger if exists trg_customers_touch on customers;
create trigger trg_customers_touch before update on customers for each row execute function hunter_touch_updated_at();
drop trigger if exists trg_vehicles_touch on vehicles;
create trigger trg_vehicles_touch before update on vehicles for each row execute function hunter_touch_updated_at();
drop trigger if exists trg_services_touch on services;
create trigger trg_services_touch before update on services for each row execute function hunter_touch_updated_at();
drop trigger if exists trg_appt_touch on appointments;
create trigger trg_appt_touch before update on appointments for each row execute function hunter_touch_updated_at();
drop trigger if exists trg_wo_touch on work_orders;
create trigger trg_wo_touch before update on work_orders for each row execute function hunter_touch_updated_at();
drop trigger if exists trg_inv_touch on inventory_products;
create trigger trg_inv_touch before update on inventory_products for each row execute function hunter_touch_updated_at();
drop trigger if exists trg_invoices_touch on invoices;
create trigger trg_invoices_touch before update on invoices for each row execute function hunter_touch_updated_at();

-- ---------- 3. Transactional domain RPCs ----------
-- (bodies identical to 20260912000001_hunter_core_schema.sql)

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

-- ---------- 4. RPC EXECUTION HARDENING (after function creation) ----------
-- Only the service role — used by the Express API server — may execute
-- the transactional hunter_* RPCs. Direct PostgREST calls with the anon
-- or an authenticated user token are rejected.
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
