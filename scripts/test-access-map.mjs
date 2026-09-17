/**
 * How-to-Reach-Us access map test suite (node:test).
 *
 * Verifies the feature's data integrity, security posture, and scope
 * boundaries WITHOUT any network access — everything derives from the
 * checked-in sources:
 *  1. Google Maps handoff: keyless universal link to the confirmed destination.
 *  2. Marker position derives from the single authoritative HUNTER_LOCATION.
 *  3. Corridor data integrity: real geometry, plausible lengths, terminus at
 *     the workshop street, valid GeoJSON coordinates.
 *  4. Scope: no routing engines / paid APIs anywhere in this feature.
 *  5. Integration: lazy chunk wiring, one CTA, no leaks to the browser bundle
 *     of anything beyond the verified constants.
 *  6. Provenance: generator + OSM datasets checked in; regenerated module is
 *     byte-stable (deterministic).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Load TS sources through tsx (respects the project's tsconfig paths).
process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --import tsx';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const clean = (p) => path.normalize(p);
const read = (p) => fs.readFileSync(clean(path.join(ROOT, p)), 'utf8');

// ---------------------------------------------------------------- imports
const { HUNTER_LOCATION } = await import('file://' + clean(path.join(ROOT, 'src/lib/hunterLocation.ts')));
const { GOOGLE_MAPS_DIRECTIONS_UNIVERSAL_URL } = await import('file://' + clean(path.join(ROOT, 'src/lib/googleMaps.ts')));
const { ACCESS_CORRIDORS, HUNTER_POINT, KEY_JUNCTION, CORRIDOR_COLORS } = await import(
  'file://' + clean(path.join(ROOT, 'src/lib/accessCorridors.ts'))
);

// ================================================================ 1. GOOGLE HANDOFF
test('handoff: keyless universal directions URL to the confirmed destination', () => {
  assert.match(GOOGLE_MAPS_DIRECTIONS_UNIVERSAL_URL, /^https:\/\/www\.google\.com\/maps\/dir\/\?/);
  const url = new URL(GOOGLE_MAPS_DIRECTIONS_UNIVERSAL_URL);
  assert.equal(url.searchParams.get('api'), '1');
  assert.equal(url.searchParams.get('destination'), `${HUNTER_LOCATION.latitude},${HUNTER_LOCATION.longitude}`);
  assert.ok(!GOOGLE_MAPS_DIRECTIONS_UNIVERSAL_URL.includes('key='), 'no API key anywhere');
  assert.ok(!GOOGLE_MAPS_DIRECTIONS_UNIVERSAL_URL.includes('maps.googleapis.com'), 'no JS SDK endpoint');
});

// ================================================================ 2. MARKER SOURCE
test('marker: derives from the single authoritative HUNTER_LOCATION', () => {
  assert.equal(HUNTER_POINT[0], HUNTER_LOCATION.longitude);
  assert.equal(HUNTER_POINT[1], HUNTER_LOCATION.latitude);
  assert.equal(HUNTER_POINT[0], 39.265234375);
  assert.equal(HUNTER_POINT[1], -6.7789875);
});

// ================================================================ 3. CORRIDOR DATA
test('corridors: three approaches, unique ids, valid GeoJSON coordinate pairs', () => {
  assert.equal(ACCESS_CORRIDORS.length, 3);
  const ids = new Set(ACCESS_CORRIDORS.map((c) => c.id));
  assert.equal(ids.size, 3);
  for (const c of ACCESS_CORRIDORS) {
    assert.ok(c.points.length >= 2, `${c.id} needs geometry`);
    for (const [x, y] of c.points) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y), `${c.id} non-numeric coord`);
      assert.ok(x > 39.0 && x < 39.6 && y < -6.7 && y > -6.9, `${c.id} coordinate outside Dar es Salaam window`);
    }
  }
});

const haversine = (a, b) => {
  const R = 6371000, d2r = (d) => (d * Math.PI) / 180;
  const dLat = d2r(b[1] - a[1]), dLng = d2r(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(d2r(a[1])) * Math.cos(d2r(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

test('corridors: declared meters within 20% of measured polyline length', () => {
  for (const c of ACCESS_CORRIDORS) {
    let m = 0;
    for (let i = 1; i < c.points.length; i++) m += haversine(c.points[i - 1], c.points[i]);
    assert.ok(Math.abs(m - c.meters) / c.meters < 0.2, `${c.id}: declared ${c.meters} m vs measured ${Math.round(m)} m`);
  }
});

test('corridors: every approach terminates on the workshop street (Kwamsama side)', () => {
  // The corridor end must sit within 150 m of the workshop marker — that is
  // the verified Kwamsama point (~78 m from the door) in the OSM road graph.
  for (const c of ACCESS_CORRIDORS) {
    const end = c.points[c.points.length - 1];
    const d = haversine(end, HUNTER_POINT);
    assert.ok(d < 150, `${c.id} ends ${Math.round(d)} m from Hunter — must terminate at the workshop approach`);
  }
});

test('corridors: honest attribution — via names verified OSM roads', () => {
  const KNOWN = [
    'Kawawa Road', 'Ali Hassan Mwinyi Road', 'Mwai Kibaki Road', 'New Bagamoyo Road',
    'Old Bagamoyo Road', 'Barabara ya Vumbi Dawasco',
  ];
  for (const c of ACCESS_CORRIDORS) {
    assert.ok(c.via.length >= 1, `${c.id} must name at least its major road`);
    for (const n of c.via) assert.ok(KNOWN.includes(n), `${c.id} names unverified road "${n}"`);
    assert.ok(!c.via.includes('Kwamsama'), 'terminus street is annotated separately, not in via');
  }
});

test('junction landmark: verified signals position on the AHM axis', () => {
  assert.equal(KEY_JUNCTION.at[0], 39.2638744);
  assert.equal(KEY_JUNCTION.at[1], -6.7772672);
  const d = haversine(KEY_JUNCTION.at, HUNTER_POINT);
  assert.ok(d > 100 && d < 500, `junction should be the nearby landmark (${Math.round(d)} m)`);
});

test('palette: three distinct corridor colors for the legend/layers contract', () => {
  assert.equal(CORRIDOR_COLORS.length, 3);
  assert.equal(new Set(CORRIDOR_COLORS).size, 3);
});

// ================================================================ 4. SCOPE / SECURITY
test('scope: feature introduces no routing engine, SDK, or paid API', () => {
  const files = [
    'src/components/public/AccessMap.tsx',
    'src/components/public/HowToReachUs.tsx',
    'src/lib/accessCorridors.ts',
    'src/lib/googleMaps.ts',
  ];
  const forbidden = ['osrm', 'graphhopper', 'valhalla', 'mapbox', 'googleapis.com/maps/api', 'maps.googleapis.com', 'apikey', 'api_key='];
  for (const f of files) {
    const text = read(f).toLowerCase();
    for (const bad of forbidden) {
      assert.ok(!text.includes(bad), `${f} must not reference "${bad}"`);
    }
  }
});

test('privacy: the access map is fully passive — no geolocation, no fetches', () => {
  for (const f of ['src/components/public/AccessMap.tsx', 'src/components/public/HowToReachUs.tsx']) {
    const text = read(f);
    for (const bad of ['getCurrentPosition', 'watchPosition', 'fetch(', 'XMLHttpRequest', 'localStorage']) {
      assert.ok(!text.includes(bad), `${f} must not use ${bad}`);
    }
  }
});

test('secrets: no credentials in the geo provenance or feature files', () => {
  const files = ['scripts/geo/build-access-corridors.mjs', 'src/lib/accessCorridors.ts', 'src/lib/googleMaps.ts'];
  const secretish = /(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z]+ PRIVATE KEY-----)/;
  for (const f of files) {
    const text = read(f);
    assert.ok(!secretish.test(text), `${f} contains a credential pattern`);
  }
});

// ================================================================ 5. INTEGRATION
test('integration: section wired into ContactSection with lazy chunk and CTA', () => {
  const contact = read('src/components/public/ContactSection.tsx');
  assert.ok(contact.includes("from './HowToReachUs'"), 'ContactSection must mount HowToReachUs');
  const howTo = read('src/components/public/HowToReachUs.tsx');
  assert.ok(howTo.includes("lazy(() => import('./AccessMap'))"), 'map must be a lazy chunk');
  assert.ok(howTo.includes('GOOGLE_MAPS_DIRECTIONS_UNIVERSAL_URL'), 'CTA must use the universal link');
  assert.ok(howTo.includes('IntersectionObserver') || howTo.includes('nearViewport'), 'map must lazy-load near viewport');
});

test('integration: exactly one Google Maps handoff in the section, properly labelled', () => {
  const howTo = read('src/components/public/HowToReachUs.tsx');
  const ctas = howTo.match(/GOOGLE_MAPS_DIRECTIONS_UNIVERSAL_URL/g) ?? [];
  assert.equal(ctas.length, 2, 'one import + one usage');
  assert.ok(howTo.includes('Open Hunter Autoworks in Google Maps'), 'accessible CTA name present');
  assert.ok(howTo.includes('rel="noopener noreferrer"'), 'external link hardened');
});

test('integration: map tile usage matches the existing sanctioned provider only', () => {
  const map = read('src/components/public/AccessMap.tsx');
  assert.ok(map.includes('tile.openstreetmap.org'), 'standard OSM raster tiles');
  assert.ok(!/tile\.(?!openstreetmap)/.test(map), 'no other tile host');
  assert.ok(map.includes('openstreetmap.org/copyright'), 'attribution link present');
  assert.equal(read('src/index.css').includes('howto-map .leaflet-control-attribution'), true, 'attribution styled visible');
});

// ================================================================ 6. PROVENANCE
test('provenance: generator + raw OSM datasets are checked in', () => {
  assert.ok(fs.existsSync(clean(path.join(ROOT, 'scripts/geo/build-access-corridors.mjs'))));
  for (const f of ['major.json', 'major2.json', 'local.json', 'traffic.json']) {
    assert.ok(fs.existsSync(clean(path.join(ROOT, `scripts/geo/${f}`))), `scripts/geo/${f} must exist`);
  }
});

test('provenance: regeneration is byte-stable (deterministic output)', () => {
  const before = read('src/lib/accessCorridors.ts');
  execFileSync(process.execPath, [clean(path.join(ROOT, 'scripts/geo/build-access-corridors.mjs'))], { cwd: ROOT, stdio: 'ignore' });
  const after = read('src/lib/accessCorridors.ts');
  assert.equal(after, before, 'regenerated module must be identical');
});
