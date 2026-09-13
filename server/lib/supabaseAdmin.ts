import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Request } from 'express';

/**
 * SERVER-ONLY Supabase access.
 *
 * SECURITY CONTRACT:
 *  - SUPABASE_SERVICE_ROLE_KEY bypasses Row Level Security. It must NEVER be
 *    referenced from frontend code, VITE_* variables, or sent to a browser.
 *  - Used here only inside the trusted Express server for: token verification
 *    (auth.getUser), staff directory lookup, and audit writes.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return adminClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

/**
 * A DISPOSABLE client for password grants (staff login).
 *
 * SECURITY NOTE: never call auth.signInWithPassword on the shared admin
 * singleton. supabase-js stores the resulting session ON THE CLIENT, after
 * which that client's PostgREST queries send the signed-in user's JWT
 * instead of the service-role key — silently re-enabling RLS on every
 * server-side query. Observed live: only the most recently logged-in
 * staff member's row stayed visible to requireAuth (via the
 * staff_self_read policy), producing opaque 401s for everyone else.
 * The login route creates one throwaway client per request; the shared
 * singleton must only ever run service-role queries.
 */
export function createPasswordGrantClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export interface AuthenticatedActor {
  userId: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Resolve the authenticated Hunter staff actor from the request's Bearer token.
 *
 * IDENTITY POLICY (server-authoritative):
 *  1. The Supabase Auth token proves WHO the identity is.
 *  2. The `staff` table (linked by auth_user_id) is the ONLY source of the
 *     actor's role and active status. Token metadata (`staff_role` in
 *     user_metadata) is NOT trusted — it is client-editable at signup and
 *     would let anyone mint themselves an OWNER.
 *  3. A valid Auth identity with no linked staff record → null (denied).
 *  4. An INACTIVE staff record → null (denied), so deactivation cuts access
 *     on the very next request without waiting for token expiry.
 */
export async function resolveActor(req: Request): Promise<AuthenticatedActor | null> {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();

  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;

  // Role + active status come from the business record, never from the token.
  // The lookup error MUST be distinguished from "no record": a swallowed
  // transient error would deny a legitimately linked staff member (observed
  // live as an opaque 401). Fail closed either way — but log the real cause.
  const { data: staffRow, error: staffErr } = await admin
    .from('staff')
    .select('full_name, role, active')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();
  if (staffErr) {
    console.error(`[auth] staff lookup failed for auth_user_id=${data.user.id}:`, staffErr.message);
    return null;
  }
  if (!staffRow || staffRow.active === false) {
    // Fail closed: valid identity but no active linked staff record.
    return null;
  }

  return {
    userId: data.user.id,
    email: data.user.email ?? '',
    name: (staffRow.full_name as string) || data.user.email || 'Staff',
    role: (staffRow.role as string) || '',
  };
}
