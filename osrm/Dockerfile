# syntax=docker/dockerfile:1
# =============================================================================
# Hunter Autoworks — production OSRM routing service (Tanzania extract)
#
# DATA PREPARATION HAPPENS AT IMAGE-BUILD TIME, so the routing graph is baked
# into the image: a redeploy of the Hunter WEB SERVICE never rebuilds the
# graph. Rebuilding happens ONLY when this image is rebuilt (deliberate data
# refresh — see osrm/README.md).
#
# Each preprocessing command is a separate RUN so a build failure is
# attributable to exactly one stage (extract / partition / customize) and
# each layer's data footprint is printed for the resource-evidence record.
#
# Image pinned to a real Docker Hub tag (verified to exist, 2026-09-16):
# osrm/osrm-backend:v5.25.0 — the newest tagged release. Do NOT use `latest`.
# =============================================================================

FROM osrm/osrm-backend:v5.25.0 AS prep

# Pin the extract by URL; Geofabrik updates this file daily. The build ARG
# allows rebuilding against the same or a refreshed extract deterministically.
ARG PBF_URL=https://download.geofabrik.de/africa/tanzania-latest.osm.pbf
ENV PBF_URL=${PBF_URL}

WORKDIR /data
# CANONICAL PBF FILENAME — matches .github/workflows/verify-osrm.yml so the
# CI pipeline and the image build use identical naming end-to-end (download
# target = checksum target = osrm-extract input; osrm tooling derives the
# graph stem from the input filename).
ADD ${PBF_URL} /data/tanzania-latest.osm.pbf

# Car profile (passenger-car road navigation) ships inside the image at
# /opt/car.lua. MLD pipeline: extract → partition → customize.
RUN osrm-extract -p /opt/car.lua /data/tanzania-latest.osm.pbf \
 && echo "after osrm-extract:" && du -sh /data

RUN osrm-partition /data/tanzania-latest.osrm \
 && echo "after osrm-partition:" && du -sh /data

RUN osrm-customize /data/tanzania-latest.osrm \
 && echo "after osrm-customize:" && du -sh /data \
 && rm -f /data/tanzania-latest.osm.pbf \
 && echo "final graph artifacts:" && ls -lh /data

FROM osrm/osrm-backend:v5.25.0

WORKDIR /data
COPY --from=prep /data /data

EXPOSE 5000
# osrm-routed serves /route, /nearest, /table, ... Honor Render's PORT env
# (private services are reached at <name>:<port>); defaults to 5000 locally.
# The runtime STARTS DIRECTLY from the prepared graph — no preprocessing at
# container start. No arbitrary-params hardening is needed here: the Hunter
# Express server is the ONLY permitted client (Render private network), and
# it constructs the upstream URL itself from a validated, fixed shape.
ENTRYPOINT ["sh", "-c", "exec osrm-routed --algorithm mld --max-table-size 100 --port ${PORT:-5000} /data/tanzania-latest.osrm"]
