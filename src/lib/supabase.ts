import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser-side Supabase client.
 *
 * SECURITY: this client uses ONLY the public project URL and the anon
 * (publishable) key. The service-role key must never appear anywhere in
 * frontend code or environment variables prefixed with VITE_.
 *
 * Returns null when Supabase is not configured (e.g. keys not yet supplied),
 * so the UI can degrade gracefully instead of crashing.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'hunter-staff-auth',
      },
    });
  }
  return client;
}

export interface StaffAuthUser {
  userId: string;
  email: string;
  name: string;
  role: string;
}

/** Ask the Hunter server who the signed-in staff member is. Returns null when unauthenticated. */
export async function fetchStaffIdentity(accessToken: string): Promise<StaffAuthUser | null> {
  try {
    const res = await fetch('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.success ? (json.data as StaffAuthUser) : null;
  } catch {
    return null;
  }
}
