-- ============================================================
-- HUNTER AUTOWORKS — STAFF AUTH LINKING (run AFTER creating the
-- two real Auth users in the Dashboard)
-- 20260912140000_link_staff_auth.sql
--
-- YOU (the Owner) run this in: Supabase Dashboard -> SQL Editor.
-- Replace exactly the two UUIDs below with the Auth UUIDs shown in
-- Dashboard -> Authentication -> Users for juma@… and denis@….
-- Nothing else in this script needs editing.
--
-- Safety properties:
--   * validates the UUIDs are well-formed and distinct
--   * refuses to link an auth id that is already attached to ANOTHER staff row
--     (prevents accidental reassignment / duplicate linkage)
--   * refuses to run if the target staff rows are not exactly the expected
--     Owner/Manager records (by email + role)
--   * keeps the last-active-OWNER invariant (both rows stay active)
--   * prints a verification table at the end
-- ============================================================

\set owner_auth_uuid '''REPLACE_WITH_OWNER_AUTH_UUID'''
\set manager_auth_uuid '''REPLACE_WITH_MANAGER_AUTH_UUID'''

do $$
declare
  v_owner_auth  text := :'owner_auth_uuid';
  v_manager_auth text := :'manager_auth_uuid';
  v_owner_row   uuid;
  v_manager_row uuid;
  v_conflict    uuid;
begin
  -- -- Guard: UUID shape
  if v_owner_auth !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_manager_auth !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Replace REPLACE_WITH_OWNER_AUTH_UUID / REPLACE_WITH_MANAGER_AUTH_UUID with the real Auth UUIDs first.';
  end if;
  if lower(v_owner_auth) = lower(v_manager_auth) then
    raise exception 'The two Auth UUIDs must be different.';
  end if;

  -- -- Guard: target staff rows exist and are the expected roles
  select id into v_owner_row from staff where email = 'juma@hunterautoworks.co.tz' and role = 'OWNER';
  select id into v_manager_row from staff where email = 'denis@hunterautoworks.co.tz' and role = 'MANAGER';
  if v_owner_row is null or v_manager_row is null then
    raise exception 'Expected Owner/Manager staff rows not found — check emails/roles before linking.';
  end if;

  -- -- Guard: no cross-linking (auth id already used by a different staff row)
  select id into v_conflict from staff
    where id <> v_owner_row and auth_user_id::text = lower(v_owner_auth);
  if v_conflict is not null then
    raise exception 'Owner Auth UUID is already linked to another staff row (%).', v_conflict;
  end if;
  select id into v_conflict from staff
    where id <> v_manager_row and auth_user_id::text = lower(v_manager_auth);
  if v_conflict is not null then
    raise exception 'Manager Auth UUID is already linked to another staff row (%).', v_conflict;
  end if;

  -- -- Deterministic link (idempotent: re-running sets the same values)
  update staff set auth_user_id = lower(v_owner_auth)::uuid  where id = v_owner_row;
  update staff set auth_user_id = lower(v_manager_auth)::uuid where id = v_manager_row;

  raise notice 'Linked 2 staff records.';
end $$;

-- ---------- Verification ----------
select full_name, role, active, email,
       auth_user_id is not null as linked,
       auth_user_id
from staff
where role in ('OWNER', 'MANAGER')
order by role;
