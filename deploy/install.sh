#!/usr/bin/env bash
# Quick deploy helper for Flokinet VPS.
# Usage:  sudo bash deploy/install.sh yourdomain.com you@example.com
# Idempotent — safe to re-run.

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: sudo bash deploy/install.sh <domain> <email-for-letsencrypt>"
  exit 1
fi

echo "==> Installing prerequisites (docker, docker compose, nginx, certbot)"
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release nginx certbot python3-certbot-nginx ufw

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

# Ensure compose v2 is available
docker compose version >/dev/null 2>&1 || {
  apt-get install -y docker-compose-plugin
}

echo "==> Configuring firewall (ssh + http + https only)"
ufw allow OpenSSH || true
ufw allow http   || true
ufw allow https  || true
yes | ufw enable || true

echo "==> Setting up nginx site"
SITE=/etc/nginx/sites-available/nexttradx
sed "s/yourdomain.com/$DOMAIN/g" deploy/nginx.conf > "$SITE"
# Until certbot runs, serve HTTP only
sed -i 's@^\s*listen 443 ssl@#&@; s@^\s*listen \[::\]:443 ssl@#&@; s@^\s*ssl_@#&@' "$SITE"
ln -sf "$SITE" /etc/nginx/sites-enabled/nexttradx
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> Provisioning Let's Encrypt cert"
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || true

# Restore the full SSL config from template now that the cert exists
sed "s/yourdomain.com/$DOMAIN/g" deploy/nginx.conf > "$SITE"
nginx -t && systemctl reload nginx

echo "==> Building and starting the stack"
[ -f frontend/.env ] || cp frontend/.env.example frontend/.env
echo "    !! Edit frontend/.env (especially JWT_SECRET, NEXT_PUBLIC_APP_URL, REACT_APP_BACKEND_URL) before going live."
docker compose up -d --build

echo
echo "==> Done. Open https://$DOMAIN"
echo "    Default admin: admin@trading.com / password   (change immediately)"
echo "    Logs:          docker compose logs -f app"
