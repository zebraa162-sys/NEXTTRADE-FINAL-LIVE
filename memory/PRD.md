# Trading Lite (Quotex Clone) — PRD

## Original Problem Statement
User uploaded `Quotex-clone-main.zip` (a Next.js 14 + MongoDB binary-options trading
platform) and asked to: (a) bring it into the Emergent workspace, (b) apply updates,
(c) deploy it live on Emergent. User preferences:
- Keep original stack (Next.js + MongoDB)
- Deploy on Emergent (native)
- No third-party integrations required
- Live forex prices via built-in free source (Yahoo Finance)

## Architecture (as-adapted for Emergent)
The uploaded project was designed for the `nextjs_mongo_shadcn_base_image`, but this
workspace runs the `fastapi_react_mongo_shadcn` base image. Adapted layout:

- `/app/frontend/` — Entire Next.js 14 project (pages, lib/, components/, app/api/[[...path]]/route.js)
  - Runs via `yarn start` → `next dev --hostname 0.0.0.0 --port 3000`
  - Owns ALL backend logic: MongoDB, JWT, price engine, trade resolver, admin
- `/app/backend/server.py` — FastAPI **reverse proxy** on port 8001 that forwards
  `/api/*` → `http://localhost:3000/api/*` (required because the Emergent ingress
  routes `/api` traffic to 8001 while frontend gets port 3000)
- MongoDB — `mongodb://localhost:27017` with `DB_NAME=quotex_clone`

## User Personas
- **Trader (default user)**: signs up, practices on a $10,000 demo, deposits to live,
  places UP/DOWN trades on 40+ OTC+live forex/gold assets, tracks history, chats with support.
- **Admin**: manages users, reviews pending deposits/withdrawals, adjusts balances,
  monitors open trades, force-wins/force-loses specific trades, sets global house edge
  (`winRatio`, `payoutRate`), pushes announcements, responds to support tickets.

## Core Requirements (static)
- Email+password auth (JWT 7-day), bcrypt hashing, seed `admin@trading.com` + `masteruser@trading.com`
- Dual-account wallet (demo/live) per user, switchable; demo resettable
- 40+ assets: 21 synthetic OTC + 20 live forex/metals via Yahoo Finance polling (2s)
- Candle intervals: 5s / 15s / 60s / 180s / 300s / 600s; 80 pre-warmed bars per interval
- Binary trades: amount + direction (up/down) + duration → auto-resolve by background loop
- House-edge engine: global `winRatio` (default 20% wins allowed when user is naturally winning) + per-trade admin force win/loss with last-second "wedge" nudge
- Deposit requests (with proof), withdrawal requests (with escrow + refund on reject)
- Announcements (active-window based), leaderboard (top traders by PnL), support tickets (user↔admin chat)

## What's Been Implemented  (2026-Jan)
- ✅ Brought Next.js project from ZIP into `/app/frontend`, preserving all files (app, lib, components, hooks)
- ✅ Created FastAPI reverse proxy (`/app/backend/server.py`) using httpx so every `/api/*` hit reaches Next.js
- ✅ Wired `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `REACT_APP_BACKEND_URL`, `CORS_ORIGINS` in `/app/frontend/.env`
- ✅ Adjusted `yarn start` to `next dev` for hot reload in the preview environment
- ✅ Verified live feed (Yahoo Finance) delivers real prices (Gold $4,557 / GBPUSD 1.3475 at test time)
- ✅ Verified seed users + admin role via `/api/auth/login`
- ✅ Backend test suite: **39/39 pytest cases passing** — auth, assets, candles, trades (with auto-resolve), deposits/withdrawals (escrow/refund), admin (users, trades, stats, force, balance), announcements CRUD, support tickets, leaderboard

### Rebrand + Fixes (2026-Jan-R2)
- ✅ **New "NEXTTRADX" brand logo** — custom hexagonal SVG mark with stylised N / bullish arrow, rebuilt `TradingLiteLogo.jsx` (QuotexLogo alias preserved for back-compat). Updated everywhere (landing, login, signup, trade rail, footer, admin).
- ✅ Replaced all "Quotex" copy with "NEXT-TRADEX" (landing page: "Start trading with…", "…Innovation Broker Platform", trader testimonial; login / signup footers; tab title + OpenGraph meta).
- ✅ Removed **Quick login (demo creds)** block and Master User / Admin shortcut buttons from `/login` (pre-deploy hygiene; email/password fields start empty).
- ✅ Added **Confirm password** field on `/signup` with inline "Passwords do not match." warning + disabled submit until matched + 6-char minimum.
- ✅ **Single-click OTC ↔ LIVE toggle and asset-pair selection** — extracted `AssetList` to a top-level component (`/components/AssetList.jsx`). Root cause: the inline `AssetList` was being re-declared on every render of the trade page, which caused Radix's DropdownMenu portal to unmount it on the first click; the click never reached the child buttons, so users had to click twice. With the top-level component, Radix keeps a stable identity and the first click registers.
- ✅ **My Account page** at `/account` — profile card (name edit, email read-only, role, user id), balance stats (demo / live / active), change-password form (current + new + confirm, 6-char min, server validates current password). Logout + back-to-trade nav.
- ✅ New backend endpoints: `POST /api/auth/change-password`, `PUT /api/auth/profile`; client helpers `api.changePassword`, `api.updateProfile`.
- ✅ Rail navigation on `/trade` gained a "My Account" entry (above Support / Settings).

## Known Non-Blocking Findings (from backend tests)
- `_id` MongoDB field leaks in several admin list endpoints → should be excluded via `{_id: 0}` projection
- `/api/settings/public` requires Bearer auth despite the name — decide to open or rename
- `/api/auth/signup` accepts any non-empty password (no length/complexity check)
- `/api/admin/trades/:id/force` returns 200 even for unknown trade IDs (should 404)
- `app/api/[[...path]]/route.js` is a single 735-line catch-all — refactor candidate
- Background loops (engine/resolver/feed) start on first request; move to `instrumentation.ts` for prod multi-process safety

## Prioritized Backlog
### P0 (pre-deploy)
- [ ] Confirm with user what specific "updates" / UI-UX redesign items they want
- [ ] Run the Emergent native deploy (user-initiated from the chat input)

### P1 (polish)
- [ ] Strip `_id` from admin responses
- [ ] Add password-strength validation on signup
- [ ] Return 404 from admin force when trade not found
- [ ] Clarify `/api/settings/public` auth intent
- [ ] Replace hero animated line chart with a lightweight-charts real candle preview

### P2 (roadmap)
- [ ] Break `route.js` into per-feature route modules
- [ ] Move engine/resolver/feed bootstrap to `instrumentation.ts`
- [ ] Add email verification + forgot-password flow
- [ ] Add 2FA for admin role
- [ ] Build referral / affiliate program (UI already hints at it)
- [ ] Payment processor (Stripe/crypto) instead of manual deposit review
- [x] ~~Mobile PWA manifest + offline shell~~ — explicitly disabled per user request (Feb 2026)

## Recent Changes
- **Feb 2026 — PWA install fully disabled** (multiple layers):
  - `/app/frontend/app/manifest.js` (NEW) — explicit Web App Manifest with `display: "browser"` and `display_override: ["browser"]`. This is the **decisive** fix: Chrome's installability heuristics require `display: standalone/fullscreen/minimal-ui` to offer an "Install app" button, so with `"browser"` Chrome will only ever create a plain bookmark shortcut (opens with address bar visible). Re-enable PWA later by flipping `"browser"` → `"standalone"` in this single file.
  - `/app/frontend/app/layout.js` — removed `applicationName` + `apple` icon metadata; added `<meta name="apple-mobile-web-app-capable" content="no">` and `<meta name="mobile-web-app-capable" content="no">`; inlined head script that `preventDefault()`s `beforeinstallprompt` & `appinstalled`, auto-unregisters service workers, and clears CacheStorage from prior installs.
  - `/app/frontend/components/InAppBrowserBanner.jsx` (NEW, **disabled by default**) — detects in-app webviews (Instagram/FB/TikTok/X/LinkedIn/Snapchat/Pinterest/WeChat/LINE/KakaoTalk) and shows a tiny "Open in Chrome/Safari" banner. Activate via `BANNER_ENABLED=true` constant or `NEXT_PUBLIC_INAPP_BANNER_ENABLED=true` env var.

## Migration (2026-May-23)
- ✅ Imported full project from `NEXT-TRADX-LIVE-main.zip` into new Emergent workspace
- ✅ Preserved all source: backend proxy, Next.js app (pages, lib, components, hooks, scripts), memory/, tests/, test_reports/, test_result.md, configs (tailwind, postcss, next.config, jsconfig, components.json)
- ✅ Recreated missing `.env` files (gitignored in zip):
  - `/app/backend/.env`: MONGO_URL, DB_NAME=quotex_clone, NEXT_ORIGIN
  - `/app/frontend/.env`: MONGO_URL, DB_NAME=quotex_clone, JWT_SECRET, NEXT_PUBLIC_APP_URL, REACT_APP_BACKEND_URL (new pod URL), CORS_ORIGINS
- ✅ Installed Python deps from `requirements.txt` (already cached in venv) and ran `yarn install` (yarn.lock regenerated; standard for new pod)
- ✅ Discarded stale `frontend/.next/` cache (will rebuild from new pod's node_modules)
- ✅ Supervisor config already matches required topology: backend = uvicorn:8001, frontend = `yarn start` (next dev) :3000. No config change required.
- ✅ Verified end-to-end via external URL:
  - `GET /` → 200 (landing page renders with NEXT-TRADX brand + live Gold price)
  - `POST /api/auth/login` (admin@trading.com / password) → valid JWT
  - `GET /api/assets` → 40+ assets with live prices from Yahoo Finance
  - FastAPI proxy `/healthz` reports proxy target = http://localhost:3000

## Next Tasks
1. User can now redeploy to production from this new account when ready
2. Await next user request

## Default Credentials
See `/app/memory/test_credentials.md`.
