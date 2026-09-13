-- ============================================================
-- HUNTER AUTOWORKS — FINAL PRODUCTION AUTH LINKING
-- Real identities (2026-09-13):
--   OWNER    "Hunter"    f7e1d133-c4fa-4823-8754-99a16d9e9f10
--   MANAGER  "Mohammed"  a76c2df9-b072-4cfb-9dd4-fc1ab70718d8
--
-- Run in: Supabase Dashboard -> SQL Editor (whole file, once).
--
-- Behavior:
--   * Verifies both Auth UUIDs exist in Supabase Auth.
--   * Locates the single ACTIVE OWNER and single ACTIVE MANAGER staff
--     records and renames them in place to the real identities
--     (no staff rows created or deleted; all historical references
--     in work_orders / invoices / audit_logs stay intact because they
--     point at the row ids, which never change).
--   * Refuses to run if: a UUID is already linked to a DIFFERENT staff
--     row, a target row is linked to a DIFFERENT Auth user, another
--     staff row already holds the target email, or the active-row
--     count is not exactly 1 per role (ambiguous state).
--   * Everything runs in ONE transaction: any failure aborts the whole
--     script and leaves the database exactly as it was (no half-links).
--   * Safe to re-run after success (idempotent no-op).
--   * Prints the final verification table.
-- ============================================================

begin;

do $$
declare
  v_owner_auth   uuid := 'f7e1d133-c4fa-4823-8754-99a16d9e9f10';
  v_manager_auth uuid := 'a76c2df9-b072-4cfb-9dd4-fc1ab70718d8';
  v_owner_row    uuid;
  v_manager_row  uuid;
  v_conflict     uuid;
  v_current_link uuid;
  v_count        int;
begin
  -- ---------- Guard 0: the two UUIDs must be distinct ----------
  if v_owner_auth = v_manager_auth then
    raise exception 'Owner and Manager Auth UUIDs must be different.';
  end if;

  -- ---------- Guard 1: both Auth identities exist ----------
  select count(*) into v_count
  from auth.users
  where id in (v_owner_auth, v_manager_auth);
  if v_count <> 2 then
    raise exception 'Auth identity check failed: expected 2 existing Auth users, found %. Create them in Dashboard -> Authentication first.', v_count;
  end if;

  -- ---------- Guard 2: exactly one ACTIVE OWNER staff record ----------
  select count(*) into v_count from staff where role = 'OWNER' and active;
  if v_count <> 1 then
    raise exception 'Expected exactly one ACTIVE OWNER staff record, found %. Refusing ambiguous linkage.', v_count;
  end if;
  select id into v_owner_row from staff where role = 'OWNER' and active;

  -- ---------- Guard 3: exactly one ACTIVE MANAGER staff record ----------
  select count(*) into v_count from staff where role = 'MANAGER' and active;
  if v_count <> 1 then
    raise exception 'Expected exactly one ACTIVE MANAGER staff record, found %. Refusing ambiguous linkage.', v_count;
  end if;
  select id into v_manager_row from staff where role = 'MANAGER' and active;

  -- ---------- Guard 4: neither Auth UUID is linked to a DIFFERENT staff row ----------
  select id into v_conflict from staff
  where auth_user_id = v_owner_auth and id <> v_owner_row;
  if v_conflict is not null then
    raise exception 'Owner Auth UUID is already linked to another staff row (%).', v_conflict;
  end if;

  select id into v_conflict from staff
  where auth_user_id = v_manager_auth and id <> v_manager_row;
  if v_conflict is not null then
    raise exception 'Manager Auth UUID is already linked to another staff row (%).', v_conflict;
  end if;

  -- ---------- Guard 5: target rows are not linked to a DIFFERENT Auth user ----------
  -- (NULL = unlinked, fine; same UUID = idempotent re-run, fine; anything else = refuse)
  select auth_user_id into v_current_link from staff where id = v_owner_row;
  if v_current_link is not null and v_current_link <> v_owner_auth then
    raise exception 'OWNER staff record is already linked to a different Auth user (%).', v_current_link;
  end if;

  select auth_user_id into v_current_link from staff where id = v_manager_row;
  if v_current_link is not null and v_current_link <> v_manager_auth then
    raise exception 'MANAGER staff record is already linked to a different Auth user (%).', v_current_link;
  end if;

  -- ---------- Guard 6: target emails are not held by another staff row ----------
  select count(*) into v_count from staff
  where email = 'hunter@hunterautoworks.co.tz' and id <> v_owner_row;
  if v_count > 0 then
    raise exception 'Another staff row already uses hunter@hunterautoworks.co.tz.';
  end if;

  select count(*) into v_count from staff
  where email = 'mohammed@hunterautoworks.co.tz' and id <> v_manager_row;
  if v_count > 0 then
    raise exception 'Another staff row already uses mohammed@hunterautoworks.co.tz.';
  end if;

  -- ---------- Perform the links (in place; ids unchanged; history intact) ----------
  update staff
  set full_name = 'Hunter',
      email = 'hunter@hunterautoworks.co.tz',
      auth_user_id = v_owner_auth
  where id = v_owner_row;

  update staff
  set full_name = 'Mohammed',
      email = 'mohammed@hunterautoworks.co.tz',
      auth_user_id = v_manager_auth
  where id = v_manager_row;

  -- ---------- Post-conditions (any failure aborts the whole transaction) ----------
  if not exists (
    select 1 from staff
    where role = 'OWNER' and active
      and auth_user_id = v_owner_auth
      and full_name = 'Hunter'
      and email = 'hunter@hunterautoworks.co.tz'
  ) then
    raise exception 'Post-condition failed: OWNER record not correctly linked after update.';
  end if;

  if not exists (
    select 1 from staff
    where role = 'MANAGER' and active
      and auth_user_id = v_manager_auth
      and full_name = 'Mohammed'
      and email = 'mohammed@hunterautoworks.co.tz'
  ) then
    raise exception 'Post-condition failed: MANAGER record not correctly linked after update.';
  end if;

  -- Exactly one linked record per role (no duplicates created)
  select count(*) into v_count from staff where role = 'OWNER' and auth_user_id = v_owner_auth;
  if v_count <> 1 then
    raise exception 'Post-condition failed: OWNER Auth UUID linked to % rows.', v_count;
  end if;
  select count(*) into v_count from staff where role = 'MANAGER' and auth_user_id = v_manager_auth;
  if v_count <> 1 then
    raise exception 'Post-condition failed: MANAGER Auth UUID linked to % rows.', v_count;
  end if;

  raise notice 'Linked 2 production staff records (Hunter/OWNER, Mohammed/MANAGER). All historical references preserved.';
end $$;

-- ---------- Final verification table ----------
select
  full_name,
  role,
  active,
  email,
  auth_user_id,
  case when auth_user_id is not null then 'LINKED' else 'UNLINKED' end as status
from staff
where role in ('OWNER', 'MANAGER')
order by case role when 'OWNER' then 0 else 1 end;

-- Cross-check: linked identities must exist in Supabase Auth with matching emails
select
  s.full_name,
  s.role,
  u.email as auth_email,
  (s.email = u.email) as email_matches_auth,
  (u.email_confirmed_at is not null) as auth_confirmed
from staff s
join auth.users u on u.id = s.auth_user_id
where s.role in ('OWNER', 'MANAGER')
order by case s.role when 'OWNER' then 0 else 1 end;

commit;
