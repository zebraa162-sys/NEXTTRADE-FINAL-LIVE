import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import {
  signToken,
  verifyToken,
  getTokenFromRequest,
  getUserFromRequest,
  ensureSeedUsers,
  hashPassword,
  comparePassword
} from '@/lib/auth';
import {
  startEngine,
  getAssets,
  getAsset,
  getCurrentPrice,
  getCandles,
  addStreamer
} from '@/lib/priceEngine';
import { startResolver } from '@/lib/tradeResolver';
import { startLiveFeed } from '@/lib/liveFeed';

// Boot once
async function bootstrap() {
  if (!global.__bootstrapped) {
    global.__bootstrapped = true;
    await ensureSeedUsers();
    startEngine();
    startResolver();
    startLiveFeed();
  }
}

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    demoBalance: u.demoBalance,
    liveBalance: u.liveBalance,
    activeAccount: u.activeAccount,
    prefs: u.prefs || {}
  };
}

async function requireUser(req) {
  const user = await getUserFromRequest(req);
  return user;
}

async function handler(req, { params }) {
  await bootstrap();
  const segments = (params?.path || []);
  const route = segments.join('/');
  const method = req.method;
  const db = await getDb();

  try {
    // ----- AUTH -----
    if (route === 'auth/login' && method === 'POST') {
      const { email, password } = await req.json();
      const user = await db.collection('users').findOne({ email: (email || '').toLowerCase() });
      if (!user) return json({ error: 'Invalid credentials' }, 401);
      const ok = await comparePassword(password, user.passwordHash);
      if (!ok) return json({ error: 'Invalid credentials' }, 401);
      const token = signToken(user);
      return json({ token, user: publicUser(user) });
    }

    if (route === 'auth/signup' && method === 'POST') {
      const { email, password, name } = await req.json();
      if (!email || !password) return json({ error: 'Email and password required' }, 400);
      const lower = email.toLowerCase();
      const exists = await db.collection('users').findOne({ email: lower });
      if (exists) return json({ error: 'User already exists' }, 400);
      const u = {
        id: uuidv4(),
        email: lower,
        name: name || lower.split('@')[0],
        passwordHash: await hashPassword(password),
        role: 'user',
        demoBalance: 10000,
        liveBalance: 0,
        activeAccount: 'demo',
        createdAt: new Date()
      };
      await db.collection('users').insertOne(u);
      const token = signToken(u);
      return json({ token, user: publicUser(u) });
    }

    if (route === 'auth/me' && method === 'GET') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'Unauthorized' }, 401);
      return json({ user: publicUser(u) });
    }

    if (route === 'auth/switch' && method === 'POST') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'Unauthorized' }, 401);
      const { account } = await req.json();
      if (!['demo', 'live'].includes(account)) return json({ error: 'invalid' }, 400);
      await db.collection('users').updateOne({ id: u.id }, { $set: { activeAccount: account } });
      const fresh = await db.collection('users').findOne({ id: u.id });
      return json({ user: publicUser(fresh) });
    }

    // Reset demo balance
    if (route === 'auth/reset-demo' && method === 'POST') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'Unauthorized' }, 401);
      await db.collection('users').updateOne({ id: u.id }, { $set: { demoBalance: 10000 } });
      const fresh = await db.collection('users').findOne({ id: u.id });
      return json({ user: publicUser(fresh) });
    }

    if (route === 'auth/change-password' && method === 'POST') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'Unauthorized' }, 401);
      const { currentPassword, newPassword } = await req.json();
      if (!currentPassword || !newPassword) {
        return json({ error: 'currentPassword and newPassword are required' }, 400);
      }
      if (String(newPassword).length < 6) {
        return json({ error: 'New password must be at least 6 characters' }, 400);
      }
      const ok = await comparePassword(currentPassword, u.passwordHash);
      if (!ok) return json({ error: 'Current password is incorrect' }, 401);
      const newHash = await hashPassword(newPassword);
      await db.collection('users').updateOne(
        { id: u.id },
        { $set: { passwordHash: newHash, passwordUpdatedAt: new Date() } }
      );
      return json({ ok: true });
    }

    if (route === 'auth/profile' && method === 'PUT') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'Unauthorized' }, 401);
      const { name } = await req.json();
      const trimmed = typeof name === 'string' ? name.trim() : '';
      if (!trimmed) return json({ error: 'Name is required' }, 400);
      await db.collection('users').updateOne(
        { id: u.id },
        { $set: { name: trimmed } }
      );
      const fresh = await db.collection('users').findOne({ id: u.id });
      return json({ user: publicUser(fresh) });
    }

    // Persisted user preferences (last asset, last interval, last trade size,
    // etc.). Saved automatically by the trade page so that on next login
    // the workspace re-opens exactly where the trader left off.
    if (route === 'auth/prefs' && method === 'PUT') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'Unauthorized' }, 401);
      const body = await req.json().catch(() => ({}));
      const allowed = ['lastAsset', 'lastInterval', 'lastDuration', 'lastAmount', 'lastAssetTab'];
      const update = {};
      for (const k of allowed) {
        if (body[k] === undefined) continue;
        const v = body[k];
        if (k === 'lastAsset')      update[`prefs.${k}`] = String(v).slice(0, 32);
        else if (k === 'lastAssetTab') update[`prefs.${k}`] = ['otc','live'].includes(v) ? v : 'otc';
        else if (k === 'lastInterval') update[`prefs.${k}`] = Math.max(5, Math.min(600, Number(v) || 5));
        else if (k === 'lastDuration') update[`prefs.${k}`] = Math.max(5, Math.min(1800, Math.floor(Number(v) || 60)));
        else if (k === 'lastAmount')   update[`prefs.${k}`] = Math.max(1, Math.min(100000, Math.floor(Number(v) || 1)));
      }
      if (Object.keys(update).length === 0) return json({ ok: true, prefs: u.prefs || {} });
      await db.collection('users').updateOne({ id: u.id }, { $set: update });
      const fresh = await db.collection('users').findOne({ id: u.id });
      return json({ ok: true, prefs: fresh.prefs || {} });
    }

    // ----- MARKET DATA -----
    if (route === 'assets' && method === 'GET') {
      return json({ assets: getAssets() });
    }

    if (segments[0] === 'price' && segments[1] && method === 'GET') {
      const sym = segments[1];
      const a = getAsset(sym);
      if (!a) return json({ error: 'unknown asset' }, 404);
      return json({ symbol: sym, price: a.price, decimals: a.decimals, payout: a.payout, t: Date.now() });
    }

    if (segments[0] === 'candles' && segments[1] && method === 'GET') {
      const sym = segments[1];
      const url = new URL(req.url);
      const interval = parseInt(url.searchParams.get('interval') || '5');
      const a = getAsset(sym);
      if (!a) return json({ error: 'unknown asset' }, 404);
      const candles = getCandles(sym, interval);
      return json({ symbol: sym, interval, decimals: a.decimals, payout: a.payout, candles, support: a.support, resistance: a.resistance, kind: a.kind });
    }

    // ----- REAL-TIME PRICE STREAM (Server-Sent Events) -----
    if (segments[0] === 'stream' && segments[1] && method === 'GET') {
      const sym = segments[1];
      const a = getAsset(sym);
      if (!a) return new Response('not found', { status: 404 });

      const encoder = new TextEncoder();
      let unsub = () => {};
      let pingTimer = null;

      const stream = new ReadableStream({
        start(controller) {
          let alive = true;
          const send = (obj) => {
            if (!alive) return;
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
            } catch (e) { alive = false; }
          };
          // Initial snapshot
          send({ type: 'snapshot', symbol: sym, price: a.price, decimals: a.decimals, payout: a.payout, kind: a.kind, t: Date.now() });
          // Keep-alive ping (also flushes any buffered proxy)
          pingTimer = setInterval(() => send({ type: 'ping', t: Date.now() }), 15000);
          // Subscribe to engine ticks
          unsub = addStreamer(sym, send);
          // Cleanup on client disconnect
          const cleanup = () => {
            alive = false;
            if (pingTimer) clearInterval(pingTimer);
            try { unsub(); } catch {}
            try { controller.close(); } catch {}
          };
          if (req.signal) req.signal.addEventListener('abort', cleanup);
        },
        cancel() {
          if (pingTimer) clearInterval(pingTimer);
          try { unsub(); } catch {}
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        }
      });
    }

    // ----- TRADES -----
    if (route === 'trades' && method === 'POST') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'Unauthorized' }, 401);
      const { asset, direction, amount, durationSec } = await req.json();
      if (!['up', 'down'].includes(direction)) return json({ error: 'bad direction' }, 400);
      const amt = Number(amount);
      if (!(amt > 0)) return json({ error: 'bad amount' }, 400);
      const dur = Math.max(5, Math.min(3600, parseInt(durationSec || 60)));
      const a = getAsset(asset);
      if (!a) return json({ error: 'bad asset' }, 400);

      const account = u.activeAccount || 'demo';
      const balField = account === 'demo' ? 'demoBalance' : 'liveBalance';
      if ((u[balField] || 0) < amt) {
        return json({ error: 'Insufficient balance' }, 400);
      }

      // deduct stake
      await db.collection('users').updateOne({ id: u.id }, { $inc: { [balField]: -amt } });

      const now = new Date();
      const trade = {
        id: uuidv4(),
        userId: u.id,
        userEmail: u.email,
        asset,
        direction,
        amount: amt,
        account,
        entryPrice: a.price,
        durationSec: dur,
        openedAt: now,
        expiresAt: new Date(now.getTime() + dur * 1000),
        status: 'open',
        outcome: null,
        forceOutcome: null,
        payout: 0,
        pnl: 0,
        wedgeApplied: false
      };
      await db.collection('trades').insertOne(trade);
      const fresh = await db.collection('users').findOne({ id: u.id });
      return json({ trade, user: publicUser(fresh) });
    }

    if (route === 'trades' && method === 'GET') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'Unauthorized' }, 401);
      const url = new URL(req.url);
      const status = url.searchParams.get('status'); // open|closed|all
      const q = { userId: u.id };
      if (status && status !== 'all') q.status = status;
      const trades = await db.collection('trades').find(q).sort({ openedAt: -1 }).limit(100).toArray();
      return json({ trades });
    }

    // ----- DEPOSITS / WITHDRAWALS -----
    if (route === 'deposits' && method === 'POST') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'Unauthorized' }, 401);
      const { amount, method: payMethod, methodData } = await req.json();
      const amt = Number(amount);
      if (!(amt > 0)) return json({ error: 'invalid amount' }, 400);
      if (!payMethod) return json({ error: 'method required' }, 400);
      const set = await db.collection('settings').findOne({ id: 'global' });
      const minDep = Number(set?.minDeposit || 10);
      if (amt < minDep) return json({ error: `Minimum deposit is $${minDep}` }, 400);
      const dep = {
        id: uuidv4(),
        userId: u.id,
        userEmail: u.email,
        type: 'deposit',
        amount: amt,
        method: payMethod,
        methodData: methodData || {},
        status: 'pending',
        createdAt: new Date(),
        adminNote: null,
        resolvedAt: null
      };
      await db.collection('deposit_requests').insertOne(dep);
      return json({ deposit: dep });
    }

    if (route === 'deposits' && method === 'GET') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'Unauthorized' }, 401);
      const list = await db.collection('deposit_requests').find({ userId: u.id }).sort({ createdAt: -1 }).limit(50).toArray();
      return json({ deposits: list });
    }

    if (route === 'withdrawals' && method === 'POST') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'Unauthorized' }, 401);
      const { amount, method: payMethod, methodData } = await req.json();
      const amt = Number(amount);
      if (!(amt > 0)) return json({ error: 'invalid amount' }, 400);
      if (!payMethod) return json({ error: 'method required' }, 400);
      const set = await db.collection('settings').findOne({ id: 'global' });
      const minWd = Number(set?.minWithdrawal || 10);
      if (amt < minWd) return json({ error: `Minimum withdrawal is $${minWd}` }, 400);
      if ((u.liveBalance || 0) < amt) return json({ error: 'Insufficient live balance' }, 400);
      // Escrow: deduct now, refund on reject
      await db.collection('users').updateOne({ id: u.id }, { $inc: { liveBalance: -amt } });
      const wd = {
        id: uuidv4(),
        userId: u.id,
        userEmail: u.email,
        type: 'withdrawal',
        amount: amt,
        method: payMethod,
        methodData: methodData || {},
        status: 'pending',
        createdAt: new Date(),
        adminNote: null,
        resolvedAt: null
      };
      await db.collection('withdrawal_requests').insertOne(wd);
      const fresh = await db.collection('users').findOne({ id: u.id });
      return json({ withdrawal: wd, user: publicUser(fresh) });
    }

    if (route === 'withdrawals' && method === 'GET') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'Unauthorized' }, 401);
      const list = await db.collection('withdrawal_requests').find({ userId: u.id }).sort({ createdAt: -1 }).limit(50).toArray();
      return json({ withdrawals: list });
    }

    // ----- ADMIN -----
    if (segments[0] === 'admin') {
      const u = await requireUser(req);
      if (!u || u.role !== 'admin') return json({ error: 'forbidden' }, 403);

      if (route === 'admin/users' && method === 'GET') {
        const users = await db.collection('users').find({}, { projection: { passwordHash: 0 } }).toArray();
        return json({ users });
      }

      if (route === 'admin/trades' && method === 'GET') {
        const url = new URL(req.url);
        const status = url.searchParams.get('status') || 'open';
        const q = status === 'all' ? {} : { status };
        const trades = await db.collection('trades').find(q).sort({ openedAt: -1 }).limit(200).toArray();
        return json({ trades });
      }

      if (segments[0] === 'admin' && segments[1] === 'trades' && segments[2] && segments[3] === 'force' && method === 'POST') {
        const tradeId = segments[2];
        const { outcome } = await req.json();
        if (!['win', 'loss', null, ''].includes(outcome)) return json({ error: 'bad outcome' }, 400);
        await db.collection('trades').updateOne(
          { id: tradeId, status: 'open' },
          { $set: { forceOutcome: outcome || null } }
        );
        const trade = await db.collection('trades').findOne({ id: tradeId });
        return json({ trade });
      }

      if (route === 'admin/settings' && method === 'GET') {
        const s = await db.collection('settings').findOne({ id: 'global' });
        return json({ settings: s });
      }

      if (route === 'admin/settings' && method === 'PUT') {
        const body = await req.json();
        const update = {};
        if (body.winRatio !== undefined) update.winRatio = Math.max(0, Math.min(1, Number(body.winRatio)));
        if (body.payoutRate !== undefined) update.payoutRate = Math.max(1, Math.min(5, Number(body.payoutRate)));
        if (body.manipulationEnabled !== undefined) update.manipulationEnabled = !!body.manipulationEnabled;
        if (body.bigWinInjection !== undefined) update.bigWinInjection = !!body.bigWinInjection;
        if (body.dailyProfitTarget !== undefined) update.dailyProfitTarget = Number(body.dailyProfitTarget) || 0;
        if (body.safetyNet !== undefined) update.safetyNet = Number(body.safetyNet) || 0;
        if (body.tradePattern !== undefined) update.tradePattern = String(body.tradePattern || '').toUpperCase().slice(0, 32);
        if (body.minDeposit !== undefined) update.minDeposit = Math.max(1, Number(body.minDeposit) || 10);
        if (body.minWithdrawal !== undefined) update.minWithdrawal = Math.max(1, Number(body.minWithdrawal) || 10);
        update.updatedAt = new Date();

        // If the trade pattern was changed, reset every user's per-user
        // patternIndex so the NEW pattern restarts from position 1 for
        // everyone (instead of resuming mid-cycle from the previous one).
        const currentSettings = await db.collection('settings').findOne({ id: 'global' });
        const patternChanged =
          body.tradePattern !== undefined &&
          (currentSettings?.tradePattern || '') !== update.tradePattern;

        await db.collection('settings').updateOne({ id: 'global' }, { $set: update }, { upsert: true });

        if (patternChanged) {
          await db.collection('users').updateMany({}, { $set: { patternIndex: 0 } });
        }

        const s = await db.collection('settings').findOne({ id: 'global' });
        return json({ settings: s });
      }

      if (segments[0] === 'admin' && segments[1] === 'users' && segments[2] && segments[3] === 'balance' && method === 'POST') {
        const userId = segments[2];
        const { delta, account } = await req.json();
        const field = account === 'live' ? 'liveBalance' : 'demoBalance';
        await db.collection('users').updateOne({ id: userId }, { $inc: { [field]: Number(delta) } });
        const fresh = await db.collection('users').findOne({ id: userId });
        return json({ user: publicUser(fresh) });
      }

      if (route === 'admin/stats' && method === 'GET') {
        const totalUsers = await db.collection('users').countDocuments({});
        const openTrades = await db.collection('trades').countDocuments({ status: 'open' });
        const closedTrades = await db.collection('trades').countDocuments({ status: 'closed' });
        const wins = await db.collection('trades').countDocuments({ outcome: 'win' });
        const losses = await db.collection('trades').countDocuments({ outcome: 'loss' });
        const pendingDeposits = await db.collection('deposit_requests').countDocuments({ status: 'pending' });
        const pendingWithdrawals = await db.collection('withdrawal_requests').countDocuments({ status: 'pending' });

        // Aggregations: total approved deposit / withdraw amounts
        const depAgg = await db.collection('deposit_requests').aggregate([
          { $match: { status: 'approved' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).toArray();
        const wdAgg = await db.collection('withdrawal_requests').aggregate([
          { $match: { status: 'approved' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).toArray();
        // Sum of every user's live balance => money currently in user wallets
        const balAgg = await db.collection('users').aggregate([
          { $group: { _id: null, total: { $sum: '$liveBalance' } } }
        ]).toArray();
        // Net P/L from house perspective = -SUM(pnl) on closed live trades.
        // Users winning => house loses. House profit = sum of stakes on losses
        // minus payouts on wins. We approximate via -1 * sum(user pnl on live).
        const pnlAgg = await db.collection('trades').aggregate([
          { $match: { status: 'closed', account: 'live' } },
          { $group: { _id: null, total: { $sum: '$pnl' } } }
        ]).toArray();

        const totalDeposit = depAgg[0]?.total || 0;
        const totalWithdraw = wdAgg[0]?.total || 0;
        const activeBalance = balAgg[0]?.total || 0;
        const totalProfit = -1 * (pnlAgg[0]?.total || 0);

        return json({
          totalUsers, openTrades, closedTrades, wins, losses,
          pendingDeposits, pendingWithdrawals,
          totalDeposit, totalWithdraw, activeBalance, totalProfit,
        });
      }

      // Deposit/Withdrawal management
      if (route === 'admin/deposits' && method === 'GET') {
        const url = new URL(req.url);
        const status = url.searchParams.get('status') || 'pending';
        const q = status === 'all' ? {} : { status };
        const list = await db.collection('deposit_requests').find(q).sort({ createdAt: -1 }).limit(200).toArray();
        return json({ deposits: list });
      }
      if (route === 'admin/withdrawals' && method === 'GET') {
        const url = new URL(req.url);
        const status = url.searchParams.get('status') || 'pending';
        const q = status === 'all' ? {} : { status };
        const list = await db.collection('withdrawal_requests').find(q).sort({ createdAt: -1 }).limit(200).toArray();
        return json({ withdrawals: list });
      }

      if (segments[0] === 'admin' && segments[1] === 'deposits' && segments[2] && segments[3] && method === 'POST') {
        const id = segments[2];
        const action = segments[3]; // 'approve' | 'reject'
        const body = await req.json().catch(() => ({}));
        const dep = await db.collection('deposit_requests').findOne({ id });
        if (!dep) return json({ error: 'not found' }, 404);
        if (dep.status !== 'pending') return json({ error: 'already processed' }, 400);
        if (action === 'approve') {
          await db.collection('users').updateOne({ id: dep.userId }, { $inc: { liveBalance: dep.amount } });
          await db.collection('deposit_requests').updateOne({ id }, { $set: { status: 'approved', resolvedAt: new Date(), adminNote: body.note || null } });
        } else if (action === 'reject') {
          await db.collection('deposit_requests').updateOne({ id }, { $set: { status: 'rejected', resolvedAt: new Date(), adminNote: body.note || null } });
        } else {
          return json({ error: 'bad action' }, 400);
        }
        const fresh = await db.collection('deposit_requests').findOne({ id });
        return json({ deposit: fresh });
      }

      if (segments[0] === 'admin' && segments[1] === 'withdrawals' && segments[2] && segments[3] && method === 'POST') {
        const id = segments[2];
        const action = segments[3];
        const body = await req.json().catch(() => ({}));
        const wd = await db.collection('withdrawal_requests').findOne({ id });
        if (!wd) return json({ error: 'not found' }, 404);
        if (wd.status !== 'pending') return json({ error: 'already processed' }, 400);
        if (action === 'approve') {
          // Funds were already escrowed at request time; just mark approved
          await db.collection('withdrawal_requests').updateOne({ id }, { $set: { status: 'approved', resolvedAt: new Date(), adminNote: body.note || null } });
        } else if (action === 'reject') {
          // Refund the amount back to user's live balance
          await db.collection('users').updateOne({ id: wd.userId }, { $inc: { liveBalance: wd.amount } });
          await db.collection('withdrawal_requests').updateOne({ id }, { $set: { status: 'rejected', resolvedAt: new Date(), adminNote: body.note || null } });
        } else {
          return json({ error: 'bad action' }, 400);
        }
        const fresh = await db.collection('withdrawal_requests').findOne({ id });
        return json({ withdrawal: fresh });
      }

      // ============ Admin Announcements ============
      if (route === 'admin/announcements' && method === 'GET') {
        const list = await db.collection('announcements').find({}).sort({ createdAt: -1 }).limit(100).toArray();
        return json({ announcements: list });
      }
      if (route === 'admin/announcements' && method === 'POST') {
        const body = await req.json();
        const title = String(body.title || '').trim().slice(0, 120);
        const message = String(body.message || '').trim().slice(0, 2000);
        if (!title || !message) return json({ error: 'title and message required' }, 400);
        const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
        const ann = {
          id: uuidv4(),
          title, message,
          active: true,
          expiresAt,
          createdAt: new Date(),
          createdBy: u.email,
        };
        await db.collection('announcements').insertOne(ann);
        return json({ announcement: ann });
      }
      if (segments[0] === 'admin' && segments[1] === 'announcements' && segments[2] && method === 'DELETE') {
        await db.collection('announcements').deleteOne({ id: segments[2] });
        return json({ ok: true });
      }
      if (segments[0] === 'admin' && segments[1] === 'announcements' && segments[2] && method === 'PUT') {
        const body = await req.json();
        const update = {};
        if (body.active !== undefined) update.active = !!body.active;
        if (body.title !== undefined) update.title = String(body.title).trim().slice(0, 120);
        if (body.message !== undefined) update.message = String(body.message).trim().slice(0, 2000);
        if (body.expiresAt !== undefined) update.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
        await db.collection('announcements').updateOne({ id: segments[2] }, { $set: update });
        const fresh = await db.collection('announcements').findOne({ id: segments[2] });
        return json({ announcement: fresh });
      }

      // ============ Admin Support Tickets ============
      // List all tickets (optionally filtered by status)
      if (route === 'admin/support/tickets' && method === 'GET') {
        const url = new URL(req.url);
        const status = url.searchParams.get('status') || 'all';
        const q = status === 'all' ? {} : { status };
        const list = await db.collection('support_tickets')
          .find(q)
          .sort({ lastMessageAt: -1 })
          .project({ messages: 0 })
          .limit(300)
          .toArray();
        return json({ tickets: list });
      }
      // Total unread (admin view) count
      if (route === 'admin/support/unread' && method === 'GET') {
        const agg = await db.collection('support_tickets').aggregate([
          { $group: { _id: null, total: { $sum: '$unreadForAdmin' } } }
        ]).toArray();
        return json({ unread: agg[0]?.total || 0 });
      }
      // Change ticket status (close/reopen)
      if (segments[0] === 'admin' && segments[1] === 'support' && segments[2] === 'tickets' && segments[3] && method === 'PATCH') {
        const body = await req.json().catch(() => ({}));
        const status = String(body.status || '').toLowerCase();
        if (!['open', 'closed'].includes(status)) return json({ error: 'bad status' }, 400);
        await db.collection('support_tickets').updateOne(
          { id: segments[3] },
          { $set: { status, updatedAt: new Date() } }
        );
        const fresh = await db.collection('support_tickets').findOne({ id: segments[3] });
        return json({ ticket: fresh });
      }
    }

    // ============ Support Tickets (User side) ============
    // Create new ticket
    if (route === 'support/tickets' && method === 'POST') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'unauthorized' }, 401);
      const body = await req.json().catch(() => ({}));
      const subject = String(body.subject || '').trim().slice(0, 150);
      const message = String(body.message || '').trim().slice(0, 4000);
      if (!subject || !message) return json({ error: 'Subject and message required' }, 400);
      const now = new Date();
      const ticket = {
        id: uuidv4(),
        userId: u.id,
        userEmail: u.email,
        userName: u.name || u.email,
        subject,
        status: 'open',
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
        lastMessage: message,
        lastSender: 'user',
        unreadForUser: 0,
        unreadForAdmin: 1,
        messages: [{
          id: uuidv4(),
          sender: 'user',
          senderEmail: u.email,
          text: message,
          createdAt: now,
        }],
      };
      await db.collection('support_tickets').insertOne(ticket);
      return json({ ticket });
    }
    // List user's own tickets (without full messages for lightness)
    if (route === 'support/tickets' && method === 'GET') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'unauthorized' }, 401);
      const list = await db.collection('support_tickets')
        .find({ userId: u.id })
        .sort({ lastMessageAt: -1 })
        .project({ messages: 0 })
        .limit(100)
        .toArray();
      return json({ tickets: list });
    }
    // Count of unread admin replies across all tickets for current user
    if (route === 'support/unread' && method === 'GET') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'unauthorized' }, 401);
      const agg = await db.collection('support_tickets').aggregate([
        { $match: { userId: u.id } },
        { $group: { _id: null, total: { $sum: '$unreadForUser' } } }
      ]).toArray();
      return json({ unread: agg[0]?.total || 0 });
    }
    // Fetch specific ticket (owner OR admin). Mark read for viewer.
    if (segments[0] === 'support' && segments[1] === 'tickets' && segments[2] && !segments[3] && method === 'GET') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'unauthorized' }, 401);
      const t = await db.collection('support_tickets').findOne({ id: segments[2] });
      if (!t) return json({ error: 'not found' }, 404);
      if (t.userId !== u.id && u.role !== 'admin') return json({ error: 'forbidden' }, 403);
      // Clear unread for viewer
      const clearField = u.role === 'admin' ? 'unreadForAdmin' : 'unreadForUser';
      if ((t[clearField] || 0) > 0) {
        await db.collection('support_tickets').updateOne({ id: t.id }, { $set: { [clearField]: 0 } });
        t[clearField] = 0;
      }
      return json({ ticket: t });
    }
    // Post message on a ticket (owner OR admin)
    if (segments[0] === 'support' && segments[1] === 'tickets' && segments[2] && segments[3] === 'messages' && method === 'POST') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'unauthorized' }, 401);
      const t = await db.collection('support_tickets').findOne({ id: segments[2] });
      if (!t) return json({ error: 'not found' }, 404);
      if (t.userId !== u.id && u.role !== 'admin') return json({ error: 'forbidden' }, 403);
      if (t.status === 'closed') return json({ error: 'ticket closed' }, 400);
      const body = await req.json().catch(() => ({}));
      const text = String(body.text || '').trim().slice(0, 4000);
      if (!text) return json({ error: 'message required' }, 400);
      const now = new Date();
      const sender = u.role === 'admin' ? 'admin' : 'user';
      const msg = { id: uuidv4(), sender, senderEmail: u.email, text, createdAt: now };
      const inc = sender === 'admin' ? { unreadForUser: 1 } : { unreadForAdmin: 1 };
      await db.collection('support_tickets').updateOne(
        { id: t.id },
        {
          $push: { messages: msg },
          $set: { lastMessageAt: now, updatedAt: now, lastMessage: text, lastSender: sender },
          $inc: inc,
        }
      );
      const fresh = await db.collection('support_tickets').findOne({ id: t.id });
      return json({ ticket: fresh });
    }

    // ============ Public (auth-required) endpoints ============
    // Public subset of admin settings — min deposit/withdraw thresholds
    if (route === 'settings/public' && method === 'GET') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'unauthorized' }, 401);
      const s = await db.collection('settings').findOne({ id: 'global' }) || {};
      return json({ settings: {
        minDeposit: Number(s.minDeposit || 10),
        minWithdrawal: Number(s.minWithdrawal || 10),
      }});
    }

    // Active announcement banner shown to logged-in users
    if (route === 'announcements/active' && method === 'GET') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'unauthorized' }, 401);
      const now = new Date();
      const ann = await db.collection('announcements').find({
        active: true,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: now } }
        ]
      }).sort({ createdAt: -1 }).limit(1).toArray();
      return json({ announcement: ann[0] || null });
    }

    // Leaderboard — top 10 traders by P&L on LIVE-account closed trades,
    // resolved since today's local 00:00 UTC. Resets daily at midnight UTC
    // (i.e. when a fresh trade resolves on the next calendar day, only those
    // new trades count). Demo trades are excluded.
    if (route === 'leaderboard' && method === 'GET') {
      const u = await requireUser(req);
      if (!u) return json({ error: 'unauthorized' }, 401);

      // Start of today (UTC). Anything resolved at or after this moment is
      // included. We use UTC so the leaderboard rolls over predictably for
      // every user regardless of their local timezone.
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);

      const top = await db.collection('trades').aggregate([
        { $match: {
            status: 'closed',
            account: 'live',                  // live-account trades only
            resolvedAt: { $gte: dayStart },   // today only — daily reset
        } },
        { $group: {
            _id: '$userId',
            userEmail: { $first: '$userEmail' },
            totalPnl: { $sum: '$pnl' },
            wins: { $sum: { $cond: [{ $eq: ['$outcome', 'win'] }, 1, 0] } },
            losses: { $sum: { $cond: [{ $eq: ['$outcome', 'loss'] }, 1, 0] } },
            trades: { $sum: 1 },
        } },
        { $sort: { totalPnl: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, userId: '$_id', userEmail: 1, totalPnl: 1, wins: 1, losses: 1, trades: 1 } }
      ]).toArray();

      // Enrich each leaderboard row with the trader's display name pulled
      // from the users collection so the UI can show a friendly label
      // alongside the short ID (e.g. "Alice #A1B2C3").
      const leaderIds = top.map((r) => r.userId);
      const userDocs = leaderIds.length
        ? await db.collection('users').find(
            { id: { $in: leaderIds } },
            { projection: { _id: 0, id: 1, name: 1, email: 1 } }
          ).toArray()
        : [];
      const userMap = {};
      userDocs.forEach((d) => { userMap[d.id] = d; });

      const shortId = (uuid) => (uuid || '').replace(/-/g, '').slice(-6).toUpperCase() || 'ANON';
      const anonymized = top.map((row, idx) => {
        const ud = userMap[row.userId] || {};
        const emailPrefix = (ud.email || row.userEmail || '').split('@')[0];
        const displayName = (ud.name && ud.name.trim()) || emailPrefix || 'Anonymous';
        return {
          rank: idx + 1,
          name: displayName,
          userId: `#${shortId(row.userId)}`,
          totalPnl: +(row.totalPnl || 0).toFixed(2),
          wins: row.wins || 0,
          losses: row.losses || 0,
          trades: row.trades || 0,
          isMe: row.userId === u.id,
        };
      });
      return json({ leaderboard: anonymized });
    }

    if (route === '' || route === 'health') {
      return json({ ok: true, ts: Date.now() });
    }

    return json({ error: 'not found', route, method }, 404);
  } catch (err) {
    console.error('API error', err);
    return json({ error: 'server error', detail: String(err?.message || err) }, 500);
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
export const dynamic = 'force-dynamic';
