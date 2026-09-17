#!/usr/bin/env bash
# =============================================================================
# Hunter Autoworks — TLS activation (run ONCE on the Oracle host, Phase 3B.4)
# =============================================================================
# Bridges the nginx/certbot chicken-and-egg: cloud-init leaves a port-80-only
# bootstrap config enabled; this script issues the real certificate for the
# owner's ACTUAL DNS hostname (never invent DNS names — the hostname is a
# parameter), then swaps in the full 443 security boundary and verifies.
#
# Usage (on the Oracle host):
#   sudo ADMIN_CIDR=203.0.113.4/32 DOMAIN=osrm.your-domain.example bash activate-tls.sh
#
# Requirements: the DOMAIN's A record must already point at this host's
# public IPv4, and 80/tcp must be reachable (ufw + OCI Security List).
# =============================================================================

set -euo pipefail
DOMAIN="${DOMAIN:?set DOMAIN=<your real hostname>}"
ADMIN_CIDR="${ADMIN_CIDR:?set ADMIN_CIDR=<your current IP>/32}"

echo "[1/5] Applying firewall with admin SSH from $ADMIN_CIDR"
sudo ADMIN_CIDR="$ADMIN_CIDR" /usr/local/sbin/hunter-firewall.sh

echo "[2/5] Requesting Let's Encrypt certificate for $DOMAIN (HTTP-01)"
sudo certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || \
sudo certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@"${DOMAIN#*.}" 

echo "[3/5] Substituting the real hostname into the boundary config"
sudo sed -i "s|/etc/letsencrypt/live/PLACEHOLDER/|/etc/letsencrypt/live/${DOMAIN}/|g" \
  /etc/nginx/sites-available/hunter-osrm.conf
sudo sed -i "s|server_name _;|server_name ${DOMAIN};|" \
  /etc/nginx/sites-available/hunter-osrm.conf

echo "[4/5] Switching nginx: bootstrap (port 80) → full 443 boundary"
sudo rm -f /etc/nginx/sites-enabled/hunter-osrm-bootstrap.conf
sudo ln -sf /etc/nginx/sites-available/hunter-osrm.conf /etc/nginx/sites-enabled/hunter-osrm.conf
sudo nginx -t
sudo systemctl reload nginx

echo "[5/5] Enabling renewal timer + smoke test"
sudo systemctl enable --now certbot-renew.timer 2>/dev/null || sudo systemctl enable --now certbot.timer 2>/dev/null || true
sleep 1
CODE=$(curl -s -o /dev/null -w '%{https_code}' --max-time 10 "https://${DOMAIN}/route/v1/driving/39.2443,-6.7923;39.265234375,-6.7789875?overview=false" || echo 000)
if [ "$CODE" = "200" ]; then
  echo "TLS ACTIVATION OK: https://${DOMAIN}/route/v1/driving/... is live (HTTP $CODE)"
else
  echo "TLS ACTIVATION INCOMPLETE: https probe returned $CODE — inspect: sudo nginx -t; sudo journalctl -u nginx -n 50"
  exit 1
fi
