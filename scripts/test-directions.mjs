/**
 * Directions/destination test suite (node:test).
 *
 * Covers the required matrix WITHOUT any production data or network:
 *  1. Destination constant: exact confirmed coordinates, no old values.
 *  2. Directions service: coordinate validation, normalization, upstream
 *     failure modes, production demo-server guard, timeout.
 *  3. Privacy: no coordinate logging; no GPS persistence primitives.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const clean = (p) => path.normalize(p);

// ---------------------------------------------------------------- imports
const { HUNTER_LOCATION } = await import(
  'file://' + clean(path.join(ROOT, 'src/lib/hunterLocation.ts'))
);
const { parseFromParam, fetchDirections, resolveOsrmBaseUrl } = await import(
  'file://' + clean(path.join(ROOT, 'server/lib/directions.ts'))
);

// Load TS sources through tsx (respects the project's tsconfig paths).
process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --import tsx';

// ================================================================ 1. DESTINATION
test('destination: exact confirmed coordinates', () => {
  assert.equal(HUNTER_LOCATION.latitude, -6.7789875);
  assert.equal(HUNTER_LOCATION.longitude, 39.265234375);
  assert.equal(HUNTER_LOCATION.plusCode, '6G5X67C8+C35');
  assert.equal(HUNTER_LOCATION.address, '3, Kwamsama, Morocco, Kinondoni, Dar es Salaam, Tanzania');
});

test('destination: old coordinates absent from every navigation-related source file', () => {
  const files = [
    'src/lib/hunterLocation.ts',
    'src/components/public/ContactSection.tsx',
    'src/components/public/HowToReachUs.tsx',
    'src/components/public/AccessMap.tsx',
    'server/lib/directions.ts',
    'server/api.ts',
  ];
  for (const f of files) {
    const text = fs.readFileSync(clean(path.join(ROOT, f)), 'utf8');
    assert.ok(!text.includes('-6.7865'), `${f} must not contain the old latitude`);
    assert.ok(!text.includes('39.2624'), `${f} must not contain the old longitude`);
  }
});

test('destination: Google handoff derives from the exact confirmed coordinates', async () => {
  const { GOOGLE_MAPS_DIRECTIONS_UNIVERSAL_URL } = await import(
    'file://' + clean(path.join(ROOT, 'src/lib/googleMaps.ts'))
  );
  const url = new URL(GOOGLE_MAPS_DIRECTIONS_UNIVERSAL_URL);
  assert.equal(url.searchParams.get('destination'), `${HUNTER_LOCATION.latitude},${HUNTER_LOCATION.longitude}`);
});

// ================================================================ 2. DIRECTIONS SERVICE
test('directions: parseFromParam accepts valid decimals', () => {
  assert.deepEqual(parseFromParam('-6.78,39.26'), { lat: -6.78, lng: 39.26 });
  assert.deepEqual(parseFromParam('  -6.78 , 39.26 '), { lat: -6.78, lng: 39.26 });
  assert.deepEqual(parseFromParam('0,0'), { lat: 0, lng: 0 });
});

test('directions: parseFromParam rejects malformed/missing/out-of-range', () => {
  assert.equal(parseFromParam(undefined), null);
  assert.equal(parseFromParam(''), null);
  assert.equal(parseFromParam('-6.78'), null);
  assert.equal(parseFromParam('-6.78,39.26,extra'), null);
  assert.equal(parseFromParam('abc,39.26'), null);
  assert.equal(parseFromParam('-6.78,abc'), null);
  assert.equal(parseFromParam(',,', ), null);
  assert.equal(parseFromParam('NaN,39.26'), null);
  assert.equal(parseFromParam('91,0'), null);        // lat out of range
  assert.equal(parseFromParam('-91,0'), null);
  assert.equal(parseFromParam('0,181'), null);        // lng out of range
  assert.equal(parseFromParam('0,-181'), null);
  assert.equal(parseFromParam('1e2,39.26'), null);    // exponent trick
  assert.equal(parseFromParam('0x10,39.26'), null);   // hex trick
  assert.equal(parseFromParam('Infinity,0'), null);
});

test('directions: normalized success shape from a well-formed OSRM response', async () => {
  const geometry = [[39.0, -6.0], [39.1, -6.05], [39.2652, -6.779]];
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      code: 'Ok',
      routes: [{ distance: 12345.6, duration: 1500.4, geometry: { coordinates: geometry } }],
    }),
  });
  const env = { OSRM_BASE_URL: 'https://osrm.example.com', NODE_ENV: 'test' };
  const res = await fetchDirections({ lat: -6.0, lng: 39.0 }, env, fetchImpl);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.route.distanceMeters, 12346);
    assert.equal(res.route.durationSeconds, 1500);
    assert.deepEqual(res.route.geometry[0], [-6.0, 39.0]); // lat,lng order for Leaflet
    assert.equal(res.route.geometry.length, 3);
  }
});

test('directions: upstream rejects never return raw provider data', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({ message: 'super secret internal detail' }) });
  const env = { OSRM_BASE_URL: 'https://osrm.example.com' };
  const res = await fetchDirections({ lat: -6.0, lng: 39.0 }, env, fetchImpl);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, 'ROUTING_UNAVAILABLE');
    assert.equal(res.httpStatus, 502);
  }
});

test('directions: oversized upstream body rejected (response-size protection)', async () => {
  // Streaming body that exceeds the 5 MB cap — must be cut off, not buffered.
  const bigChunk = new Uint8Array(3 * 1024 * 1024).fill(0x61); // 3 MB of 'a'
  let reads = 0;
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => {
          reads++;
          return { done: false, value: bigChunk };
        },
        cancel: async () => { reads = -1; },
      }),
    },
    json: async () => { throw new Error('unbounded json() must not be used'); },
  });
  const res = await fetchDirections({ lat: -6.0, lng: 39.0 }, { OSRM_BASE_URL: 'https://osrm.example.com' }, fetchImpl);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, 'ROUTE_UNAVAILABLE');
    assert.equal(res.httpStatus, 502);
  }
  assert.equal(reads, -1, 'stream was cancelled after exceeding the cap');
});

test('directions: unparseable upstream body → structured ROUTE_UNAVAILABLE', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => ({ done: true, value: undefined }),
        cancel: async () => {},
      }),
    },
  });
  const res = await fetchDirections({ lat: -6.0, lng: 39.0 }, { OSRM_BASE_URL: 'https://osrm.example.com' }, fetchImpl);
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.code, 'ROUTE_UNAVAILABLE');
});

test('directions: malformed upstream payload → structured ROUTE_UNAVAILABLE', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ code: 'Ok', routes: [{ distance: 'not-a-number', duration: 100, geometry: { coordinates: [[39, -6], [39.1, -6.1]] } }] }),
  });
  const res = await fetchDirections({ lat: -6.0, lng: 39.0 }, { OSRM_BASE_URL: 'https://osrm.example.com' }, fetchImpl);
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.code, 'ROUTE_UNAVAILABLE');
});

test('directions: upstream timeout → ROUTING_UNAVAILABLE (504), no throw', async () => {
  const fetchImpl = async (url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const e = new Error('The operation was aborted');
      e.name = 'AbortError';
      reject(e);
    });
  });
  const res = await fetchDirections({ lat: -6.0, lng: 39.0 }, { OSRM_BASE_URL: 'https://osrm.example.com' }, fetchImpl);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, 'ROUTING_UNAVAILABLE');
    assert.equal(res.httpStatus, 504);
  }
});

test('directions: missing OSRM_BASE_URL fails closed (503 ROUTING_NOT_CONFIGURED)', async () => {
  const res = await fetchDirections({ lat: -6.0, lng: 39.0 }, {}, async () => { throw new Error('must not be called'); });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, 'ROUTING_NOT_CONFIGURED');
    assert.equal(res.httpStatus, 503);
  }
});

test('directions: production refuses the public demo server (fail closed)', async () => {
  const env = { OSRM_BASE_URL: 'https://router.project-osrm.org', NODE_ENV: 'production' };
  const res = await fetchDirections({ lat: -6.0, lng: 39.0 }, env, async () => { throw new Error('must not be called'); });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.code, 'ROUTING_NOT_CONFIGURED');
  // and the guard is on resolveOsrmBaseUrl itself
  assert.deepEqual(resolveOsrmBaseUrl(env).ok, false);
});

test('directions: dev IS allowed to use the demo endpoint (explicit dev-only)', () => {
  const ok = resolveOsrmBaseUrl({ OSRM_BASE_URL: 'https://router.project-osrm.org', NODE_ENV: 'development' });
  assert.equal(ok.ok, true);
});

test('directions: destination is server-authoritative (upstream URL contains it, not client)', async () => {
  let captured = null;
  const fetchImpl = async (url) => {
    captured = url;
    return { ok: true, status: 200, json: async () => ({ code: 'Ok', routes: [{ distance: 1, duration: 1, geometry: { coordinates: [[39.265234375, -6.7789875], [39.2653, -6.779]] } }] }) };
  };
  await fetchDirections({ lat: -6.0, lng: 39.0 }, { OSRM_BASE_URL: 'https://osrm.example.com' }, fetchImpl);
  assert.ok(captured.includes('39.265234375') && captured.includes('-6.7789875'), 'upstream must target the authoritative destination');
});

// ================================================================ 3. PRIVACY
test('privacy: no GPS persistence or logging primitives in location sources', () => {
  const files = [
    'src/lib/hunterLocation.ts',
    'server/lib/directions.ts',
  ];
  const forbidden = ['console.log(', 'localStorage', 'sessionStorage'];
  for (const f of files) {
    const text = fs.readFileSync(clean(path.join(ROOT, f)), 'utf8');
    for (const bad of forbidden) {
      assert.ok(!text.includes(bad), `${f} must not contain ${bad}`);
    }
  }
});

test('privacy: directions endpoint never logs coordinates (URL built but not logged)', () => {
  const text = fs.readFileSync(clean(path.join(ROOT, 'server/lib/directions.ts')), 'utf8');
  // The only console calls must be coordinate-free status messages.
  const consoleCalls = text.match(/console\.\w+\([^;]*\);/g) ?? [];
  assert.ok(consoleCalls.length >= 2, 'error logging exists');
  for (const c of consoleCalls) {
    assert.ok(!c.includes('upstreamUrl'), 'must never log the upstream URL');
    assert.ok(!c.includes('from.lat') && !c.includes('from.lng'), 'must never log coordinates');
  }
});
