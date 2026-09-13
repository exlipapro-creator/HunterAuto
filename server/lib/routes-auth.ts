import { Router, Request, Response } from 'express';
import { getSupabaseAdmin, isSupabaseConfigured, createPasswordGrantClient } from './supabaseAdmin';
import { HttpError, handler } from './auth';

export const authRouter = Router();

// --- Simple in-memory rate limiter for authentication endpoints ---
const attempts = new Map<string, { count: number; firstAt: number }>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

function rateLimit(ip: string): void {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: now });
    return;
  }
  rec.count += 1;
  if (rec.count > MAX_ATTEMPTS) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many attempts. Please try again later.');
  }
}

// --- Identity endpoint: who is the Bearer token? ---
authRouter.get('/me', handler(async (req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication is not configured on this server.');
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in required.');

  const admin = getSupabaseAdmin();
  const { data, error } = await admin!.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Session invalid or expired.');

  // Identity policy mirrors resolveActor(): the role comes from the staff
  // record linked by auth_user_id — NOT from token metadata (staff_role in
  // user_metadata is client-editable at signup and must never be trusted).
  // A valid identity with no linked active staff record is denied.
  const { data: staffRow, error: staffErr } = await admin!
    .from('staff')
    .select('full_name, role, active')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();
  if (staffErr) {
    console.error(`[auth] staff lookup failed for auth_user_id=${data.user.id}:`, staffErr.message);
    throw new HttpError(503, 'STAFF_LOOKUP_FAILED', 'Sign-in is temporarily unavailable. Please try again.');
  }
  if (!staffRow || staffRow.active === false) {
    throw new HttpError(403, 'NO_STAFF_ROLE', 'This account has no active Hunter staff role.');
  }

  const meta = (data.user.user_metadata || {}) as Record<string, unknown>;

  res.json({
    success: true,
    data: {
      userId: data.user.id,
      email: data.user.email ?? '',
      name: (staffRow.full_name as string) || data.user.email || 'Staff',
      role: staffRow.role as string,
    },
  });
}));

// --- Staff login (email + password via Supabase Auth) ---
authRouter.post('/login', (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  rateLimit(ip);

  void (async () => {
    try {
      const { email, password } = (req.body || {}) as { email?: string; password?: string };
      if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        throw new HttpError(400, 'BAD_REQUEST', 'Email and password are required.');
      }
      if (!isSupabaseConfigured()) {
        throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication is not configured on this server.');
      }
      // Password grant runs on a THROWAWAY client (see createPasswordGrantClient):  
      // signing in on the shared admin singleton would store this user's session
      // on it and poison every later service-role query with the user's JWT.
      const grantClient = createPasswordGrantClient();
      if (!grantClient) {
        throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication is not configured on this server.');
      }
      const { data, error } = await grantClient.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error || !data?.session || !data?.user) {
        throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
      }

      // Role + active status come from the staff table (server-authoritative),
      // never from token metadata. An unlinked or inactive identity is denied.
      // Lookup errors are logged, not swallowed: a transient failure must not
      // be indistinguishable from "not a staff member". This lookup runs on
      // the CLEAN shared admin client — the service-role key, no user session.
      const admin = getSupabaseAdmin();
      if (!admin) {
        throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication is not configured on this server.');
      }
      const { data: staffRow, error: staffErr } = await admin
        .from('staff')
        .select('full_name, role, active')
        .eq('auth_user_id', data.user.id)
        .maybeSingle();
      if (staffErr) {
        console.error(`[auth] staff lookup failed for auth_user_id=${data.user.id}:`, staffErr.message);
        throw new HttpError(503, 'STAFF_LOOKUP_FAILED', 'Sign-in is temporarily unavailable. Please try again.');
      }
      if (!staffRow || staffRow.active === false) {
        // The grant client is request-local and discarded; the shared admin
        // client never holds user sessions, so nothing to clean up there.
        throw new HttpError(403, 'NO_STAFF_ROLE', 'This account is not an active Hunter staff member.');
      }

      res.json({
        success: true,
        data: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          user: {
            userId: data.user.id,
            email: data.user.email,
            name: (staffRow.full_name as string) || data.user.email,
            role: staffRow.role as string,
          },
        },
      });
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ success: false, error: err.message, code: err.code });
      } else {
        res.status(500).json({ success: false, error: 'Sign-in failed', code: 'AUTH_FAILURE' });
      }
    }
  })();
});

// --- Logout is client-side token clearing; Supabase sessions also expire. ---
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.json({ success: true, data: { ok: true } });
});
