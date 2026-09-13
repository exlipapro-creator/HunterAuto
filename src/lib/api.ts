import { getSupabaseBrowser } from './supabase';

/**
 * apiFetch — fetch wrapper for INTERNAL staff APIs.
 * Attaches the Supabase access token when a staff session exists.
 * Public/customer endpoints may keep using plain fetch.
 */
export async function apiFetch<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const sb = getSupabaseBrowser();
  if (sb) {
    try {
      const { data } = await sb.auth.getSession();
      if (data.session?.access_token) {
        headers.set('Authorization', `Bearer ${data.session.access_token}`);
      }
    } catch {
      // session lookup failure should not break the request; server will 401 if needed
    }
  }

  const res = await fetch(path, { ...init, headers });
  let parsed: T | null = null;
  try {
    parsed = (await res.json()) as T;
  } catch {
    parsed = null;
  }
  return { ok: res.ok, status: res.status, data: parsed };
}
