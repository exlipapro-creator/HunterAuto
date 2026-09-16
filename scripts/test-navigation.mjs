/**
 * Navigation test suite (node:test) — "Take Me to Hunter".
 *
 * Covers the required test matrix WITHOUT any production data or network:
 *  1. Destination constant: exact confirmed coordinates, no old values.
 *  2. Directions service: coordinate validation, normalization, upstream
 *     failure modes, production demo-server guard, timeout.
 *  3. State machine: granted / denied / timeout / unavailable / arrival /
 *     stop / dispose — with a fake geolocation (clearly a test mock).
 *  4. Recalculation gates: fix ≠ route call, 150 m off-route, 60 s interval,
 *     no concurrent duplicates.
 *  5. Privacy: no GPS persistence/logging primitives in navigation sources.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const clean = (p) => path.normalize(p);

// ---------------------------------------------------------------- imports
const { HUNTER_LOCATION, GOOGLE_MAPS_DIRECTIONS_URL } = await import(
  'file://' + clean(path.join(ROOT, 'src/lib/hunterLocation.ts'))
);
const { parseFromParam, fetchDirections, resolveOsrmBaseUrl } = await import(
  'file://' + clean(path.join(ROOT, 'server/lib/directions.ts'))
);
const {
  NavigationSession,
  haversineMeters,
  isValidFix,
  distanceToRoute,
  ARRIVAL_THRESHOLD_METERS,
  OFF_ROUTE_THRESHOLD_METERS,
  ROUTE_RECALC_MIN_INTERVAL_MS,
  GEO_OPTIONS,
} = await import('file://' + clean(path.join(ROOT, 'src/lib/navigationSession.ts')));

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
    'src/lib/navigationSession.ts',
    'src/components/public/ContactSection.tsx',
    'src/components/public/TakeMeToHunter.tsx',
    'src/components/public/NavMap.tsx',
    'server/lib/directions.ts',
    'server/api.ts',
  ];
  for (const f of files) {
    const text = fs.readFileSync(clean(path.join(ROOT, f)), 'utf8');
    assert.ok(!text.includes('-6.7865'), `${f} must not contain the old latitude`);
    assert.ok(!text.includes('39.2624'), `${f} must not contain the old longitude`);
  }
});

test('destination: Google fallback uses the exact confirmed coordinates', () => {
  assert.equal(GOOGLE_MAPS_DIRECTIONS_URL, 'https://maps.google.com/?q=-6.7789875,-39.265234375'.replace('-39.265234375', '39.265234375'));
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

// ================================================================ 3. STATE MACHINE
function makeFakeGeo() {
  const handlers = { watch: null, current: null };
  let watchHandle = 0;
  const cleared = [];
  const geo = {
    getCurrentPosition(success, error) { handlers.current = { success, error }; },
    watchPosition(success, error) { handlers.watch = { success, error }; return ++watchHandle; },
    clearWatch(h) { cleared.push(h); },
  };
  const fix = (lat, lng, accuracy = 12, timestamp = Date.now()) => {
    const pos = { coords: { latitude: lat, longitude: lng, accuracy, timestamp }, timestamp };
    if (handlers.current) { const h = handlers.current; handlers.current = null; h.success(pos); }
    else if (handlers.watch) handlers.watch.success(pos);
  };
  const fail = (code) => {
    const err = { code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
    if (handlers.current) { const h = handlers.current; handlers.current = null; h.error(err); }
    else if (handlers.watch) handlers.watch.error(err);
  };
  return { geo, fix, fail, cleared };
}

function makeRouteBody(distance = 12000, duration = 900) {
  return {
    ok: true, status: 200,
    json: async () => ({ success: true, data: { distanceMeters: distance, durationSeconds: duration, geometry: [[-6.7, 39.25], [-6.75, 39.26], [-6.7789, 39.265]] } }),
  };
}

test('state machine: granted → locating → navigating with route', async () => {
  let routeCalls = 0;
  const f = makeFakeGeo();
  const s = new NavigationSession({ geo: f.geo, fetchImpl: async () => { routeCalls++; return makeRouteBody(); } });
  const states = [];
  s.subscribe((st) => states.push(st.name));
  s.start();
  assert.equal(s.getState().name, 'locating');
  f.fix(-6.7, 39.25, 10);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(s.getState().name, 'navigating');
  assert.ok(s.getState().route, 'route should be set after first fix');
  assert.equal(routeCalls, 1);
  assert.deepEqual(f.cleared, []); // nothing cleared while navigating
  s.dispose();
});

test('state machine: permission denied state', () => {
  const f = makeFakeGeo();
  const s = new NavigationSession({ geo: f.geo, fetchImpl: async () => makeRouteBody() });
  s.start();
  f.fail(1);
  assert.equal(s.getState().name, 'denied');
  s.dispose();
});

test('state machine: timeout → unavailable(timeout) with Try Again semantics', () => {
  const f = makeFakeGeo();
  const s = new NavigationSession({ geo: f.geo, fetchImpl: async () => makeRouteBody() });
  s.start();
  f.fail(3);
  const st = s.getState();
  assert.equal(st.name, 'unavailable');
  if (st.name === 'unavailable') assert.equal(st.detail, 'timeout');
  // Try Again restarts cleanly
  s.start();
  assert.equal(s.getState().name, 'locating');
  s.dispose();
});

test('state machine: unsupported browser', () => {
  const s = new NavigationSession({ geo: undefined, fetchImpl: async () => makeRouteBody() });
  s.start();
  const st = s.getState();
  assert.equal(st.name, 'unavailable');
  if (st.name === 'unavailable') assert.equal(st.detail, 'unsupported');
});

test('state machine: invalid fix does not enter navigation', () => {
  const f = makeFakeGeo();
  const s = new NavigationSession({ geo: f.geo, fetchImpl: async () => makeRouteBody() });
  s.start();
  f.fix(NaN, 39.2);        // invalid
  assert.equal(s.getState().name, 'unavailable'); // first fix invalid → unavailable
  s.dispose();
});

test('state machine: arrival within 75 m stops the watch and declares arrived', async () => {
  let routeCalls = 0;
  const f = makeFakeGeo();
  const s = new NavigationSession({ geo: f.geo, fetchImpl: async () => { routeCalls++; return makeRouteBody(); } });
  s.start();
  f.fix(-6.7, 39.25);                       // start navigating ~3 km away
  await new Promise((r) => setTimeout(r, 5));
  f.fix(HUNTER_LOCATION.latitude + 0.0001, HUNTER_LOCATION.longitude); // ~11 m away
  assert.equal(s.getState().name, 'arrived');
  assert.equal(f.cleared.length, 1, 'watch cleared on arrival');
  // further fixes are ignored — no un-arrival, no more routing
  const before = routeCalls;
  f.fix(-6.7, 39.25);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(s.getState().name, 'arrived');
  assert.equal(routeCalls, before);
  s.dispose();
});

test('state machine: stop navigation clears watch and returns to idle', async () => {
  const f = makeFakeGeo();
  const s = new NavigationSession({ geo: f.geo, fetchImpl: async () => makeRouteBody() });
  s.start();
  f.fix(-6.7, 39.25);
  await new Promise((r) => setTimeout(r, 5));
  s.stop();
  assert.equal(s.getState().name, 'idle');
  assert.equal(f.cleared.length, 1);
  // position no longer exposed
  assert.equal(s.hasPosition(), false);
  s.dispose();
});

test('state machine: dispose clears watch (unmount cleanup)', async () => {
  const f = makeFakeGeo();
  const s = new NavigationSession({ geo: f.geo, fetchImpl: async () => makeRouteBody() });
  s.start();
  f.fix(-6.7, 39.25);
  await new Promise((r) => setTimeout(r, 5));
  s.dispose();
  assert.equal(f.cleared.length, 1);
  // late watch callback after dispose is ignored
  f.fix(-6.6, 39.2);
  assert.equal(s.getState().name, 'navigating'); // stale state frozen, no crash
  s.dispose();
});

test('state machine: restart clears the old watch before watching again', async () => {
  const f = makeFakeGeo();
  const s = new NavigationSession({ geo: f.geo, fetchImpl: async () => makeRouteBody() });
  s.start();
  f.fix(-6.7, 39.25);
  await new Promise((r) => setTimeout(r, 5));
  s.stop();
  s.start(); // restart
  f.fix(-6.8, 39.3);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(s.getState().name, 'navigating');
  assert.equal(f.cleared.length >= 1, true);
  s.dispose();
});

test('state machine: permission revoked mid-navigation → denied, watch cleared', async () => {
  const f = makeFakeGeo();
  const s = new NavigationSession({ geo: f.geo, fetchImpl: async () => makeRouteBody() });
  s.start();
  f.fix(-6.7, 39.25);
  await new Promise((r) => setTimeout(r, 5));
  f.fail(1); // revoke during navigation
  assert.equal(s.getState().name, 'denied');
  assert.equal(f.cleared.length, 1);
  s.dispose();
});

test('state machine: low accuracy flagged, still usable', async () => {
  const f = makeFakeGeo();
  const s = new NavigationSession({ geo: f.geo, fetchImpl: async () => makeRouteBody() });
  s.start();
  f.fix(-6.7, 39.25, 250); // poor accuracy
  await new Promise((r) => setTimeout(r, 5));
  const st = s.getState();
  assert.equal(st.name, 'navigating');
  if (st.name === 'navigating') assert.equal(st.lowAccuracy, true);
  s.dispose();
});

// ================================================================ 4. RECALCULATION GATES
test('recalculation: marker updates never trigger routing; 150 m + 60 s gates enforced', async () => {
  let routeCalls = 0;
  let t = 1_000_000;
  const f = makeFakeGeo();
  const s = new NavigationSession({ geo: f.geo, now: () => t, fetchImpl: async () => { routeCalls++; return makeRouteBody(); } });
  s.start();
  f.fix(-6.70, 39.25, 10, t);            // first fix → forced route (1)
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(routeCalls, 1);

  // tiny movements within route corridor: no recalculation
  t += 5_000;  f.fix(-6.7005, 39.2505, 10, t);   // ~74 m, on/near route
  t += 5_000;  f.fix(-6.701, 39.251, 10, t);
  t += 5_000;  f.fix(-6.7015, 39.2515, 10, t);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(routeCalls, 1, 'marker-only updates must not call routing');

  // < 60 s since last fetch → even a big deviation waits
  t += 20_000; f.fix(-6.79, 39.20, 10, t);        // far off route but too soon
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(routeCalls, 1, '60 s interval gate holds');

  // after 60 s + far off route → recalculate (2)
  t += 45_000; f.fix(-6.79, 39.20, 10, t);        // >60 s total, ≥150 m off
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(routeCalls, 2, 'off-route + interval gate passes → recalculation');

  // immediately again (in interval window): blocked
  t += 5_000;  f.fix(-6.80, 39.19, 10, t);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(routeCalls, 2, 'interval gate still holds after recalc');
  s.dispose();
});

test('recalculation: duplicate/concurrent requests prevented', async () => {
  let routeCalls = 0;
  let release;
  const gate = new Promise((r) => (release = r));
  const f = makeFakeGeo();
  const s = new NavigationSession({
    geo: f.geo,
    now: () => 5_000_000,
    fetchImpl: async () => { routeCalls++; await gate; return makeRouteBody(); },
  });
  s.start();
  f.fix(-6.7, 39.25);        // request 1 in flight (hung)
  await new Promise((r) => setTimeout(r, 5));
  // hammer with more fixes far off-route — none may start a second request
  f.fix(-6.9, 39.1);
  f.fix(-6.95, 39.0);
  f.fix(-7.0, 38.9);
  assert.equal(routeCalls, 1, 'no second request while one is in flight');
  release();                 // let request 1 finish
  await new Promise((r) => setTimeout(r, 10));
  s.dispose();
});

test('geo helpers: haversine / validity / distance-to-route', () => {
  assert.ok(Math.abs(haversineMeters(-6.7789875, 39.265234375, -6.7789875, 39.265234375)) < 0.001);
  assert.ok(Math.abs(haversineMeters(0, 0, 0, 1) - 111195) < 500);
  assert.equal(isValidFix({ latitude: -6.78, longitude: 39.26, accuracy: 10, timestamp: 1 }), true);
  assert.equal(isValidFix({ latitude: 0, longitude: 0, accuracy: 10, timestamp: 1 }), false);
  assert.equal(isValidFix({ latitude: 91, longitude: 0, accuracy: 10, timestamp: 1 }), false);
  assert.equal(isValidFix({ latitude: NaN, longitude: 39, accuracy: 10, timestamp: 1 }), false);
  assert.equal(distanceToRoute({ latitude: -6.7789, longitude: 39.265, accuracy: 5, timestamp: 1 }, [[-6.7789, 39.265]]), 0);
});

test('geo options follow the spec', () => {
  assert.equal(GEO_OPTIONS.enableHighAccuracy, true);
  assert.equal(GEO_OPTIONS.timeout, 10_000);
  assert.equal(GEO_OPTIONS.maximumAge, 15_000);
});

// ================================================================ 5. PRIVACY
test('privacy: no GPS persistence or logging primitives in navigation sources', () => {
  const files = [
    'src/lib/navigationSession.ts',
    'src/components/public/TakeMeToHunter.tsx',
    'src/components/public/NavMap.tsx',
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
