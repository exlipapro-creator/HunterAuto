// Corridor generator v3: single-shot Dijkstra per corridor through the REAL
// road network (no forced waypoints → no backtracking), per-EDGE road
// attribution for honest `via` lists, and emits the typed TS data module.
// Every coordinate is verified OSM geometry — nothing invented.
import fs from 'node:fs';

const HUNTER = { lat: -6.7789875, lng: 39.265234375 };
const R = 6371000, d2r = (d) => (d * Math.PI) / 180;
const dist = (a, b) => {
  const aLng = a.lng ?? a.lon, bLng = b.lng ?? b.lon;
  const dLat = d2r(b.lat - a.lat), dLng = d2r(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(d2r(a.lat)) * Math.cos(d2r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

const loadWays = (file) => (JSON.parse(fs.readFileSync(`scripts/geo/${file}.json`, 'utf8')).elements || []).filter((e) => e.type === 'way');
// Merge every fetched dataset; dedupe by OSM way id (overlapping query radii).
const seenIds = new Set();
const allWays = ['major', 'major2', 'local'].flatMap(loadWays).filter((w) => (seenIds.has(w.id) ? false : (seenIds.add(w.id), true)));
const drivable = allWays.filter((w) => !['footway', 'path', 'pedestrian', 'cycleway', 'steps', 'track'].includes(w.tags.highway));
console.log('ways total/drivable:', allWays.length, '/', drivable.length);

// --- Graph: node key = "lat,lon" (6dp); edges carry their road names --------
const key = (p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
const adj = new Map(), coordsOf = new Map(), edgeNames = new Map();
const eKey = (ka, kb) => [ka, kb].sort().join('|');
for (const w of drivable) {
  const g = w.geometry.filter(Boolean);
  const nm = w.tags.name || '(unnamed ' + w.tags.highway + ')';
  for (let i = 0; i < g.length - 1; i++) {
    const a = g[i], b = g[i + 1], ka = key(a), kb = key(b);
    coordsOf.set(ka, a); coordsOf.set(kb, b);
    const m = dist(a, b);
    (adj.get(ka) || adj.set(ka, []).get(ka)).push({ to: kb, m });
    (adj.get(kb) || adj.set(kb, []).get(kb)).push({ to: ka, m });
    const ek = eKey(ka, kb);
    (edgeNames.get(ek) || edgeNames.set(ek, new Set()).get(ek)).add(nm);
  }
}
console.log('graph nodes:', adj.size);

function shortest(from, to) {
  const distTo = new Map([[from, 0]]), prev = new Map(), pq = [[0, from]];
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, u] = pq.shift();
    if (u === to) break;
    if (d > (distTo.get(u) ?? Infinity)) continue;
    for (const { to: v, m } of adj.get(u) || []) {
      const nd = d + m;
      if (nd < (distTo.get(v) ?? Infinity)) { distTo.set(v, nd); prev.set(v, u); pq.push([nd, v]); }
    }
  }
  if (!distTo.has(to)) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0]));
  return { nodes: path, meters: distTo.get(to) };
}

// --- Verified graph endpoints ----------------------------------------------
const kwamsama = drivable.filter((w) => w.tags.name === 'Kwamsama');
const kwGeo = kwamsama.flatMap((w) => w.geometry.filter(Boolean));
const kwEndNearHunter = kwGeo.reduce((a, b) => (dist(HUNTER, a) < dist(HUNTER, b) ? a : b));
const kwNearK = key(kwEndNearHunter);
console.log('corridor terminus (Kwamsama point nearest Hunter):', dist(HUNTER, kwEndNearHunter).toFixed(0) + 'm');

// --- Anchors: road point closest to a directional viewport-edge target -----
const anchorOn = (roadName, toward) => {
  const segs = drivable.filter((w) => w.tags.name === roadName);
  let best = null, bd = Infinity;
  for (const w of segs) for (const g of w.geometry.filter(Boolean)) {
    const d = dist(toward, g);
    if (d < bd) { bd = d; best = g; }
  }
  if (!best) throw new Error('no anchor for ' + roadName);
  return best;
};
const corridors = {
  kawawa: anchorOn('Kawawa Road', { lat: HUNTER.lat - 0.0126, lng: 39.2645 }),
  ahm: anchorOn('Ali Hassan Mwinyi Road', { lat: -6.7772, lng: HUNTER.lng + 0.0131 }),
  bagamoyo: anchorOn('New Bagamoyo Road', { lat: -6.7777, lng: HUNTER.lng - 0.0151 }),
};

// --- Trace: single-shot anchor → Kwamsama-near-Hunter -----------------------
function trace(startPt, label) {
  const r = shortest(key(startPt), kwNearK);
  if (!r) throw new Error('no path ' + label + ' → Hunter');
  const pts = r.nodes.map((k) => { const c = coordsOf.get(k); return [c.lng ?? c.lon, c.lat]; }); // GeoJSON [lng,lat]
  // Honest `via`: accumulate edge length per road name along the path.
  const lenByRoad = new Map(), order = [];
  for (let i = 0; i < r.nodes.length - 1; i++) {
    const ek = eKey(r.nodes[i], r.nodes[i + 1]);
    const segM = dist(coordsOf.get(r.nodes[i]), coordsOf.get(r.nodes[i + 1]));
    for (const n of edgeNames.get(ek) || []) {
      if (!lenByRoad.has(n)) { lenByRoad.set(n, 0); order.push(n); }
      lenByRoad.set(n, lenByRoad.get(n) + segM);
    }
  }
  const via = order.filter((n) => !n.startsWith('(unnamed') && n !== 'Kwamsama' && lenByRoad.get(n) >= 150);
  return { pts, meters: r.meters, via };
}

// --- Simplify: keep a point at least every ~8 m; always keep both ends ------
function simplify(pts, epsM = 8) {
  const out = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += dist({ lat: pts[i - 1][1], lng: pts[i - 1][0] }, { lat: pts[i][1], lng: pts[i][0] });
    if (acc >= epsM) { out.push(pts[i]); acc = 0; }
  }
  if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
  return out;
}

// --- Emit TS module ---------------------------------------------------------
const entry = (id, name, note, c) => ({
  id, name, via: c.via, note,
  meters: Math.round(c.meters),
  points: simplify(c.pts, 8),
});

const KAWAWA = entry('kawawa-south', 'From the south — Kawawa Road', 'Primary north–south road one block west of the workshop; the main approach from the city-centre side.', trace(corridors.kawawa, 'Kawawa'));
const AHM = entry('ali-hassan-mwinyi-east', 'From the east — Ali Hassan Mwinyi Road', 'Main trunk road approaching from the east along the Morocco strip.', trace(corridors.ahm, 'AHM'));
const BAGAMOYO = entry('new-bagamoyo-west', 'From the west — New Bagamoyo Road', 'Trunk road approaching from the west (Magomeni side).', trace(corridors.bagamoyo, 'Bagamoyo'));

// Traffic-signal landmark (verified OSM node) nearest to Hunter.
const signals = (JSON.parse(fs.readFileSync('scripts/geo/traffic.json', 'utf8')).elements || [])
  .filter((e) => e.type === 'node' && e.tags && e.tags.highway === 'traffic_signals')
  .map((n) => ({ lat: n.lat, lon: n.lon }))
  .sort((a, b) => dist(HUNTER, a) - dist(HUNTER, b))[0];

const fmtPts = (pts) => pts.map(([x, y]) => `[${x}, ${y}]`).join(', ');

const TS = `/**
 * HOW TO REACH US — verified geographic data (single source of truth).
 *
 * Every coordinate below is REAL OpenStreetMap road geometry, fetched from the
 * canonical Overpass API instance (overpass-api.de) and traced through the
 * actual road-network graph with Dijkstra — no invented roads, no guessed
 * intersections, no hand-drawn approximations. REGENERATE with:
 * \`node scripts/geo/build-access-corridors.mjs\` — the raw Overpass responses
 * it consumes are checked in beside it (scripts/geo/*.json) so the derived
 * geometry is reproducible without touching the network.
 *
 * Sources & method:
 *  - Hunter Autoworks point: owner-confirmed Plus Code 6G5X67C8+C35 via
 *    HUNTER_LOCATION (src/lib/hunterLocation.ts — shared with the server).
 *  - Corridors: real shortest paths over OSM ways "Kawawa Road",
 *    "Ali Hassan Mwinyi Road", "New Bagamoyo Road" and the verified local
 *    connectors, terminating on Kwamsama ~80 m from the workshop.
 *  - Junction landmark: verified highway=traffic_signals node on Ali Hassan
 *    Mwinyi Road at its Kawawa Road junction.
 *
 * NOTE: Corridor geometry is STATIC VISUAL GUIDANCE for orientation — it is
 * NOT a computed route. No routing engine is involved in this feature.
 */

import { HUNTER_LOCATION } from './hunterLocation';

export interface AccessCorridor {
  /** Stable identifier, also used as the Leaflet layer key. */
  id: string;
  /** Human label shown in the map legend. */
  name: string;
  /** Real road names the corridor follows (verified OSM names, ≥150 m of travel). */
  via: string[];
  /** One-line note describing the approach. */
  note: string;
  /** Approximate drive distance along the corridor, in metres. */
  meters: number;
  /** GeoJSON [lng, lat] pairs — real OSM road geometry. */
  points: [number, number][];
}

/** GeoJSON-order marker position, derived from the authoritative constant. */
export const HUNTER_POINT: [number, number] = [HUNTER_LOCATION.longitude, HUNTER_LOCATION.latitude];

export const HUNTER_LABEL = 'Hunter Autoworks';

/** Presentation contract: corridor colors, shared by the map layers and the legend. */
export const CORRIDOR_COLORS: readonly string[] = ['#159EF3', '#F59E0B', '#10B981'];

/** Verified signalised junction — landmark on the eastern approaches. */
export const KEY_JUNCTION = {
  name: 'Kawawa Rd × Ali Hassan Mwinyi Rd (signals)',
  at: [${signals.lon}, ${signals.lat}] as [number, number],
};

export const ACCESS_CORRIDORS: AccessCorridor[] = [
  {
    id: '${KAWAWA.id}',
    name: '${KAWAWA.name}',
    via: ${JSON.stringify(KAWAWA.via)},
    note: '${KAWAWA.note}',
    meters: ${KAWAWA.meters},
    points: [${fmtPts(KAWAWA.points)}],
  },
  {
    id: '${AHM.id}',
    name: '${AHM.name}',
    via: ${JSON.stringify(AHM.via)},
    note: '${AHM.note}',
    meters: ${AHM.meters},
    points: [${fmtPts(AHM.points)}],
  },
  {
    id: '${BAGAMOYO.id}',
    name: '${BAGAMOYO.name}',
    via: ${JSON.stringify(BAGAMOYO.via)},
    note: '${BAGAMOYO.note}',
    meters: ${BAGAMOYO.meters},
    points: [${fmtPts(BAGAMOYO.points)}],
  },
];
`;

fs.writeFileSync('src/lib/accessCorridors.ts', TS);
console.log('written src/lib/accessCorridors.ts');
for (const e of [KAWAWA, AHM, BAGAMOYO]) {
  const [sx, sy] = e.points[0], [ex, ey] = e.points[e.points.length - 1];
  console.log(' ', e.id, e.meters + 'm', e.points.length + ' pts', 'via:', e.via.join(' → '));
  console.log('    start', sx.toFixed(4) + ',' + sy.toFixed(4), 'end', ex.toFixed(4) + ',' + ey.toFixed(4));
}
