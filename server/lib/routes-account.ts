import { Router, Request } from 'express';
import { getSupabaseAdmin, createPasswordGrantClient, isSupabaseConfigured } from './supabaseAdmin';
import { HttpError, handler, requireAuth, AuthedRequest } from './auth';
import { repo } from './repository';

/**
 * STAFF ACCOUNT SETTINGS (Phase B) — every authenticated staff role.
 *
 * Scope is deliberately SELF-ONLY: an actor can read their own profile,
 * change their own password (after re-verifying the current one), and revoke
 * their OTHER Auth sessions. Role changes, activation, and other users'
 * data remain owner-only routes-users.ts territory — nothing here can
 * alter authorization state.
 *
 * All data is real: email/createdAt come from the Supabase Auth directory,
 * name/role/active from the staff record the server resolves the actor
 * against. Nothing is fabricated.
 *
 * NOTE on sessions: the GoTrue version behind this project does not expose
 * per-user session LISTING (verified live: no `sessions` array on the admin
 * user object, no /admin/users/:id/sessions endpoint). Revocation IS
 * supported: admin.signOut(bearerToken, 'others') invalidates every refresh
 * token except the one presented. The UI therefore offers the revoke action
 * and states plainly that other devices were signed out — it does not
 * pretend to list sessions.
 */

export const accountRouter = Router();

const MIN_PASSWORD_LENGTH = 8;

/** Resolve the live staff row for the authenticated actor. */
async function ownStaffRow(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, userId: string) {
  const { data, error } = await admin
    .from('staff')
    .select('id, full_name, role, email, phone, active, created_at')
    .eq('auth_user_id', userId)
    .maybeSingle();
  if (error) {
    console.error(`[account] staff lookup failed for ${userId}:`, error.message);
    throw new HttpError(503, 'STAFF_LOOKUP_FAILED', 'Account service temporarily unavailable. Please try again.');
  }
  if (!data) throw new HttpError(403, 'NO_STAFF_ROLE', 'This account has no active Hunter staff role.');
  return data;
}

function bearerTokenOf(req: Request): string {
  return (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
}

// --- Own profile: identity + role + status + real member-since -------------
accountRouter.get('/profile', requireAuth('account'), handler(async (req: AuthedRequest, res) => {
  const admin = getSupabaseAdmin();
  if (!admin || !isSupabaseConfigured()) throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication is not configured on this server.');
  const actor = req.actor!;
  if (typeof actor.userId !== 'string' || !actor.userId) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Session invalid or expired.');
  }
  const staff = await ownStaffRow(admin, actor.userId);

  // Email + created_at are owned by Supabase Auth; read them from the directory.
  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(actor.userId);
  if (authErr || !authUser?.user) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Session invalid or expired.');
  }

  res.json({
    success: true,
    data: {
      userId: actor.userId,
      name: staff.full_name,
      email: authUser.user.email ?? staff.email ?? '',
      role: staff.role,
      active: staff.active,
      phone: staff.phone ?? null,
      memberSince: authUser.user.created_at ?? null,
    },
  });
}));

// --- Change own password (re-verify current password first) -----------------
accountRouter.post('/password', requireAuth('account'), handler(async (req: AuthedRequest, res) => {
  const admin = getSupabaseAdmin();
  if (!admin || !isSupabaseConfigured()) throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication is not configured on this server.');
  const actor = req.actor!;
  if (typeof actor.userId !== 'string' || !actor.userId) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Session invalid or expired.');
  }

  const { currentPassword, newPassword } = (req.body || {}) as { currentPassword?: unknown; newPassword?: unknown };
  if (typeof currentPassword !== 'string' || !currentPassword || typeof newPassword !== 'string' || !newPassword) {
    throw new HttpError(400, 'BAD_REQUEST', 'Current and new passwords are required.');
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, 'WEAK_PASSWORD', `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (newPassword === currentPassword) {
    throw new HttpError(400, 'BAD_REQUEST', 'New password must be different from the current password.');
  }

  // Re-verify the caller's identity with the CURRENT password on a throwaway
  // grant client (never the shared service-role singleton). A stolen access
  // token alone must not be able to rotate the password.
  const grantClient = createPasswordGrantClient();
  if (!grantClient) throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication is not configured on this server.');
  const { data: staffRow } = await admin.from('staff').select('email').eq('auth_user_id', actor.userId).maybeSingle();
  const verify = await grantClient.auth.signInWithPassword({
    email: (staffRow?.email || actor.email || '').trim().toLowerCase(),
    password: currentPassword,
  });
  if (verify.error || !verify.data?.user) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
  }

  const { error: updateErr } = await admin.auth.admin.updateUserById(actor.userId, { password: newPassword });
  if (updateErr) {
    console.error(`[account] password update failed for ${actor.userId}:`, updateErr.message);
    throw new HttpError(500, 'PASSWORD_UPDATE_FAILED', 'Could not change the password. Please try again.');
  }

  await repo.logAudit(
    actor.name || actor.email || actor.userId,
    'PASSWORD_CHANGED_SELF',
    'Staff',
    actor.userId,
    'Staff member changed their own password'
  );

  res.json({ success: true, data: { changed: true } });
}));

// --- Revoke all OTHER sessions (keep the device being used) -----------------
accountRouter.post('/sessions/revoke-others', requireAuth('account'), handler(async (req: AuthedRequest, res) => {
  const admin = getSupabaseAdmin();
  if (!admin || !isSupabaseConfigured()) throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication is not configured on this server.');
  const actor = req.actor!;
  const token = bearerTokenOf(req);
  if (typeof actor.userId !== 'string' || !actor.userId || !token) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Session invalid or expired.');
  }

  // supabase-js admin.signOut(jwt, scope): with scope 'others', GoTrue revokes
  // every refresh token for this user EXCEPT the session the presented JWT
  // belongs to — i.e. the device making this request stays signed in.
  const { error } = await admin.auth.admin.signOut(token, 'others');
  if (error) {
    console.error(`[account] revoke-others failed for ${actor.userId}:`, error.message);
    throw new HttpError(500, 'REVOKE_FAILED', 'Could not sign out other sessions. Please try again.');
  }

  await repo.logAudit(
    actor.name || actor.email || actor.userId,
    'SESSIONS_REVOKED_SELF',
    'Staff',
    actor.userId,
    'Staff member signed out all other sessions'
  );

  res.json({ success: true, data: { revoked: true } });
}));
