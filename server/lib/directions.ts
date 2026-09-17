/**
 * Server-side directions service (/api/v1/directions).
 *
 * Architecture (per the approved audit):
 *  - The browser NEVER contacts a routing provider directly; it calls
 *    GET /api/v1/directions?from=LAT,LNG on this server.
 *  - The destination is server-authoritative (src/lib/hunterLocation.ts) —
 *    the client cannot supply its own destination.
 *  - The upstream URL is constructed ONLY from OSRM_BASE_URL (server-only
 *    env). No client-supplied URL, path, or destination is ever used — the
 *    endpoint cannot become an SSRF proxy.
 *  - Fail-closed: without a production-grade OSRM_BASE_URL the endpoint
 *    returns a structured configuration error. The public OSRM demo server
 *    (router.project-osrm.org) is REFUSED in production — navigation must
 *    never silently depend on a best-effort public demo.
 *  - PRIVACY: customer coordinates are never logged. Error paths report only
 *    safe metadata (status classes), never the request URL or coordinates.
 */

import { HUNTER_LOCATION } from '../../src/lib/hunterLocation.js';

/** Strict coordinate validation. Returns the parsed numbers or null. */
export function parseFromParam(raw: string | undefined): { lat: number; lng: number } | null {
  if (!raw) return null;
  const parts = raw.split(',');
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  // Number('') / Number('  ') are NaN; Number('+1e3') is finite but the
  // decimal-literal check below rejects exponent/hex/space tricks.
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!/^-?\d+(\.\d+)?$/.test(parts[0].trim()) || !/^-?\d+(\.\d+)?$/.test(parts[1].trim())) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Structured error codes — safe to expose, contain no internals. */
export type DirectionsErrorCode =
  | 'INVALID_COORDINATES'
  | 'ROUTING_NOT_CONFIGURED'
  | 'ROUTING_UNAVAILABLE'
  | 'ROUTE_UNAVAILABLE';

export type DirectionsResult =
  | {
      ok: true;
      route: {
        distanceMeters: number;
        durationSeconds: number;
        /** [lat, lng] pairs suitable for Leaflet polyline rendering. */
        geometry: [number, number][];
      };
    }
  | { ok: false; code: DirectionsErrorCode; httpStatus: number };

export interface DirectionsFetchLike {
  (url: string, init: { signal: AbortSignal }): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
}

const UPSTREAM_TIMEOUT_MS = 8_000;
/**
 * Response-size protection: a route response for a Tanzania-sized region with
 * a simplified overview is well under 1 MB; anything beyond 5 MB is hostile or
 * misconfigured upstream behavior and is rejected rather than buffered.
 */
const UPSTREAM_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

async function readJsonBounded(
  res: { json: () => Promise<unknown> },
  fetchImpl: DirectionsFetchLike,
  signal: AbortSignal,
): Promise<unknown | null> {
  // Prefer streaming length accounting when the runtime exposes it; fall back
  // to buffered parse when it does not (injectable test doubles).
  const anyRes = res as { body?: ReadableStream<Uint8Array> | null };
  if (anyRes.body && typeof anyRes.body.getReader === 'function') {
    const reader = anyRes.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > UPSTREAM_MAX_RESPONSE_BYTES) {
          try { await reader.cancel(); } catch { /* already closing */ }
          return null; // oversized — rejected
        }
        chunks.push(value);
      }
    } catch {
      return null;
    }
    try {
      const merged = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { merged.set(c, off); off += c.byteLength; }
      return JSON.parse(new TextDecoder().decode(merged));
    } catch {
      return null;
    }
  }
  void fetchImpl; void signal;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** The public OSRM demo server — acceptable for local dev ONLY, never production. */
const OSRM_DEMO_HOST = 'router.project-osrm.org';

export function resolveOsrmBaseUrl(env: NodeJS.ProcessEnv): { ok: true; base: string } | { ok: false; reason: 'missing' | 'demo_in_production' } {
  const raw = (env.OSRM_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return { ok: false, reason: 'missing' as const };
  // Production guard: the demo endpoint must never silently serve production.
  if (env.NODE_ENV === 'production') {
    try {
      if (new URL(raw).host === OSRM_DEMO_HOST) return { ok: false, reason: 'demo_in_production' as const };
    } catch {
      return { ok: false, reason: 'missing' };
    }
  }
  return { ok: true, base: raw };
}

/**
 * Calculate the walking/driving route from `from` to the authoritative Hunter
 * destination. `fetchImpl` is injectable for deterministic tests.
 */
export async function fetchDirections(
  from: { lat: number; lng: number },
  env: NodeJS.ProcessEnv,
  fetchImpl: DirectionsFetchLike = fetch as DirectionsFetchLike,
): Promise<DirectionsResult> {
  const osrm = resolveOsrmBaseUrl(env);
  if (!osrm.ok) {
    // Both failure reasons fail closed identically: no route, clear config error.
    const failure = osrm as { reason: 'missing' | 'demo_in_production' };
    void failure;
    return { ok: false, code: 'ROUTING_NOT_CONFIGURED', httpStatus: 503 };
  }

  const dest = HUNTER_LOCATION;
  // OSRM route service: overview=simplified keeps the payload small for
  // mobile; geometries=geojson gives clean lat/lng pairs. No alternatives,
  // no steps — the client needs geometry + totals only.
  const upstreamUrl =
    `${osrm.base}/route/v1/driving/` +
    `${from.lng},${from.lat};${dest.longitude},${dest.latitude}` +
    `?overview=simplified&geometries=geojson&alternatives=false&steps=false`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetchImpl(upstreamUrl, { signal: ctrl.signal });
    if (!res.ok) {
      // Log ONLY the status class — never the URL (it contains coordinates).
      console.error(`[directions] upstream failed (status ${Math.floor(res.status / 100)}xx)`);
      return { ok: false, code: 'ROUTING_UNAVAILABLE', httpStatus: 502 };
    }
    const body = (await readJsonBounded(res, fetchImpl, ctrl.signal)) as {
      code?: string;
      routes?: Array<{
        distance?: unknown;
        duration?: unknown;
        geometry?: { coordinates?: unknown };
      }>;
    } | null;
    if (!body) {
      // Oversized or unparseable upstream body.
      return { ok: false, code: 'ROUTE_UNAVAILABLE', httpStatus: 502 };
    }
    if (body?.code !== 'Ok' || !Array.isArray(body.routes) || body.routes.length === 0) {
      return { ok: false, code: 'ROUTE_UNAVAILABLE', httpStatus: 404 };
    }
    const r = body.routes[0];
    const distance = r.distance;
    const duration = r.duration;
    const coords = r.geometry?.coordinates;
    if (
      typeof distance !== 'number' || !Number.isFinite(distance) || distance < 0 ||
      typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0 ||
      !Array.isArray(coords) || coords.length < 2
    ) {
      return { ok: false, code: 'ROUTE_UNAVAILABLE', httpStatus: 502 };
    }
    // OSRM geojson coordinates are [lng, lat]; Leaflet wants [lat, lng].
    const geometry: [number, number][] = [];
    for (const c of coords) {
      if (!Array.isArray(c) || c.length < 2) return { ok: false, code: 'ROUTE_UNAVAILABLE', httpStatus: 502 };
      const [lng, lat] = c as [unknown, unknown];
      if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { ok: false, code: 'ROUTE_UNAVAILABLE', httpStatus: 502 };
      }
      geometry.push([lat, lng]);
    }
    return {
      ok: true,
      route: { distanceMeters: Math.round(distance), durationSeconds: Math.round(duration), geometry },
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    console.error(`[directions] upstream ${aborted ? 'timeout' : 'network failure'}`);
    return { ok: false, code: 'ROUTING_UNAVAILABLE', httpStatus: 504 };
  } finally {
    clearTimeout(timer);
  }
}
