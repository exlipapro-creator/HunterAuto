#!/usr/bin/env bash
# =============================================================================
# Hunter Autoworks — OSRM activation verification battery (Phase 3B.4)
# =============================================================================
# Usage:
#   bash verify.sh                          # from the Oracle host itself
#   BASE=https://osrm.<domain> bash verify.sh   # from anywhere, public side
#   STAGE=final BASE=... bash verify.sh         # final certification (stricter)
#
# STAGES:
#   preboot  (default) — skips checks that require the running proxy chain
#                        (used right after instance creation if needed)
#   final              — every gate, including reboot-recovery follow-ups
#
# Exit code 0 = every executed gate passed. Any failure prints FAILED GATES.
# No secrets are required or transmitted. Coordinates in test requests are
# synthetic Dar es Salaam road points from the certified matrix.
# =============================================================================

set -u
BASE="${BASE:-http://127.0.0.1:5000}"
PUBLIC_BASE="${PUBLIC_BASE:-}"
STAGE="${STAGE:-preboot}"
CERTIFIED_DIGEST="sha256:4ef4b3641e69060ada459bfef9bb8c1b93157a36ce7d6a4499a0f8cb7cf739d3"

PASS=0; FAIL=0; FAILED_GATES=()
gate() { # gate <name> <expected> <actual>
  if [ "$2" = "$3" ]; then echo "  PASS  $1 ($3)"; PASS=$((PASS+1));
  else echo "  FAIL  $1 (expected $2, got $3)"; FAIL=$((FAIL+1)); FAILED_GATES+=("$1"); fi
}
gate_range() { # numeric between min/max
  if [ "$2" -ge "$3" ] && [ "$2" -le "$4" ]; then echo "  PASS  $1 ($2 in [$3,$4])"; PASS=$((PASS+1));
  else echo "  FAIL  $1 ($2 outside [$3,$4])"; FAIL=$((FAIL+1)); FAILED_GATES+=("$1"); fi
}

echo "== Phase 3B.4 verification battery — target: $BASE (stage: $STAGE) =="

# ---- A. Runtime identity (host-only; skipped when targeting public base) ----
if [ "$BASE" = "http://127.0.0.1:5000" ]; then
  echo "-- A. Container & image identity"
  A_RUNNING=$(docker inspect -f '{{.State.Running}}' hunter-osrm 2>/dev/null || echo missing)
  gate "A1 container running" "true" "$A_RUNNING"
  A_REPO=$(docker inspect -f '{{index .RepoDigests 0}}' hunter-osrm 2>/dev/null | grep -oE 'sha256:[a-f0-9]+' | head -1)
  gate "A2 certified digest running" "$CERTIFIED_DIGEST" "${A_REPO:-none}"
  A_ARCH=$(docker image inspect "ghcr.io/exlipapro-creator/hunter-osrm@${CERTIFIED_DIGEST}" -f '{{.Architecture}}/{{.Os}}' 2>/dev/null || echo none)
  gate "A3 image architecture" "arm64/linux" "$A_ARCH"
  A_RESTART=$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' hunter-osrm 2>/dev/null || echo none)
  gate "A4 restart policy" "unless-stopped" "$A_RESTART"
  A_PORT=$(docker inspect -f '{{json .NetworkSettings.Ports}}' hunter-osrm 2>/dev/null | grep -c '127.0.0.1:5000')
  gate "A5 publishes localhost-only 5000" "1" "$A_PORT"
  A_VER=$(docker exec hunter-osrm osrm-extract --version 2>/dev/null | head -1)
  echo "$A_VER" | grep -q "5\.27\.1" && gate "A6 OSRM version" "5.27.1" "$(echo "$A_VER" | grep -oE '5\.27\.1' | head -1)" \
    || gate "A6 OSRM version" "5.27.1" "not-5.27.1"
fi

# ---- B. Direct OSRM behavior (target base) ----------------------------------
echo "-- B. Routing behavior"
if [ "$STAGE" != "preboot" ]; then
  code=$(curl -s -o /tmp/v-b1.json -w '%{http_code}' --max-time 10 "$BASE/route/v1/driving/39.2443,-6.7923;39.265234375,-6.7789875?overview=simplified&geometries=geojson&alternatives=false&steps=false")
  gate "B1 baseline route HTTP" "200" "$code"
  node -e 'const r=require("/tmp/v-b1.json");const rt=r.routes?.[0];process.exit((r.code==="Ok"&&rt&&Math.abs(rt.distance-4631)<=50&&Math.abs(rt.duration-431.9)<=5&&rt.geometry.coordinates.length===29)?0:1)' \
    && gate "B2 baseline semantics (4631m/431.9s/29pts ±50m/5s)" "0" "0" || gate "B2 baseline semantics" "0" "1"
else
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE/route/v1/driving/39.2443,-6.7923;39.265234375,-6.7789875?overview=false")
  gate "B1 route reachable (preboot, loose)" "200" "$code"
fi
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE/route/v1/driving/999,9999;39.265,-6.779")
[ "$code" != "200" ] && gate "B3 invalid coords rejected" "non-200" "$code" || gate "B3 invalid coords rejected" "non-200" "200"

# ---- C. Public attack surface (host-only probes) -----------------------------
if [ "$BASE" = "http://127.0.0.1:5000" ]; then
  echo "-- C. Localhost-only exposure"
  PUBIP=$(curl -s --max-time 10 https://api.ipify.org || true)
  if [ -n "$PUBIP" ]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 "http://$PUBIP:5000/route/v1/driving/39.24,-6.79;39.24,-6.79" || echo "000")
    gate "C1 public :5000 NOT reachable" "000" "$code"
  else
    echo "  SKIP  C1 (no outbound IP service reachable)"
  fi
  LIP=$(ip -4 addr show scope global 2>/dev/null | grep -oE '10\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  if [ -n "$LIP" ]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://$LIP:5000/" || echo "000")
    gate "C2 VNIC/private :5000 NOT reachable" "000" "$code"
  fi
  UFW5000=$(ufw status 2>/dev/null | grep -c "5000") || true
  gate "C3 ufw has no 5000 rule" "0" "$UFW5000"
fi

# ---- D. Public boundary (when PUBLIC_BASE provided; STAGE final) -------------
if [ -n "$PUBLIC_BASE" ]; then
  echo "-- D. Public HTTPS boundary ($PUBLIC_BASE)"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://$PUBLIC_BASE/route/v1/driving/39.2443,-6.7923;39.265234375,-6.7789875?overview=false")
  gate "D1 HTTP redirects to HTTPS" "301" "$code"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$PUBLIC_BASE/route/v1/driving/39.2443,-6.7923;39.265234375,-6.7789875?overview=false")
  gate "D2 HTTPS route" "200" "$code"
  TLS=$(echo | openssl s_client -connect "${PUBLIC_BASE#https://}:443" -servername "${PUBLIC_BASE#https://}" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | head -1)
  [ -n "$TLS" ] && gate "D3 TLS cert present" "notBefore" "$(echo "$TLS" | cut -d= -f1)" || gate "D3 TLS cert" "notBefore" "absent"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST "$PUBLIC_BASE/route/v1/driving/39.24,-6.79;39.24,-6.79")
  gate "D4 non-GET rejected" "405" "$code"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$PUBLIC_BASE/table/v1/driving/39.24,-6.79;39.24,-6.79")
  gate "D5 /table NOT proxied" "404" "$code"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$PUBLIC_BASE/")
  gate "D6 / NOT proxied" "404" "$code"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$PUBLIC_BASE/route/v1/driving/999,9999;39.265,-6.779")
  [ "$code" != "200" ] && gate "D7 invalid coords rejected at boundary" "non-200" "$code" || gate "D7 invalid coords rejected" "non-200" "200"
  LONG=$(python3 -c "print('39.2'*1200)" 2>/dev/null || head -c 4800 /dev/zero | tr '\0' '3')
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$PUBLIC_BASE/route/v1/driving/$LONG")
  gate "D8 oversized request line rejected" "414" "$code"
  echo "-- D9 rate limit (11 rapid requests; expect a 429 among them)"
  SEEN429=0
  for i in $(seq 1 11); do
    c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$PUBLIC_BASE/route/v1/driving/39.24,-6.79;39.24,-6.79" || true)
    [ "$c" = "429" ] && SEEN429=1
  done
  gate "D9 rate limit engages" "1" "$SEEN429"
fi

# ---- E. Performance snapshot (host-only) -------------------------------------
if [ "$BASE" = "http://127.0.0.1:5000" ]; then
  echo "-- E. Performance"
  T0=$(date +%s%N)
  curl -s -o /dev/null --max-time 10 "$BASE/route/v1/driving/39.2443,-6.7923;39.265234375,-6.7789875?overview=false"
  T1=$(date +%s%N); WARM_MS=$(( (T1-T0)/1000000 ))
  gate_range "E1 warm route latency (ms)" "$WARM_MS" 0 200
  RSS_KB=$(docker stats --no-stream --format '{{.MemUsage}}' hunter-osrm | awk '{print $1}' | grep -oE '^[0-9.]+' | head -1)
  RSS_MIB=$(docker stats --no-stream --format '{{.MemUsage}}' hunter-osrm | awk '{print $1}' | grep -oE '(GiB|MiB)' | head -1)
  if [ "$RSS_MIB" = "GiB" ]; then RSS_MB=$(awk "BEGIN{printf \"%d\", $RSS_KB*1024}"); else RSS_MB=$(awk "BEGIN{printf \"%d\", $RSS_KB}"); fi
  gate_range "E2 runtime RSS (MB, expect ~1530)" "$RSS_MB" 1200 1900
  echo "-- E3 sequential x10"
  OK=0; for i in $(seq 1 10); do
    c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE/route/v1/driving/39.2443,-6.7923;39.2695,-6.8235?overview=false")
    [ "$c" = "200" ] && OK=$((OK+1))
  done
  gate "E3 sequential 10/10" "10" "$OK"
fi

echo
echo "== RESULT: $PASS passed, $FAIL failed =="
if [ "$FAIL" -gt 0 ]; then printf 'FAILED GATES: %s\n' "${FAILED_GATES[*]}"; exit 1; fi
echo "ALL EXECUTED GATES PASSED (stage: $STAGE)"
