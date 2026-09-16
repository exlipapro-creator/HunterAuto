#!/usr/bin/env node
/**
 * OSRM service verification — real route to Hunter's confirmed coordinate.
 *
 * Usage:
 *   node scripts/verify-osrm.mjs [BASE_URL]        (default http://127.0.0.1:5000)
 *
 * Single source of truth: the destination is imported from
 * src/lib/hunterLocation.ts (Node 22+ strips TS types natively). No
 * coordinate duplication in verification tooling.
 *
 * Asserts (per the Phase 3A task):
 *  1. route exists          4. geometry is valid
 *  2. distance is finite    5. destination is the confirmed Hunter coordinate
 *  3. duration is finite    6. response shape is what the Express normalizer expects
 *
 * This script talks to OSRM directly (upstream verification). The browser
 * never does this — it always goes through /api/v1/directions.
 */
import { HUNTER_LOCATION } from '../src/lib/hunterLocation.ts';

const BASE = (process.argv[2] || 'http://127.0.0.1:5000').replace(/\/+$/, '');
const FROM = { lat: -6.7923, lng: 39.2443 }; // central Dar es Salaam (Kariakoo area)
const HUNTER = { lat: HUNTER_LOCATION.latitude, lng: HUNTER_LOCATION.longitude };

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) fails++;
};

const url = `${BASE}/route/v1/driving/${FROM.lng},${FROM.lat};${HUNTER.lng},${HUNTER.lat}?overview=simplified&geometries=geojson&alternatives=false&steps=false`;
console.log('verifying:', BASE);
const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
check('OSRM reachable (HTTP 200)', res.status === 200, `status=${res.status}`);
const body = await res.json().catch(() => null);

check('response has code=Ok', body?.code === 'Ok', `code=${body?.code}`);
const route = body?.routes?.[0];
check('route exists', Boolean(route));

const dist = route?.distance;
const dur = route?.duration;
check('distance is a finite, non-negative number', typeof dist === 'number' && Number.isFinite(dist) && dist >= 0, `${dist} m`);
check('duration is a finite, non-negative number', typeof dur === 'number' && Number.isFinite(dur) && dur >= 0, `${dur} s`);
check('distance is plausible for an in-city drive (0.1–30 km)', typeof dist === 'number' && dist > 100 && dist < 30_000, `${(dist / 1000).toFixed(2)} km`);

const coords = route?.geometry?.coordinates;
check('geometry exists with ≥2 points', Array.isArray(coords) && coords.length >= 2, `${coords?.length ?? 0} points`);
const last = coords?.[coords.length - 1];
check(
  'route destination is the confirmed Hunter coordinate',
  Array.isArray(last) && Math.abs(last[1] - HUNTER.lat) < 0.0005 && Math.abs(last[0] - HUNTER.lng) < 0.0005,
  last ? `${last[1]}, ${last[0]}` : 'n/a',
);

// Geographic plausibility: every geometry point inside the Tanzania bounding
// box (approx. lat -11.8..-0.9, lng 29.2..40.7) — catches nonsense geometry.
const inTz = Array.isArray(coords) && coords.every(([lng, lat]) => lng > 29.0 && lng < 41.0 && lat > -12 && lat < -0.8);
check('geometry is geographically plausible (inside Tanzania bbox)', Boolean(inTz));

// Shape expected by server/lib/directions.ts (geojson coordinates are [lng,lat])
check(
  'normalizer-compatible shape (routes[0].distance/.duration/.geometry.coordinates)',
  Boolean(route) && 'distance' in route && 'duration' in route && Array.isArray(coords),
);

console.log(fails === 0 ? `\nOSRM VERIFICATION: ALL PASS (${BASE})` : `\nOSRM VERIFICATION: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
