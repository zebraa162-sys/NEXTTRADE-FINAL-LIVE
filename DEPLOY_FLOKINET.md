# Deploying NEXT-TRADX on a Flokinet VPS

This guide takes a fresh **Ubuntu 22.04+ / Debian 12+** Flokinet VPS and stands
up the platform end-to-end behind HTTPS in ~10 minutes.

The stack is fully containerised:
```
[ User ] → 443 nginx (host) → 3000 Next.js (container) → 27017 MongoDB (container)
```
No FastAPI proxy is required outside Emergent — nginx routes both `/` (pages)
and `/api/*` (the catch-all route handler inside Next.js) to the same container.

---

## 1. Point your domain at the VPS

In your DNS provider (or Flokinet's panel), create:

| Type | Name | Value              |
|------|------|--------------------|
| A    | @    | <VPS public IPv4>  |
| A    | www  | <VPS public IPv4>  |

Wait until `dig yourdomain.com +short` returns the VPS IP from your laptop.

## 2. Copy the project onto the server

SSH in as root (or a sudo user), then either `git clone` or `scp` the project:

```bash
# Option A — git
git clone https://github.com/<you>/NEXT-TRADX-LIVE.git /opt/nexttradx
cd /opt/nexttradx

# Option B — scp from your laptop
# (run on your laptop:)
# scp -r ./NEXT-TRADX-LIVE root@<vps-ip>:/opt/nexttradx
# then on the VPS:
cd /opt/nexttradx
```

## 3. Configure environment variables

```bash
cp frontend/.env.example frontend/.env
nano frontend/.env
```

At minimum set:

- `JWT_SECRET` → `openssl rand -hex 48` (paste the output)
- `NEXT_PUBLIC_APP_URL` → `https://yourdomain.com`
- `REACT_APP_BACKEND_URL` → `https://yourdomain.com`
- `CORS_ORIGINS` → `https://yourdomain.com` (or `*` while testing)
- Leave `MONGO_URL=mongodb://mongo:27017` (compose-internal hostname).

## 4. One-shot install

The helper script installs Docker + nginx + certbot, opens the firewall,
provisions a Let's Encrypt cert for your domain, builds the image, and starts
the stack:

```bash
chmod +x deploy/install.sh
sudo bash deploy/install.sh yourdomain.com you@example.com
```

When it finishes, open `https://yourdomain.com` — you should see the
NEXT-TRADX landing page. Log in with `admin@trading.com` / `password` and
**immediately change both seeded passwords** from the admin UI (or the
/account page).

## 5. Verifying the deploy

```bash
docker compose ps                      # both services Up
docker compose logs -f app             # tail Next.js logs
curl -s https://yourdomain.com/api/assets | head -c 200    # live feed working
curl -X POST https://yourdomain.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@trading.com","password":"password"}'  # returns JWT
```

## 6. Day-2 operations

| Task                        | Command                                                   |
|-----------------------------|-----------------------------------------------------------|
| View logs                   | `docker compose logs -f app`                              |
| Restart app only            | `docker compose restart app`                              |
| Rebuild after code change   | `docker compose up -d --build app`                        |
| Backup MongoDB              | `docker exec nexttradx-mongo mongodump --archive=/data/db/backup-$(date +%F).gz --gz` |
| Renew TLS (automatic)       | `certbot renew --dry-run` (already in cron via certbot)   |
| Update server               | `apt update && apt upgrade -y && reboot`                  |

## 7. Mongo backup / restore

```bash
# Backup to host
docker exec nexttradx-mongo \
  mongodump --archive --gz -d quotex_clone > backup-$(date +%F).gz

# Restore on a fresh box
gunzip -c backup-2026-01-01.gz | \
  docker exec -i nexttradx-mongo mongorestore --archive --gz
```

## 8. Hardening checklist (recommended before going live)

- [ ] Change `admin@trading.com` password (UI → My Account → Change password)
- [ ] Delete or rename the `masteruser@trading.com` seed account
- [ ] Generate a strong `JWT_SECRET` and set `CORS_ORIGINS` to your domain only
- [ ] Set up offsite backups (S3 / Backblaze) for the `mongo_data` volume
- [ ] Add fail2ban: `apt install fail2ban && systemctl enable --now fail2ban`
- [ ] Disable root SSH login (`PermitRootLogin no` in `/etc/ssh/sshd_config`)
- [ ] Enable unattended security upgrades: `dpkg-reconfigure unattended-upgrades`
- [ ] Review the `winRatio` / payout / pattern settings in the Admin →
      Live System Control Center before opening sign-ups

## 9. Troubleshooting

| Symptom                                | Likely cause / fix                                     |
|----------------------------------------|--------------------------------------------------------|
| `502 Bad Gateway` from nginx           | Container isn't healthy — `docker compose logs app`    |
| Build fails with "out of memory"       | Increase swap: `fallocate -l 2G /swap && chmod 600 /swap && mkswap /swap && swapon /swap` |
| Live forex feed empty after deploy     | Outbound HTTPS blocked — allow `query1.finance.yahoo.com` egress |
| Toast "Trade Opened" never appears     | JWT_SECRET mismatch between builds — wipe `mongo_data` volume only if you don't have users |
| Can't reach Mongo from app             | The compose hostname is `mongo` (NOT `localhost`)      |

---

## Architecture notes (for future maintenance)

- The entire backend lives in `frontend/app/api/[[...path]]/route.js` — a
  single 839-line catch-all Next.js Route Handler. Auth, trades, admin,
  deposits, withdrawals, announcements, support and the leaderboard all live
  there. There is **no Python server in production** — the FastAPI proxy in
  `/backend` is only used inside the Emergent preview pod.
- Background loops (price engine, trade resolver, live forex feed) start lazily
  on the first `/api/*` request via `bootstrap()` in `route.js`. Cold start can
  take 2-3 s after a container restart — the resolver and engine then keep
  ticking in-process.
- MongoDB collections used: `users`, `trades`, `deposits`, `withdrawals`,
  `announcements`, `tickets`, `settings`. The `settings` doc with `id:"global"`
  holds the `winRatio` and `payoutRate` levers used by the resolver.
