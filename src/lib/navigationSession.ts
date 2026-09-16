/**
 * "Take Me to Hunter" — navigation session controller.
 *
 * Framework-free state machine owning the entire navigation lifecycle:
 *
 *   idle → locating → navigating → arrived, plus error exits
 *   (denied / unavailable / timeout / unsupported / routing failure)
 *
 * Design rules implemented here (per the approved architecture):
 *  - Geolocation starts ONLY on explicit user action (start()).
 *  - GPS marker updates and ROUTE RECALCULATION are separate concerns:
 *    every accepted fix moves the marker, but a route request is made only
 *    when the customer is ≥150 m off-route AND ≥60 s since the last request,
 *    and never while another request is in flight (no duplicate/concurrent
 *    routing calls).
 *  - Arrival at ≤75 m from Hunter stops the GPS watch and routing.
 *  - stop() and dispose() clear every watch/timer — no leaks, no background
 *    tracking.
 *  - Geolocation and network access are injectable, making the whole machine
 *    deterministic and unit-testable without a browser.
 *  - Privacy: positions live only in memory; nothing is persisted or logged.
 */

import { HUNTER_LOCATION } from './hunterLocation.js';

// ---- Tunables (spec thresholds) ----
export const ARRIVAL_THRESHOLD_METERS = 75;
export const OFF_ROUTE_THRESHOLD_METERS = 150;
export const ROUTE_RECALC_MIN_INTERVAL_MS = 60_000;
export const FIX_MAX_AGE_MS = 30_000; // older fixes are stale and ignored
export const POOR_ACCURACY_METERS = 100; // fix too imprecise to trust for routing
export const GEO_TIMEOUT_MS = 10_000;
export const GEO_MAXIMUM_AGE_MS = 15_000;

export const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: GEO_TIMEOUT_MS,
  maximumAge: GEO_MAXIMUM_AGE_MS,
};

export type NavErrorCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNSUPPORTED'
  | 'ROUTING_UNAVAILABLE'
  | 'RATE_LIMITED';

export type NavState =
  | { name: 'idle' }
  | { name: 'locating' }
  | {
      name: 'navigating';
      position: { latitude: number; longitude: number; accuracy: number; timestamp: number };
      lowAccuracy: boolean;
      route: RouteInfo | null;
      routeStatus: 'none' | 'loading' | 'error' | 'unconfigured';
    }
  | { name: 'arrived'; position: { latitude: number; longitude: number; accuracy: number; timestamp: number } }
  | { name: 'denied' }
  | { name: 'unavailable'; detail: 'position_unavailable' | 'timeout' | 'unsupported' }
  | { name: 'routing-error' };

export interface RouteInfo {
  distanceMeters: number;
  durationSeconds: number;
  /** [lat, lng] pairs for Leaflet polyline rendering. */
  geometry: [number, number][];
}

export interface NavFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

// ---- Injectable platform handles ----
export type WatchHandle = number | string | symbol;

export interface GeoLike {
  getCurrentPosition(
    success: (pos: GeolocationPosition) => void,
    error: (err: GeolocationPositionError) => void,
    options?: PositionOptions,
  ): void;
  watchPosition(
    success: (pos: GeolocationPosition) => void,
    error: (err: GeolocationPositionError) => void,
    options?: PositionOptions,
  ): WatchHandle;
  clearWatch(handle: WatchHandle): void;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface NavDeps {
  geo?: GeoLike;
  fetchImpl?: FetchLike;
  now?: () => number;
}

/** Great-circle distance in metres (spherical earth). */
export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Reject obviously invalid/absurd fixes (NaN, out of range, zero-island). */
export function isValidFix(f: NavFix): boolean {
  return (
    Number.isFinite(f.latitude) && Number.isFinite(f.longitude) && Number.isFinite(f.accuracy) &&
    f.latitude >= -90 && f.latitude <= 90 && f.longitude >= -180 && f.longitude <= 180 &&
    !(f.latitude === 0 && f.longitude === 0)
  );
}

/** Distance from a point to the nearest vertex of the route polyline. */
export function distanceToRoute(fix: NavFix, geometry: [number, number][]): number {
  let min = Infinity;
  for (const [lat, lng] of geometry) {
    const d = haversineMeters(fix.latitude, fix.longitude, lat, lng);
    if (d < min) min = d;
  }
  return min;
}

export class NavigationSession {
  private geo: GeoLike | null;
  private fetchImpl: FetchLike;
  private now: () => number;
  private watchHandle: WatchHandle | null = null;
  private lastRouteAt = -Infinity;
  private routeInFlight = false;
  private disposed = false;
  private listeners = new Set<(s: NavState) => void>();
  private state: NavState = { name: 'idle' };

  constructor(deps: NavDeps = {}) {
    this.geo = deps.geo ?? (typeof navigator !== 'undefined' ? navigator.geolocation : null);
    this.fetchImpl = deps.fetchImpl ?? ((i, o) => fetch(i, o));
    this.now = deps.now ?? (() => Date.now());
  }

  getState(): NavState {
    return this.state;
  }

  subscribe(fn: (s: NavState) => void): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private setState(next: NavState) {
    this.state = next;
    for (const fn of this.listeners) fn(next);
  }

  /** True once geolocation has produced a usable fix this session. */
  hasPosition(): boolean {
    const s = this.state;
    return s.name === 'navigating' || s.name === 'arrived';
  }

  /** Begin navigation: request permission + first fix. Never auto-invoked. */
  start(): void {
    // Re-arm after dispose(): React StrictMode (and any remount cycle) runs
    // mount → cleanup → mount on the SAME session instance, and dispose() is
    // part of cleanup. A session is only ever started by an explicit button
    // press, which can only exist on a LIVE mount — so re-arming here is safe
    // and keeps post-unmount callbacks fully blocked (disposed stays true
    // until a real, user-initiated start).
    if (this.disposed) this.disposed = false;
    if (!this.geo) {
      this.setState({ name: 'unavailable', detail: 'unsupported' });
      return;
    }
    // A restart must never stack watches.
    this.clearWatch();
    this.setState({ name: 'locating' });

    this.geo.getCurrentPosition(
      (pos) => this.onFirstFix(pos),
      (err) => this.onGeoError(err),
      GEO_OPTIONS,
    );
  }

  private onGeoError(err: GeolocationPositionError): void {
    if (this.disposed) return;
    switch (err?.code) {
      case 1: // PERMISSION_DENIED
        this.setState({ name: 'denied' });
        break;
      case 2: // POSITION_UNAVAILABLE
        this.setState({ name: 'unavailable', detail: 'position_unavailable' });
        break;
      case 3: // TIMEOUT
        this.setState({ name: 'unavailable', detail: 'timeout' });
        break;
      default:
        this.setState({ name: 'unavailable', detail: 'position_unavailable' });
    }
  }

  private onFirstFix(pos: GeolocationPosition): void {
    if (this.disposed) return;
    const fix = toFix(pos);
    if (!isValidFix(fix)) {
      this.setState({ name: 'unavailable', detail: 'position_unavailable' });
      return;
    }
    this.beginWatch();
    this.enterNavigating(fix);
  }

  private beginWatch(): void {
    if (!this.geo || this.watchHandle !== null) return;
    this.watchHandle = this.geo.watchPosition(
      (pos) => this.onWatchFix(pos),
      (err) => {
        // Permission revoked mid-navigation: stop tracking + routing and
        // return to the permission state, preserving the destination panel.
        if (err?.code === 1) {
          this.clearWatch();
          this.setState({ name: 'denied' });
        }
        // Position lost / temporary GPS error: keep the session alive — the
        // fix timestamp communicates staleness to the UI; no state downgrade.
      },
      GEO_OPTIONS,
    );
  }

  private enterNavigating(fix: NavFix): void {
    const distToHunter = haversineMeters(fix.latitude, fix.longitude, HUNTER_LOCATION.latitude, HUNTER_LOCATION.longitude);
    if (distToHunter <= ARRIVAL_THRESHOLD_METERS) {
      this.setState({ name: 'arrived', position: fix });
      this.clearWatch();
      return;
    }
    this.setState({ name: 'navigating', position: fix, lowAccuracy: fix.accuracy > POOR_ACCURACY_METERS, route: null, routeStatus: 'none' });
    this.maybeFetchRoute(fix, true);
  }

  private onWatchFix(pos: GeolocationPosition): void {
    if (this.disposed) return;
    const fix = toFix(pos);
    if (!isValidFix(fix)) return;
    const s = this.state;
    if (s.name === 'arrived') return; // terminal until stop()
    if (s.name !== 'navigating') return;

    // Stale fixes (watch callbacks can lag) must not drive routing/arrival.
    if (this.now() - fix.timestamp > FIX_MAX_AGE_MS) return;

    const distToHunter = haversineMeters(fix.latitude, fix.longitude, HUNTER_LOCATION.latitude, HUNTER_LOCATION.longitude);
    if (distToHunter <= ARRIVAL_THRESHOLD_METERS) {
      this.setState({ name: 'arrived', position: fix });
      this.clearWatch();
      return;
    }

    this.setState({
      name: 'navigating',
      position: fix,
      lowAccuracy: fix.accuracy > POOR_ACCURACY_METERS,
      route: s.route,
      routeStatus: s.routeStatus,
    });
    this.maybeFetchRoute(fix, false);
  }

  /**
   * Route recalculation gate: only when actually needed.
   *  - force: first fix of the session (no route yet) or manual refresh.
   *  - otherwise: ≥150 m off the current route AND ≥60 s since the last fetch.
   *  - never concurrent: an in-flight request blocks starting another.
   */
  private maybeFetchRoute(fix: NavFix, force: boolean): void {
    if (this.routeInFlight) return;
    const s = this.state;
    if (s.name !== 'navigating') return;
    const t = this.now();
    if (t - this.lastRouteAt < ROUTE_RECALC_MIN_INTERVAL_MS && !force) return;

    const needsRoute = force || !s.route || s.routeStatus === 'error';
    if (!needsRoute) {
      const offRoute = s.route ? distanceToRoute(fix, s.route.geometry) >= OFF_ROUTE_THRESHOLD_METERS : true;
      if (!offRoute) return;
    }

    this.routeInFlight = true;
    this.lastRouteAt = t;
    this.setState({ ...s, routeStatus: 'loading' });

    void this.requestRoute(fix);
  }

  private async requestRoute(fix: NavFix): Promise<void> {
    try {
      const res = await this.fetchImpl(`/api/v1/directions?from=${fix.latitude},${fix.longitude}`, {
        signal: AbortSignal.timeout(12_000),
      });
      if (this.disposed || this.state.name !== 'navigating') return;
      if (res.status === 429) {
        this.setRouteStatus('error');
        return;
      }
      if (!res.ok) {
        this.setRouteStatus('error');
        return;
      }
      const body = (await res.json()) as { success?: boolean; data?: { distanceMeters?: unknown; durationSeconds?: unknown; geometry?: unknown } };
      const data = body?.data;
      const geometry = data?.geometry;
      if (
        !body?.success || !data ||
        typeof data.distanceMeters !== 'number' || data.distanceMeters < 0 ||
        typeof data.durationSeconds !== 'number' || data.durationSeconds < 0 ||
        !Array.isArray(geometry) || geometry.length < 2
      ) {
        this.setRouteStatus('error');
        return;
      }
      const route: RouteInfo = {
        distanceMeters: data.distanceMeters,
        durationSeconds: data.durationSeconds,
        geometry: geometry as [number, number][],
      };
      if (this.state.name === 'navigating') {
        this.setState({ name: 'navigating', position: this.state.position, lowAccuracy: this.state.lowAccuracy, route, routeStatus: 'none' });
      }
    } catch {
      if (!this.disposed && this.state.name === 'navigating') this.setRouteStatus('error');
    } finally {
      this.routeInFlight = false;
    }
  }

  private setRouteStatus(routeStatus: 'error' | 'unconfigured'): void {
    const s = this.state;
    if (s.name === 'navigating') {
      this.setState({ name: 'navigating', position: s.position, lowAccuracy: s.lowAccuracy, route: s.route, routeStatus });
    }
  }

  /** Manual route refresh (e.g. after a routing failure) — same in-flight guard. */
  refreshRoute(): void {
    const s = this.state;
    if (s.name === 'navigating' && s.position) {
      this.maybeFetchRoute(s.position, true);
    }
  }

  /** Stop navigation: clear watch + timers, return to idle. */
  stop(): void {
    this.clearWatch();
    this.lastRouteAt = -Infinity;
    this.routeInFlight = false;
    this.setState({ name: 'idle' });
  }

  private clearWatch(): void {
    if (this.watchHandle !== null && this.geo) {
      try {
        this.geo.clearWatch(this.watchHandle);
      } catch {
        /* noop */
      }
    }
    this.watchHandle = null;
  }

  /** Unmount cleanup — mandatory: no watcher or listener survives this. */
  dispose(): void {
    this.disposed = true;
    this.clearWatch();
    this.listeners.clear();
  }
}

function toFix(pos: GeolocationPosition): NavFix {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    timestamp: pos.timestamp,
  };
}
