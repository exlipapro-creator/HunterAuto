import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { ExternalLink, MapPin, Loader2 } from 'lucide-react';
import { HUNTER_LOCATION } from '../../lib/hunterLocation';
import { GOOGLE_MAPS_DIRECTIONS_UNIVERSAL_URL } from '../../lib/googleMaps';
import { ACCESS_CORRIDORS, CORRIDOR_COLORS, HUNTER_LABEL } from '../../lib/accessCorridors';

/**
 * HOW TO REACH US — a professional visual access map.
 *
 * Purpose: ORIENTATION, not navigation. A real rendered OpenStreetMap shows
 * where the workshop is, the verified approach corridors (real OSM road
 * geometry, no invented roads), and the signalised junction landmark — then a
 * single subtle action hands the customer to Google Maps for actual
 * turn-by-turn navigation.
 *
 * The Leaflet map code lives in a separate dynamic chunk (./AccessMap) that is
 * fetched ONLY when this section scrolls near the viewport — the homepage
 * never pays for it up front.
 */

const AccessMap = lazy(() => import('./AccessMap'));

/** Small legend swatch: corridor color chip + distinguishing shape glyph. */
const Swatch: React.FC<{ color: string; glyph: string }> = ({ color, glyph }) => (
  <span
    aria-hidden="true"
    className="inline-block w-6 h-[5px] rounded-full shrink-0 relative"
    style={{ backgroundColor: color }}
  >
    <span
      className="absolute inset-0 flex items-center justify-center text-[7px] font-bold leading-none"
      style={{ color: '#00101F' }}
    >
      {glyph}
    </span>
  </span>
);

const MapLoading: React.FC = () => (
  <div className="h-full w-full flex items-center justify-center tech-grid-bg" aria-live="polite">
    <Loader2 className="w-5 h-5 text-[#159EF3] animate-spin" aria-hidden="true" />
    <span className="sr-only">Loading map</span>
  </div>
);

export const HowToReachUs: React.FC = () => {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const [nearViewport, setNearViewport] = useState(false);

  // Lazy-load the map chunk (and start tile fetching) only when the section
  // approaches the viewport — consistent with the app's map-chunk pattern.
  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNearViewport(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNearViewport(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="rounded-xl border border-[#132038] bg-[#000000] overflow-hidden" id="how-to-reach-us">
      {/* Section header */}
      <div className="px-4 sm:px-6 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#159EF3]" aria-hidden="true" />
          <h3 className="font-display font-bold text-white uppercase text-base sm:text-lg tracking-tight">
            How to Reach Us
          </h3>
        </div>
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
          Highlighted corridors show the main ways customers approach the workshop —
          the highlighted lines follow real roads, from the major roads to our door on Kwamsama.
          Pan or pinch the map to explore.
        </p>
      </div>

      {/* The map */}
      <div ref={holderRef} className="relative h-72 sm:h-96 lg:h-[26rem] w-full border-y border-[#132038]">
        {nearViewport ? (
          <Suspense fallback={<MapLoading />}>
            <div className="h-full w-full" role="region" aria-label="Access map showing approach corridors to Hunter Autoworks">
              <AccessMap />
            </div>
          </Suspense>
        ) : (
          <div className="h-full w-full tech-grid-bg" aria-hidden="true" />
        )}
      </div>

      {/* Legend — color chips + shape glyphs so lines are distinguishable without color alone */}
      <div className="px-4 sm:px-6 py-3 border-b border-[#132038] font-mono-telemetry text-[11px] text-slate-300 space-y-1.5" aria-label="Map legend">
        {ACCESS_CORRIDORS.map((c, i) => (
          <div key={c.id} className="flex items-start gap-2.5">
            <Swatch color={CORRIDOR_COLORS[i % CORRIDOR_COLORS.length]} glyph={String(i + 1)} />
            <span className="leading-snug">
              <span className="text-white font-semibold">{c.name}</span>
              <span className="text-slate-400"> — via {c.via.join(', ')}</span>
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="inline-block w-6 h-[5px] shrink-0 relative rounded-full bg-[#F59E0B]/20 border border-dashed border-[#F59E0B]" />
          <span className="text-slate-400">Signal-controlled junction</span>
        </div>
      </div>

      {/* Address line + the single, subtle Google Maps handoff */}
      <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-[11px] font-mono-telemetry text-slate-400 leading-relaxed">
          <span className="text-white font-semibold">{HUNTER_LABEL}</span>
          {' '}— {HUNTER_LOCATION.address}
          <span className="block mt-0.5">Plus Code: {HUNTER_LOCATION.plusCode}</span>
        </p>
        <a
          href={GOOGLE_MAPS_DIRECTIONS_UNIVERSAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          id="how-to-reach-us-gmaps"
          aria-label="Open Hunter Autoworks in Google Maps for turn-by-turn directions"
          className="shrink-0 inline-flex items-center justify-center gap-1.5 text-xs font-mono-telemetry text-[#159EF3] border border-[#159EF3]/40 hover:border-[#159EF3] hover:bg-[#159EF3] hover:text-black rounded px-4 py-2.5 min-h-[44px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#159EF3]"
        >
          Open in Google Maps
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
};
