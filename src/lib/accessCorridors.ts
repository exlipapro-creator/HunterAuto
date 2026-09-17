/**
 * HOW TO REACH US — verified geographic data (single source of truth).
 *
 * Every coordinate below is REAL OpenStreetMap road geometry, fetched from the
 * canonical Overpass API instance (overpass-api.de) and traced through the
 * actual road-network graph with Dijkstra — no invented roads, no guessed
 * intersections, no hand-drawn approximations. REGENERATE with:
 * `node scripts/geo/build-access-corridors.mjs` — the raw Overpass responses
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
  at: [39.2638744, -6.7772672] as [number, number],
};

export const ACCESS_CORRIDORS: AccessCorridor[] = [
  {
    id: 'kawawa-south',
    name: 'From the south — Kawawa Road',
    via: ["Kawawa Road"],
    note: 'Primary north–south road one block west of the workshop; the main approach from the city-centre side.',
    meters: 1508,
    points: [[39.264131, -6.7918606], [39.2639054, -6.7911814], [39.2637125, -6.7901512], [39.2636279, -6.7895653], [39.26353, -6.7885808], [39.2635345, -6.7875602], [39.2635354, -6.7873667], [39.2636487, -6.7856285], [39.2636701, -6.7851158], [39.2636857, -6.7841065], [39.2637277, -6.7831096], [39.2637879, -6.7816831], [39.2640567, -6.7817355], [39.2641497, -6.7814643], [39.2642041, -6.7813173], [39.264807, -6.7815694], [39.2650885, -6.7810151], [39.2651236, -6.7803072], [39.2651719, -6.7797329], [39.2651755, -6.7796867]],
  },
  {
    id: 'ali-hassan-mwinyi-east',
    name: 'From the east — Ali Hassan Mwinyi Road',
    via: ["Ali Hassan Mwinyi Road","Barabara ya Vumbi Dawasco"],
    note: 'Main trunk road approaching from the east along the Morocco strip.',
    meters: 1405,
    points: [[39.2744497, -6.7812176], [39.2731581, -6.7801772], [39.2730772, -6.780115], [39.2729827, -6.7800328], [39.2725913, -6.7797496], [39.2722057, -6.7794667], [39.2717383, -6.7791576], [39.271614, -6.7790963], [39.2713722, -6.7789603], [39.2710338, -6.77877], [39.2709634, -6.7787304], [39.2709866, -6.7788168], [39.2710307, -6.7789072], [39.2705255, -6.7786751], [39.2700854, -6.7784723], [39.2700218, -6.7785693], [39.2699634, -6.7786916], [39.2699178, -6.7787875], [39.2698681, -6.7788994], [39.2697768, -6.7790831], [39.2694966, -6.7789673], [39.26927, -6.7788567], [39.2690428, -6.7787492], [39.2689448, -6.7787017], [39.2686491, -6.7785731], [39.2684787, -6.7784955], [39.2682017, -6.778388], [39.267894, -6.7783054], [39.2676499, -6.7782308], [39.267379, -6.7781536], [39.2671683, -6.7781037], [39.2669928, -6.7780524], [39.2666378, -6.7779965], [39.2664188, -6.7779698], [39.2662053, -6.7779423], [39.2660628, -6.7779312], [39.2659099, -6.7779263], [39.2656182, -6.7779312], [39.2654292, -6.7779395], [39.2652242, -6.7779546], [39.2652253, -6.7780438], [39.2651755, -6.7796867]],
  },
  {
    id: 'new-bagamoyo-west',
    name: 'From the west — New Bagamoyo Road',
    via: ["New Bagamoyo Road"],
    note: 'Trunk road approaching from the west (Magomeni side).',
    meters: 2003,
    points: [[39.2500255, -6.7777858], [39.2505293, -6.7779431], [39.2512054, -6.7780885], [39.2520627, -6.7782594], [39.2523077, -6.7783111], [39.2524626, -6.7783438], [39.2529183, -6.7783937], [39.2530396, -6.7784034], [39.2532699, -6.7784276], [39.2534965, -6.7784389], [39.2537602, -6.7784392], [39.2539543, -6.7784414], [39.2541185, -6.7784456], [39.2545237, -6.7784446], [39.2547031, -6.7784472], [39.254883, -6.7784294], [39.2553052, -6.7783891], [39.2554896, -6.7783735], [39.2557849, -6.7783345], [39.2560323, -6.7782914], [39.2564027, -6.7782324], [39.2573248, -6.7780988], [39.257484, -6.7780733], [39.2594054, -6.7777866], [39.2599103, -6.7777109], [39.260135, -6.7776696], [39.260264, -6.7776508], [39.2604431, -6.7776298], [39.2608053, -6.7775747], [39.2615536, -6.7774551], [39.2623127, -6.7773338], [39.2624009, -6.7773226], [39.2625254, -6.7773027], [39.2631647, -6.7771889], [39.2637, -6.777136], [39.2638796, -6.7771409], [39.2638744, -6.7772672], [39.2639086, -6.7778554], [39.2639256, -6.7781469], [39.2639931, -6.7781725], [39.2641786, -6.7781414], [39.2645197, -6.7780867], [39.2647317, -6.7780457], [39.2649449, -6.7780058], [39.2652242, -6.7779546], [39.2652253, -6.7780438], [39.2651755, -6.7796867]],
  },
];
