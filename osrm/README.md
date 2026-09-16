# OSRM Routing Backend — Hunter Autoworks ("Take Me to Hunter")

Production routing backend for the in-site navigation feature (commit `8941297`).
The Hunter Express server remains the **only** browser-facing routing boundary
(`GET /api/v1/directions?from=LAT,LNG`); this service is upstream-only.

## Architecture

```
Browser ── /api/v1/directions ──> Hunter Express (validation, rate limit,
                                   server-authoritative destination)
        Hunter Express ──> hunter-osrm (Render private service, MLD car graph,
                           Tanzania extract) ──> normalized route ──> Browser
```

- The browser never learns the OSRM URL (`OSRM_BASE_URL` is server-only, never `VITE_*`).
- The destination is enforced server-side (`src/lib/hunterLocation.ts`).
- The public demo server (`router.project-osrm.org`) is **refused in production**
  by the existing `demo_in_production` guard — unchanged.
- Upstream responses are bounded (5 MB hard cap, streamed — oversized/truncated
  bodies fail to a structured 503, never buffered unbounded).

## Data

| Item | Value |
|---|---|
| Extract | Geofabrik `africa/tanzania-latest.osm.pbf` |
| Size | **673 MB** (measured 2026-09-16 via HTTP HEAD) |
| Integrity | Geofabrik publishes a `.md5` sidecar — the CI workflow verifies it at step E |
| Pinned in image at | build time (`ARG PBF_URL`) — image build date = dataset date |
| Profile | `car.lua` (passenger-car), MLD pipeline |
| Coverage | All of Tanzania (superset of the required Dar es Salaam / Kinondoni / Morocco / Kwamsama / -6.7789875,39.265234375 area) |

Dataset refresh = rebuild this image (`ARG PBF_URL` allows pinning a specific
snapshot). **A Hunter web-service deploy never rebuilds the routing graph.**

## Resource requirements

⚠️ **Measured evidence pending** — the figures below are the documented
*planning envelope*, to be replaced by the CI workflow's measured values
(`verification-report.json` artifact: per-step seconds, graph size in MB,
osrm-routed RSS) before any Render plan is treated as final.

| Phase | Planning envelope | Measured evidence |
|---|---|---|
| Build (extract → partition → customize) | ~2 GB RAM peak · ~3.5 GB disk · 15–40 min CPU | **from CI artifact** |
| Runtime (`osrm-routed --algorithm mld`) | ~1–1.5 GB RSS · ~2.5 GB graph | **from CI artifact** |

→ **Render Standard plan (2 GB / 1 CPU) is the current candidate.**
Free/Starter (512 MB) is insufficient by any reading of the envelope — do not
downgrade. Final tier confirmation is gated on the CI-measured RSS/graph size.

## Render service

Defined in `render.yaml` as a **private service** (`hunter-osrm`, Docker
runtime, `plan: standard`, `autoDeploy: false`, Oregon — same region as the
web service):

- **Private services are reachable only from the account's other Render
  services over Render's private network** — the public internet cannot reach
  it, so it needs no auth of its own and exposes no open proxy surface.
- `autoDeploy: false`: the graph is rebuilt only when this image/service is
  deliberately redeployed (data refresh decision), never on web deploys.
- The container honors Render's `PORT` env (`ENTRYPOINT` shell form,
  default 5000) and performs **no preprocessing at startup** — it starts
  directly from the graph baked into the image.
- Configure in Render after merging: **New → Blueprint** (or add the service
  to the existing blueprint) → set the web service env var
  `OSRM_BASE_URL=http://hunter-osrm:5000` (Render private hostname).

## Verification

1. **CI (this repo):** `.github/workflows/verify-osrm.yml` (manual dispatch)
   performs the real pipeline on a 16 GB Ubuntu runner: download + md5-verify
   the Tanzania PBF → pinned OSRM v5.25.0 (official `osrm/ppa` binaries,
   matching the image pin) `osrm-extract` → `osrm-partition` → `osrm-customize`
   → artifact existence checks → `osrm-routed` → real route request ending at
   Hunter's confirmed coordinate → Tanzania-bbox plausibility → **full
   Express chain** (`dist/server.cjs` with `OSRM_BASE_URL` pointing at the
   real osrm-routed: normalized `{distanceMeters, durationSeconds, geometry}`,
   destination-override refused, demo-URL param refused). Uploads lightweight
   evidence only (JSON report, logs, route JSON) — the 673 MB PBF and graph
   files stay in the ephemeral workspace.
2. **`scripts/verify-osrm.mjs`** — direct upstream verifier (imports the
   authoritative destination from `src/lib/hunterLocation.ts`; no duplicated
   coordinates). Useful inside the Render OSRM shell or against any OSRM
   endpoint: `node scripts/verify-osrm.mjs http://127.0.0.1:5000`.
3. **After Render deploy:** from the web-service shell,
   `curl 'http://hunter-osrm:5000/route/v1/driving/39.2443,-6.7923;39.265234375,-6.7789875?overview=simplified&geometries=geojson&alternatives=false&steps=false'`.
4. **End-to-end:** with `OSRM_BASE_URL` set on the web service, a real browser
   session must show a real route (the only accepted proof of production
   readiness).

## Operations

- **Deploy:** Render → `hunter-osrm` → Manual Deploy (first build: PBF download
  + preprocessing, ~15–40 min on the plan's CPU; Standard plan required for
  build-time headroom). Nothing else changes on web deploys.
- **Refresh the extract:** rebuild/redeploy `hunter-osrm` (optionally pin
  `PBF_URL` to a dated Geofabrik snapshot for reproducibility). Roll back by
  redeploying the previous image digest.
- **OSRM down / misconfigured:** the app stays healthy; `/api/v1/directions`
  returns structured 503 (`ROUTING_NOT_CONFIGURED` / `ROUTING_UNAVAILABLE` /
  `ROUTE_UNAVAILABLE`); the Google Maps coordinate fallback remains available.

## Health

- `hunter-osrm` proves readiness by serving: `osrm-routed` binds the port only
  after the Tanzania graph is loaded, so a successful `/route` 200 means the
  graph is live (a failed load never results in a "healthy" bind — the
  container exits and Render restarts it).
- The Hunter web readiness endpoint (`/api/v1/health`) does **not** probe OSRM
  — the app stays healthy when routing is down; `/api/v1/directions` returns
  structured 503 and the UI falls back to Google Maps.

## Status (honest)

- **Infrastructure defined, NOT deployed.** No Render service exists yet; no
  `OSRM_BASE_URL` is configured in Render yet; the CI workflow has not yet run.
- Dev/test integration used the demo OSRM upstream under
  `NODE_ENV=development` only (the sanctioned dev exception); production
  refuses it (unit-tested).
