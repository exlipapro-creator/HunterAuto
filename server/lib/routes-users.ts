import { Router } from 'express';
import { getSupabaseAdmin } from './supabaseAdmin';
import { HttpError, handler, requireAuth, AuthedRequest } from './auth';
import { repo } from './repository';

/**
 * OWNER-ONLY user management.
 *
 * All routes require a server-verified actor (requireAuth('staff')) AND the
 * ownerOnly guard below — defense in depth, the RBAC matrix alone is not the
 * boundary for these routes. Every handler runs inside `handler()` so sync
 * guard throws and async rejections both become structured JSON responses
 * (an unwrapped throw would fall through to Express's default error handler
 * and return an empty body — observed live).
 *
 * Deactivation semantics: staff.active = false. resolveActor() denies inactive
 * staff, so API access is cut on the next request; the Auth identity is also
 * banned so sessions cannot be refreshed. Records are never hard-deleted
 * (work orders / audit rows reference staff ids).
 */

export const usersRouter = Router();

const ASSIGNABLE_ROLES = ['MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN', 'CASHIER', 'INVENTORY_MANAGER', 'ACCOUNTANT'] as const;
/** Long ban used to freeze an identity while its staff record is inactive (~100 years). */
const DEACTIVATED_BAN = '876000h';

function ownerOnly(req: AuthedRequest): void {
  if (req.actor?.role !== 'OWNER') {
    throw new HttpError(403, 'FORBIDDEN', 'Owner permission required.');
  }
}

function clean(v: unknown, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

usersRouter.get('/', requireAuth('staff'), handler(async (req: AuthedRequest, res) => {
  ownerOnly(req);
  const admin = getSupabaseAdmin();
  if (!admin) throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication is not configured on this server.');

  const { data, error } = await admin
    .from('staff')
    .select('id, legacy_id, full_name, role, email, phone, active, auth_user_id, created_at')
    .order('full_name');
  if (error) {
    console.error('[users] list failed:', error.message);
    throw new HttpError(500, 'USERS_LIST_FAILED', 'Could not load users');
  }

  // Last sign-in comes from the real Auth directory — nothing is fabricated.
  const { data: authUsers } = await admin.auth.admin.listUsers();
  const lastByAuth = new Map<string, string>();
  for (const u of authUsers?.users ?? []) {
    if (u.last_sign_in_at) lastByAuth.set(u.id, u.last_sign_in_at);
  }

  const users = (data ?? []).map((s) => ({
    id: s.id,
    legacyId: s.legacy_id,
    name: s.full_name,
    email: s.email ?? '',
    phone: s.phone ?? '',
    role: s.role,
    active: s.active,
    linked: !!s.auth_user_id,
    lastLoginAt: s.auth_user_id ? lastByAuth.get(s.auth_user_id) ?? null : null,
    createdAt: s.created_at,
  }));
  res.json({ success: true, data: users });
}));

usersRouter.post('/invite', requireAuth('staff'), handler(async (req: AuthedRequest, res) => {
  ownerOnly(req);
  const admin = getSupabaseAdmin();
  if (!admin) throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication is not configured on this server.');

  const body = req.body || {};
  const name = clean(body.name, 120);
  const email = clean(body.email, 200).toLowerCase();
  const role = String(body.role || '').toUpperCase();
  const active = body.active !== false;

  if (!name || name.length < 2) throw new HttpError(400, 'VALIDATION', 'Enter the full name.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'VALIDATION', 'Enter a valid email address.');
  if (!ASSIGNABLE_ROLES.includes(role as (typeof ASSIGNABLE_ROLES)[number])) {
    throw new HttpError(400, 'VALIDATION', 'Choose a valid role. Owner accounts are provisioned separately.');
  }
  if (body.password !== undefined && body.password !== null && String(body.password).length > 0 && String(body.password).length < 8) {
    throw new HttpError(400, 'VALIDATION', 'Temporary password must be at least 8 characters.');
  }

  // Uniqueness checks BEFORE creating anything (friendly errors instead of
  // relying on DB constraint messages).
  const { data: dupStaff } = await admin.from('staff').select('id').eq('email', email).maybeSingle();
  if (dupStaff) throw new HttpError(400, 'VALIDATION', 'A staff member with that email already exists.');

  // 1. Create the Supabase Auth identity (password optional — invite email path).
  let authUserId: string;
  try {
    const create: Record<string, unknown> = { email, email_confirm: true, user_metadata: { full_name: name } };
    if (typeof body.password === 'string' && body.password.length >= 8) create.password = body.password;
    const { data: created, error: createErr } = await admin.auth.admin.createUser(create);
    if (createErr || !created?.user) {
      const msg = createErr?.message ?? 'Could not create the account';
      throw new HttpError(400, 'VALIDATION', /already/i.test(msg) ? 'A user with that email already exists.' : msg);
    }
    authUserId = created.user.id;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(500, 'USER_CREATE_FAILED', 'Could not create the account');
  }

  // 2. Create the staff record linked to the new identity.
  const { data: staffRow, error: staffErr } = await admin
    .from('staff')
    .insert({ full_name: name, email, role, active, auth_user_id: authUserId })
    .select('id, full_name, role, email, active, auth_user_id, created_at')
    .single();
  if (staffErr || !staffRow) {
    console.error('[users] staff insert failed:', staffErr?.message);
    // Do not leave an orphaned Auth identity behind.
    await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    throw new HttpError(500, 'USER_CREATE_FAILED', 'Could not save the staff record');
  }

  await repo.logAudit(`${req.actor!.name} (${req.actor!.role})`, 'USER_INVITED', 'Staff', staffRow.id, `Invited ${name} as ${role}`);
  res.status(201).json({ success: true, data: { ...staffRow, linked: true } });
}));

usersRouter.patch('/:id', requireAuth('staff'), handler(async (req: AuthedRequest, res) => {
  ownerOnly(req);
  const admin = getSupabaseAdmin();
  if (!admin) throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication is not configured on this server.');

  const id = String(req.params.id || '');
  const body = req.body || {};
  const { data: target } = await admin.from('staff').select('id, full_name, role, active, auth_user_id').eq('id', id).maybeSingle();
  if (!target) throw new HttpError(404, 'NOT_FOUND', 'User not found');

  const patch: Record<string, unknown> = {};
  const events: string[] = [];

  if (body.role !== undefined) {
    const role = String(body.role).toUpperCase();
    if (!ASSIGNABLE_ROLES.includes(role as (typeof ASSIGNABLE_ROLES)[number])) {
      throw new HttpError(400, 'VALIDATION', 'Owner role cannot be assigned here. Ownership transfer is a separate protected procedure.');
    }
    // An OWNER never loses the OWNER role through this endpoint: no demotion,
    // so the system can never be left owner-less through this API.
    if (target.role === 'OWNER') {
      throw new HttpError(403, 'FORBIDDEN', 'The Owner role cannot be changed here.');
    }
    if (target.role !== role) {
      patch.role = role;
      events.push(`role ${target.role} -> ${role}`);
    }
  }

  if (body.active !== undefined) {
    const active = body.active === true;
    if (target.role === 'OWNER' && !active) {
      const { count } = await admin.from('staff').select('*', { count: 'exact', head: true }).eq('role', 'OWNER').eq('active', true);
      if ((count ?? 0) <= 1) {
        throw new HttpError(403, 'FORBIDDEN', 'Cannot deactivate the only active Owner.');
      }
    }
    if (target.active !== active) {
      patch.active = active;
      events.push(active ? 'reactivated' : 'deactivated');
      if (target.auth_user_id) {
        // Freeze/unfreeze the Auth identity so sessions cannot be refreshed
        // while inactive (the staff.active check remains the primary boundary).
        await admin.auth.admin
          .updateUserById(target.auth_user_id, { ban_duration: active ? 'none' : DEACTIVATED_BAN })
          .catch(() => {});
      }
    }
  }

  // auth_user_id (re)linking: only from the real Auth directory, only to an
  // unlinked record, and only if no other staff row already claims it.
  if (body.authUserId !== undefined) {
    const authUserId = clean(body.authUserId, 64);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authUserId)) {
      throw new HttpError(400, 'VALIDATION', 'authUserId must be a valid Supabase Auth UUID.');
    }
    if (target.role === 'OWNER' && target.auth_user_id && target.auth_user_id !== authUserId) {
      throw new HttpError(403, 'FORBIDDEN', 'The Owner identity link cannot be changed here.');
    }
    const { data: claimed } = await admin.from('staff').select('id, full_name').eq('auth_user_id', authUserId).maybeSingle();
    if (claimed && claimed.id !== id) {
      throw new HttpError(409, 'AUTH_LINK_TAKEN', `That Auth identity is already linked to ${claimed.full_name}.`);
    }
    const { data: authUser } = await admin.auth.admin.getUserById(authUserId);
    if (!authUser?.user) throw new HttpError(400, 'VALIDATION', 'No Supabase Auth user exists with that id.');
    if (target.auth_user_id !== authUserId) {
      patch.auth_user_id = authUserId;
      events.push(`auth identity linked (${authUser.user.email ?? authUserId})`);
    }
  }

  if (!Object.keys(patch).length) {
    res.json({ success: true, data: target, unchanged: true });
    return;
  }

  const { data: updated, error } = await admin.from('staff').update(patch).eq('id', id).select('id, full_name, role, email, active, auth_user_id').single();
  if (error || !updated) {
    console.error('[users] update failed:', error?.message);
    throw new HttpError(500, 'USER_UPDATE_FAILED', 'Could not update the user');
  }

  const eventAction = events.some((e) => e.startsWith('role ')) ? 'USER_ROLE_CHANGED' : body.active === false ? 'USER_DEACTIVATED' : body.active === true ? 'USER_REACTIVATED' : 'USER_UPDATED';
  await repo.logAudit(`${req.actor!.name} (${req.actor!.role})`, eventAction, 'Staff', id, `${updated.full_name}: ${events.join(', ')}`);
  res.json({ success: true, data: updated });
}));

usersRouter.post('/:id/resend-invite', requireAuth('staff'), handler(async (req: AuthedRequest, res) => {
  ownerOnly(req);
  const admin = getSupabaseAdmin();
  if (!admin) throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication is not configured on this server.');

  const id = String(req.params.id || '');
  const { data: target } = await admin.from('staff').select('email, auth_user_id').eq('id', id).maybeSingle();
  if (!target) throw new HttpError(404, 'NOT_FOUND', 'User not found');
  const { error } = await admin.auth.admin.inviteUserByEmail(target.email ?? '');
  if (error) throw new HttpError(400, 'INVITE_FAILED', 'Could not send the invite email');
  await repo.logAudit(`${req.actor!.name} (${req.actor!.role})`, 'USER_INVITE_RESENT', 'Staff', id, `Invite email sent to ${target.email}`);
  res.json({ success: true, data: { ok: true } });
}));
