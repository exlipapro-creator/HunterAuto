import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap } from 'react-leaflet';
import { HUNTER_LOCATION } from '../../lib/hunterLocation';
import type { NavFix, RouteInfo } from '../../lib/navigationSession';
import 'leaflet/dist/leaflet.css';

/**
 * The actual Leaflet map — a SEPARATE dynamic chunk loaded only when
 * navigation is active. The homepage never downloads this code.
 *
 * UX contract with the shell:
 *  - The customer's marker updates on every accepted GPS fix (no route call).
 *  - Manual panning/zooming is respected; the map does NOT fight the user.
 *    It pans to the customer only when `recenterSignal` changes (Recenter
 *    button) — never on every fix.
 */

// Restrained Hunter-palette destination marker (single SVG pin, brand blue
// with the "H" mark). No emoji, no glow.
const hunterIcon = L.divIcon({
  className: 'hunter-dest-marker',
  html: `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M15 0C6.7 0 0 6.7 0 15c0 11.2 15 27 15 27s15-15.8 15-27C30 6.7 23.3 0 15 0z" fill="#159EF3" stroke="#00101F" stroke-width="1.5"/>
    <text x="15" y="20.5" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="13" fill="#00101F">H</text>
  </svg>`,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
  popupAnchor: [0, -40],
});

const customerIcon = (lowAccuracy: boolean) =>
  L.divIcon({
    className: 'hunter-customer-marker',
    html: `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="9" cy="9" r="6" fill="${lowAccuracy ? '#F59E0B' : '#159EF3'}" stroke="#00101F" stroke-width="2"/>
    </svg>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

interface RecenterProps {
  position: NavFix | null;
  recenterSignal: number;
}

/** Pans to the customer ONLY on an explicit recenter signal. */
const RecenterOnSignal: React.FC<RecenterProps> = ({ position, recenterSignal }) => {
  const map = useMap();
  const lastSignal = useRef(recenterSignal);
  useEffect(() => {
    if (recenterSignal !== lastSignal.current) {
      lastSignal.current = recenterSignal;
      if (position) {
        map.setView([position.latitude, position.longitude], Math.max(map.getZoom(), 15), { animate: true });
      }
    }
  }, [recenterSignal, position, map]);
  return null;
};

interface NavMapProps {
  position: NavFix | null;
  route: RouteInfo | null;
  arrived: boolean;
  recenterSignal: number;
}

const NavMap: React.FC<NavMapProps> = ({ position, route, arrived, recenterSignal }) => {
  // Fit the map once, when the first route (or first fix, pre-route) appears,
  // so the customer immediately sees themselves AND the destination.
  const fitRef = useRef(false);
  const FitInitial: React.FC = useMemo(() => {
    const Comp: React.FC = () => {
      const map = useMap();
      useEffect(() => {
        if (fitRef.current) return;
        const points: [number, number][] = [];
        if (route) points.push(...route.geometry);
        if (position) points.push([position.latitude, position.longitude]);
        points.push([HUNTER_LOCATION.latitude, HUNTER_LOCATION.longitude]);
        if (points.length >= 2) {
          map.fitBounds(L.latLngBounds(points).pad(0.15), { animate: false });
          fitRef.current = true;
        }
      }, [map]);
      return null;
    };
    return Comp;
  }, [route, position]);

  const destLabel = `${HUNTER_LOCATION.address} — Plus Code ${HUNTER_LOCATION.plusCode}`;

  return (
    <MapContainer
      center={[HUNTER_LOCATION.latitude, HUNTER_LOCATION.longitude]}
      zoom={15}
      zoomControl={false}
      attributionControl={true}
      className="h-full w-full bg-[#00101F]"
      style={{ background: '#00101F' }}
      doubleClickZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        // Keep tile usage restrained on mobile data: ~ 7×7 tiles is plenty for
        // in-city navigation; customers can zoom manually if needed.
        maxNativeZoom={18}
        keepBuffer={1}
      />
      <RecenterOnSignal position={position} recenterSignal={recenterSignal} />
      <FitInitial />
      {/* Authoritative Hunter destination */}
      <Marker position={[HUNTER_LOCATION.latitude, HUNTER_LOCATION.longitude]} icon={hunterIcon} title="Hunter Autoworks" alt="Hunter Autoworks — Kinondoni Morocco, Block 41" />
      {/* Customer position + accuracy halo (only while a live fix exists) */}
      {position && !arrived && (
        <>
          <CircleMarker
            center={[position.latitude, position.longitude]}
            radius={Math.min(28, Math.max(6, position.accuracy / 8))}
            pathOptions={{ color: '#159EF3', weight: 1, opacity: 0.35, fillColor: '#159EF3', fillOpacity: 0.12 }}
          />
          <Marker position={[position.latitude, position.longitude]} icon={customerIcon(false)} alt="Your current position" />
        </>
      )}
      {position && arrived && (
        <CircleMarker
          center={[position.latitude, position.longitude]}
          radius={10}
          pathOptions={{ color: '#10B981', weight: 2, fillColor: '#10B981', fillOpacity: 0.25 }}
        />
      )}
      {/* The real route — only from the routing response; never fabricated */}
      {route && (
        <Polyline positions={route.geometry} pathOptions={{ color: '#159EF3', weight: 4, opacity: 0.9 }} />
      )}
      {/* Screen-reader-accessible textual summary: the map is never the only source */}
      <span className="sr-only" aria-live="polite">
        {route
          ? `Route to Hunter Autoworks: ${(route.distanceMeters / 1000).toFixed(1)} kilometres, about ${Math.max(1, Math.round(route.durationSeconds / 60))} minutes.`
          : 'Locating. Route will appear when calculated.'}
        Destination: {destLabel}.
      </span>
    </MapContainer>
  );
};

export default NavMap;
