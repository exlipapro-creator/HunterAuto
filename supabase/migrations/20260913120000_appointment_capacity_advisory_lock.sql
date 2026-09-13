-- ============================================================
-- HUNTER AUTOWORKS — CORRECTIVE MIGRATION #4 (live remediation)
-- 20260913120000_appointment_capacity_advisory_lock.sql
--
-- Defect (proven by Phase D load testing, artifacts/security/phase-d-load.mjs):
-- under real concurrent contention, 8 simultaneous bookings with distinct
-- idempotency keys against one capacity-4 slot produced 5 confirmed bookings
-- (authoritative DB count: 5). Root cause: hunter_create_appointment uses a
-- check-then-insert capacity test (SELECT count(*) ... then INSERT); two
-- concurrent transactions both count 3 in their READ COMMITTED snapshots and
-- both insert. A plain UNIQUE constraint cannot express "at most 4 per slot".
--
-- Fix: serialize booking attempts per (scheduled_date, scheduled_time) slot
-- with a TRANSACTION-SCOPED advisory lock taken BEFORE the capacity count and
-- held until COMMIT. pg_advisory_xact_lock releases automatically at commit/
-- rollback (no leak on any exit path, including exceptions). Lock key:
-- hashtext('hunter_appointment_slot') * large + hashtext(date||time), stable
-- and collision-safe across slots.
--
-- Impact: bookings for DIFFERENT slots never block each other; only attempts
-- on the SAME slot serialize for the (sub-millisecond) remainder of the
-- booking transaction. The idempotency check stays OUTSIDE the lock (replays
-- of an existing key return immediately without acquiring it), and the
-- unique idempotency_key constraint remains the DB-level backstop.
--
-- Idempotent: re-running recreates the identical function (create or replace).
-- No table, column, or data changes. RLS and grants are untouched.
--
-- YOU (the Owner) run this in: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ============================================================

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
  -- Idempotency: return the original booking for a retried submission.
  -- Kept BEFORE the advisory lock: replays must not queue behind new bookings.
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

  -- Capacity correctness under concurrency: serialize attempts on the SAME
  -- slot only. The transaction-scoped lock is held until COMMIT/ROLLBACK, so
  -- the count-then-insert below can no longer interleave for this slot.
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

-- ---------- Post-apply verification (output of this script itself) ----------
select proname, prosecdef as security_definer
from pg_proc
where proname = 'hunter_create_appointment';
