import React, { useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { HUNTER_LOCATION } from '../../lib/hunterLocation';
import {
  ACCESS_CORRIDORS,
  CORRIDOR_COLORS,
  HUNTER_LABEL,
  KEY_JUNCTION,
  type AccessCorridor,
} from '../../lib/accessCorridors';

/**
 * Access corridor map ("How to Reach Us") — a SEPARATE dynamic chunk, loaded
 * only when the section is scrolled into view. The homepage never downloads
 * this code until then.
 *
 * This is an ORIENTATION map, not a navigation product: static, verified
 * access-corridor geometry from accessCorridors.ts (real OSM ways) over the
 * standard OpenStreetMap raster tiles. No routing engine, no ETA, no geolocation.
 *
 * PRIVACY: completely passive. No location is read, nothing is sent anywhere
 * except standard OSM tile requests (the same origin the CSP already allows).
 */

/** Oversized casing pass → crisp center line → soft glow at the terminus. */
const CORRIDOR_CASING_WEIGHT = 9;
const CORRIDOR_LINE_WEIGHT = 5;

const hunterIcon = L.divIcon({
  className: 'hunter-dest-marker',
  html: `<svg width="34" height="46" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M15 0C6.7 0 0 6.7 0 15c0 11.2 15 27 15 27s15-15.8 15-27C30 6.7 23.3 0 15 0z" fill="#159EF3" stroke="#00101F" stroke-width="1.5"/>
    <text x="15" y="20.5" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="13" fill="#00101F">H</text>
  </svg>`,
  iconSize: [34, 46],
  iconAnchor: [17, 46],
  popupAnchor: [0, -44],
});

/** Fits the viewport ONCE to the corridors + workshop; never fights the user. */
const FitOnce: React.FC = () => {
  const map = useMap();
  const didFit = useRef(false);
  React.useEffect(() => {
    if (didFit.current) return;
    // Leaflet order [lat, lng] — corridors store GeoJSON order [lng, lat].
    const pts: [number, number][] = [
      ...ACCESS_CORRIDORS.flatMap((c) => c.points.map(([x, y]) => [y, x] as [number, number])),
      [HUNTER_LOCATION.latitude, HUNTER_LOCATION.longitude],
    ];
    map.fitBounds(L.latLngBounds(pts).pad(0.12), { animate: false, maxZoom: 15 });
    didFit.current = true;
  }, [map]);
  return null;
};

const corridorLine = (c: AccessCorridor): L.LatLngExpression[] =>
  c.points.map(([x, y]) => [y, x]);

const AccessMap: React.FC = () => {
  const corridorLayers = useMemo(
    () =>
      ACCESS_CORRIDORS.map((c, i) => {
        const color = CORRIDOR_COLORS[i % CORRIDOR_COLORS.length];
        const positions = corridorLine(c);
        return (
          <React.Fragment key={c.id}>
            <Polyline positions={positions} pathOptions={{ color: '#00101F', weight: CORRIDOR_CASING_WEIGHT, opacity: 0.85, lineCap: 'round', lineJoin: 'round', interactive: false }} />
            <Polyline
              positions={positions}
              pathOptions={{ color, weight: CORRIDOR_LINE_WEIGHT, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={1} className="hunter-map-tooltip">
                <span className="hunter-map-tooltip-title">{c.name}</span>
                <span className="hunter-map-tooltip-note">
                  via {c.via.join(' · ')} — about {(c.meters / 1000).toFixed(1)} km
                </span>
              </Tooltip>
            </Polyline>
          </React.Fragment>
        );
      }),
    []
  );

  return (
    <MapContainer
      center={[HUNTER_LOCATION.latitude, HUNTER_LOCATION.longitude]}
      zoom={14}
      zoomControl={false}
      attributionControl={true}
      scrollWheelZoom={false}
      className="howto-map h-full w-full bg-[#00101F]"
      style={{ background: '#00101F' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        maxNativeZoom={18}
        keepBuffer={1}
      />
      <FitOnce />

      {corridorLayers}

      {/* Verified signalised junction — the recognizable approach landmark. */}
      <CircleMarker
        center={[KEY_JUNCTION.at[1], KEY_JUNCTION.at[0]]}
        radius={5}
        pathOptions={{ color: '#FFFFFF', weight: 2, fillColor: '#F59E0B', fillOpacity: 1 }}
      >
        <Tooltip direction="top" offset={[0, -4]} opacity={1} className="hunter-map-tooltip">
          <span className="hunter-map-tooltip-title">Major junction (signals)</span>
          <span className="hunter-map-tooltip-note">{KEY_JUNCTION.name}</span>
        </Tooltip>
      </CircleMarker>

      {/* The workshop itself — always the visual anchor. */}
      <Marker position={[HUNTER_LOCATION.latitude, HUNTER_LOCATION.longitude]} icon={hunterIcon} title={HUNTER_LABEL} alt="Hunter Autoworks — Kinondoni Morocco, Block 41" />
      <CircleMarker
        center={[HUNTER_LOCATION.latitude, HUNTER_LOCATION.longitude]}
        radius={18}
        pathOptions={{ color: '#159EF3', weight: 1.5, opacity: 0.5, fillColor: '#159EF3', fillOpacity: 0.1, interactive: false }}
      />

      {/* Screen-reader textual summary: the map is never the only source. */}
      <span className="sr-only">
        Map of Hunter Autoworks at {HUNTER_LOCATION.address}. Highlighted approach corridors:
        {' '}{ACCESS_CORRIDORS.map((c) => `${c.name} (via ${c.via.join(', ')}, about ${(c.meters / 1000).toFixed(1)} km)`).join('; ')}.
        The map can be panned and zoomed with touch or mouse.
      </span>
    </MapContainer>
  );
};

export default AccessMap;
