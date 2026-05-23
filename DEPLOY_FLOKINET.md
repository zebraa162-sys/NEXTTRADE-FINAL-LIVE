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
- **Email (Resend)** — see § 3.1 below.

## 3.1 Email setup — Resend (verifies in ~5 minutes)

The platform sends 9 transactional emails: signup OTP, welcome, password
reset, login alert, deposit requested / approved / rejected, withdrawal
requested / approved / rejected. All of them use **Resend** because port 25
SMTP is blocked on most VPS providers including Flokinet — Resend is HTTPS
API-based, free up to 3,000 emails/month, and integrates in a single key.

**Step 1 — sign up**
1. Create an account at https://resend.com (no credit card required)
2. Dashboard → **Domains** → **Add Domain** → enter `nexttradx.com`
3. Resend will show 3-4 DNS records. Add them at your registrar / Flokinet DNS:

   | Type  | Name                    | Value                                        |
   |-------|-------------------------|----------------------------------------------|
   | TXT   | `send.nexttradx.com`    | Resend-provided SPF (`v=spf1 include:amazonses.com ~all`) |
   | TXT   | `resend._domainkey.nexttradx.com` | DKIM public key (long string Resend provides) |
   | MX    | `send.nexttradx.com`    | `feedback-smtp.us-east-1.amazonses.com` priority 10 |
   | TXT   | `_dmarc.nexttradx.com`  | `v=DMARC1; p=none;`  *(optional but recommended)* |

4. Click **Verify DNS Records** — it usually clears in 1-5 minutes.
5. Dashboard → **API Keys** → **Create API Key** → copy the `re_...` key.

**Step 2 — paste into `frontend/.env`**
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=NEXT-TRADX <noreply@nexttradx.com>
EMAIL_REPLY_TO=support@nexttradx.com
APP_BRAND_URL=https://nexttradx.com
```

**Step 3 — test**
After `docker compose up -d --build`, sign up with a real email at
`https://nexttradx.com/signup`. You should receive the OTP email within
3-10 seconds. To inspect any failed sends, hit
`GET /api/admin/emails` while logged in as admin — it returns the last
100 send attempts with status (`sent`, `failed`, or `unsent_no_key`).

**Free-tier limits**
- 3,000 emails / month, 100 / day
- During free-tier *testing mode* (before the domain is verified) you can
  only send to your own verified email — once the domain is verified, you
  can send to anyone.

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
| Signup / reset email never arrives     | Check `GET /api/admin/emails` — status `unsent_no_key` means `RESEND_API_KEY` is missing; `failed` means Resend returned an error (usually unverified domain). |
| Resend returns "domain not verified"   | DNS records haven't propagated yet — `dig TXT resend._domainkey.send.nexttradx.com` should show the DKIM key. Wait 5-10 min then click "Verify" again. |

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
