import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  LocateFixed,
  Navigation,
  Square,
} from 'lucide-react';
import { HUNTER_LOCATION, GOOGLE_MAPS_DIRECTIONS_URL } from '../../lib/hunterLocation';
import { NavigationSession, type NavState } from '../../lib/navigationSession';

/**
 * "Take Me to Hunter" — in-site live navigation (public, customer-facing).
 *
 * Owns the whole navigation UI state machine; the Leaflet map itself lives in
 * a separate dynamic chunk (./NavMap) that is fetched ONLY once navigation is
 * actually active — the homepage never downloads map code.
 *
 * Real data only: the route comes from /api/v1/directions (server-routed,
 * server-authoritative destination), the position from browser geolocation.
 * No mock positions, no fabricated ETA, no decorative telemetry.
 *
 * PRIVACY: positions exist only in memory for the active session; nothing is
 * persisted, logged, or sent anywhere except the transient routing request.
 */

const NavMap = lazy(() => import('./NavMap'));

const fmtDistance = (m: number): string =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
const fmtDuration = (s: number): string =>
  s < 60 ? `${Math.round(s)} sec` : s < 5400 ? `${Math.max(1, Math.round(s / 60))} min` : `${(s / 3600).toFixed(1)} h`;

const btnPrimary =
  'bg-[#159EF3] hover:bg-[#3FB6FF] text-black font-semibold text-xs px-4 py-2 rounded transition-colors inline-flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#159EF3]';
const btnSecondary =
  'bg-[#002958] hover:bg-[#159EF3] hover:text-black text-[#159EF3] border border-[#159EF3]/50 text-xs font-mono-telemetry px-4 py-2 rounded transition-colors inline-flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#159EF3]';

const MapLoading: React.FC = () => (
  <div className="h-full flex items-center justify-center tech-grid-bg" aria-live="polite">
    <Loader2 className="w-5 h-5 text-[#159EF3] animate-spin" aria-hidden="true" />
    <span className="sr-only">Loading map</span>
  </div>
);

export const TakeMeToHunter: React.FC = () => {
  const sessionRef = useRef<NavigationSession | null>(null);
  if (!sessionRef.current) sessionRef.current = new NavigationSession();
  const session = sessionRef.current;

  const [state, setState] = useState<NavState>(session.getState());
  const [recenterSignal, setRecenterSignal] = useState(0);

  useEffect(() => {
    const unsubscribe = session.subscribe(setState);
    return () => {
      unsubscribe();
      session.dispose(); // mandatory: no watch/timer/listener survives unmount
    };
  }, [session]);

  const start = useCallback(() => session.start(), [session]);
  const stop = useCallback(() => session.stop(), [session]);
  const retryRoute = useCallback(() => session.refreshRoute(), [session]);
  const recenter = useCallback(() => setRecenterSignal((n) => n + 1), []);

  const googleFallback = (
    <a
      href={GOOGLE_MAPS_DIRECTIONS_URL}
      target="_blank"
      rel="noopener noreferrer"
      id="nav-google-fallback"
      className={btnSecondary}
    >
      Open in Google Maps
    </a>
  );

  const mapPanel = (arrived: boolean) => (
    <Suspense fallback={<MapLoading />}>
      <div className="h-full w-full" role="region" aria-label="Live map showing the route to Hunter Autoworks">
        <NavMap
          position={state.name === 'navigating' ? state.position : state.name === 'arrived' ? state.position : null}
          route={state.name === 'navigating' ? state.route : null}
          arrived={arrived}
          recenterSignal={recenterSignal}
        />
      </div>
    </Suspense>
  );

  return (
    <div className="h-64 sm:h-72 w-full rounded-lg bg-[#00101F] border border-[#132038] relative overflow-hidden">
      {state.name === 'idle' && (
        <div className="h-full flex flex-col items-center justify-center tech-grid-bg p-4 text-center">
          <h4 className="font-display font-bold text-lg text-white uppercase">Hunter Autoworks</h4>
          <p className="text-xs font-mono-telemetry text-[#159EF3] mt-0.5">
            Block 41, Kinondoni Morocco, Dar es Salaam
          </p>
          <div className="text-[11px] font-mono-telemetry text-slate-400 mt-2">
            GPS: {HUNTER_LOCATION.latitude}° S, {HUNTER_LOCATION.longitude}° E
          </div>
          <div className="text-[11px] font-mono-telemetry text-slate-500 mt-0.5">
            Plus Code: {HUNTER_LOCATION.plusCode}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={start} id="take-me-to-hunter-btn" className={btnPrimary}>
              <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
              Take Me to Hunter
            </button>
            {googleFallback}
          </div>
        </div>
      )}

      {state.name === 'locating' && (
        <div className="h-full flex flex-col items-center justify-center tech-grid-bg p-4 text-center" aria-live="polite">
          <Loader2 className="w-6 h-6 text-[#159EF3] animate-spin mb-3" aria-hidden="true" />
          <p className="text-sm font-display font-bold text-white uppercase">Finding your location…</p>
          <p className="text-xs text-slate-400 mt-1 max-w-[260px]">
            Allow location access so we can guide you to Hunter Autoworks.
          </p>
          <div className="mt-4">{googleFallback}</div>
        </div>
      )}

      {state.name === 'navigating' && (
        <>
          {mapPanel(false)}
          <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2 pointer-events-none">
            <div
              className="pointer-events-auto bg-[#00101F]/95 border border-[#132038] rounded px-3 py-1.5 font-mono-telemetry text-xs"
              aria-live="polite"
            >
              {state.route ? (
                <span className="text-white">
                  <span id="nav-distance">{fmtDistance(state.route.distanceMeters)}</span>
                  <span className="text-slate-500"> · </span>
                  <span id="nav-eta">{fmtDuration(state.route.durationSeconds)}</span>
                  <span className="text-slate-500"> — </span>
                  <span className="text-slate-300">Route to Hunter Autoworks</span>
                </span>
              ) : state.routeStatus === 'loading' ? (
                <span className="text-slate-300">Calculating route…</span>
              ) : state.routeStatus === 'error' ? (
                <span className="text-amber-400">
                  Live routing is temporarily unavailable.{' '}
                  <button type="button" onClick={retryRoute} id="nav-route-retry" className="underline hover:text-amber-300">
                    Retry
                  </button>
                  {' · '}
                  <a href={GOOGLE_MAPS_DIRECTIONS_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-300">
                    Google Maps
                  </a>
                </span>
              ) : (
                <span className="text-slate-400">Route to Hunter Autoworks</span>
              )}
            </div>
            {state.lowAccuracy && (
              <span className="pointer-events-auto bg-[#00101F]/95 border border-amber-500/40 text-amber-400 rounded px-2 py-1 text-[10px] font-mono-telemetry whitespace-nowrap">
                Low GPS accuracy
              </span>
            )}
          </div>
          <div className="absolute right-3 bottom-3">
            <button
              type="button"
              onClick={recenter}
              id="nav-recenter-btn"
              aria-label="Recenter map on my position"
              className="w-9 h-9 bg-[#00101F]/95 border border-[#132038] hover:border-[#159EF3] text-[#159EF3] rounded flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#159EF3]"
            >
              <LocateFixed className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <div className="absolute left-3 bottom-3">
            <button type="button" onClick={stop} id="nav-stop-btn" className={btnSecondary + ' !text-red-400 !border-red-500/40 hover:!text-black hover:!bg-red-400'}>
              <Square className="w-3 h-3" aria-hidden="true" />
              Stop Navigation
            </button>
          </div>
        </>
      )}

      {state.name === 'arrived' && (
        <>
          {mapPanel(true)}
          <div className="absolute inset-x-3 top-3 bg-[#00101F]/95 border border-emerald-500/40 rounded px-3 py-2.5 text-center" aria-live="polite">
            <p className="font-display font-bold text-sm uppercase text-emerald-400 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              You've arrived
            </p>
            <p className="text-xs text-slate-300 mt-0.5">Hunter Autoworks — Block 41, Kinondoni Morocco</p>
          </div>
          <div className="absolute left-3 bottom-3">
            <button type="button" onClick={stop} id="nav-stop-btn" className={btnSecondary}>
              Close Navigation
            </button>
          </div>
        </>
      )}

      {state.name === 'denied' && (
        <div className="h-full flex flex-col items-center justify-center tech-grid-bg p-4 text-center" aria-live="polite">
          <AlertTriangle className="w-6 h-6 text-amber-400 mb-3" aria-hidden="true" />
          <p className="text-sm text-white font-semibold">Location access was denied.</p>
          <p className="text-xs text-slate-400 mt-1">You can still open Hunter in Google Maps.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={start} id="nav-try-again-btn" className={btnSecondary}>
              Try Again
            </button>
            {googleFallback}
          </div>
        </div>
      )}

      {state.name === 'unavailable' && (
        <div className="h-full flex flex-col items-center justify-center tech-grid-bg p-4 text-center" aria-live="polite">
          <AlertTriangle className="w-6 h-6 text-amber-400 mb-3" aria-hidden="true" />
          <p className="text-sm text-white font-semibold">
            {state.detail === 'unsupported'
              ? 'Live navigation is not available in this browser.'
              : "We couldn't get your location yet."}
          </p>
          {state.detail !== 'unsupported' && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={start} id="nav-try-again-btn" className={btnSecondary}>
                Try Again
              </button>
              {googleFallback}
            </div>
          )}
          {state.detail === 'unsupported' && <div className="mt-4">{googleFallback}</div>}
        </div>
      )}
    </div>
  );
};
