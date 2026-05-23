import { getDb } from './db';
import { getCurrentPrice, injectNudge, getAsset, snapPrice } from './priceEngine';

// Background loop that resolves expired trades + a pre-stager that starts a
// gentle, multi-tick price drift ~1.8 s BEFORE expiry so the chart candles at
// close time blend into normal volatility instead of producing a visible
// spike / long wick at the instant of resolution.
//
// Why two loops:
//   • Pre-stager (every 250 ms): decides the target outcome (force / pattern /
//     house-edge) for trades about to expire, and — if the natural price does
//     not match the target — starts a smooth nudge distributed across 7 ticks
//     (~1.75 s). Per-tick magnitude ≈ 0.017 %, well inside natural GBM noise.
//   • Resolver (every 500 ms): picks up expired trades, reads the now-drifted
//     close price, and writes the final outcome. No last-second wedge.

// Wedge timing — keep the visible move tight to the very last second.
const PRESTAGE_LEAD_MS = 900;  // start the wedge ~0.9s before expiry
const NUDGE_TICKS_MIN = 3;     // floor (3 × 250ms = 750ms of drift)
const NUDGE_TICKS_MAX = 4;     // cap so the wedge finishes before expiry
const PER_TICK_MAX = 0.0004;   // per-tick soft target (~0.04%) — used to scale ticks
const NUDGE_BUFFER = 0.00015;  // 0.015% past entry — clearly across the entry line
// No hard cap on total magnitude: the wedge must be big enough to actually
// cross the entry line. If the natural price is e.g. 0.3% above entry and the
// trade is forced LOSS, we need a wedge that moves price >0.3% downward —
// otherwise the chart would close ABOVE entry while the outcome reads LOSS
// (the bug we're fixing).

// Decides the target outcome for a trade based on force / pattern / global
// win-ratio settings. Returns { outcome } where outcome is 'win' | 'loss' |
// null (null = let the natural market price decide). Has the SIDE EFFECT of
// atomically advancing the user's patternIndex when a trade pattern is
// active — this is intentional so each trade consumes exactly one index.
async function determineTarget(db, trade, settings) {
  // Per-trade admin override always wins.
  if (trade.forceOutcome === 'win')  return { outcome: 'win' };
  if (trade.forceOutcome === 'loss') return { outcome: 'loss' };

  // Global manipulation disabled → pure market-driven outcome.
  if (settings.manipulationEnabled === false) return { outcome: null };

  // Trade pattern (e.g. "WWL") takes precedence over win-ratio when set.
  const rawPattern = String(settings.tradePattern || '').toUpperCase();
  const pattern = rawPattern === 'RANDOM' ? '' : rawPattern.replace(/[^WL]/g, '');
  if (pattern.length > 0) {
    await db.collection('users').updateOne(
      { id: trade.userId },
      { $inc: { patternIndex: 1 } }
    );
    const after = await db.collection('users').findOne(
      { id: trade.userId },
      { projection: { patternIndex: 1, _id: 0 } }
    );
    const idx1 = Number(after?.patternIndex) || 1;
    const target = pattern[(idx1 - 1) % pattern.length] === 'W' ? 'win' : 'loss';
    return { outcome: target };
  }

  // Hard-mode shortcuts:
  //   winRatio >= 1.0 → "Win Mode"   → ALL trades win  (force-flip natural losses)
  //   winRatio <= 0   → "Lose Mode"  → ALL trades lose (force-flip natural wins)
  // Without these explicit branches the probabilistic path below only flips
  // naturally-winning trades, so Win Mode would never convert a natural loss
  // into a win.
  const wr = Number(settings.winRatio);
  if (wr >= 1) return { outcome: 'win' };
  if (wr <= 0) return { outcome: 'loss' };

  // Probabilistic house edge (Stabilize / Manual): only force a loss on
  // naturally-winning trades with probability (1 - winRatio).
  const currentPrice = getCurrentPrice(trade.asset);
  const naturallyWon =
    (trade.direction === 'up'   && currentPrice > trade.entryPrice) ||
    (trade.direction === 'down' && currentPrice < trade.entryPrice);
  if (naturallyWon && Math.random() > wr) {
    return { outcome: 'loss' };
  }
  return { outcome: null }; // natural
}

// Kicks off a gentle multi-tick nudge for a trade if (and only if) the natural
// price currently disagrees with the intended outcome. Marks the trade as
// pre-staged so the resolver doesn't re-compute at expiry.
async function preStageOne(db, trade) {
  // Atomic "claim" — first pre-stager tick to flip preStaged → true wins.
  const claim = await db.collection('trades').updateOne(
    { id: trade.id, preStaged: { $ne: true } },
    { $set: { preStaged: true, preStagedAt: new Date() } }
  );
  if (claim.matchedCount === 0) return;

  const settings = await db.collection('settings').findOne({ id: 'global' }) ||
    { winRatio: 0.2, payoutRate: 1.8, manipulationEnabled: true };
  const { outcome: target } = await determineTarget(db, trade, settings);

  const updates = {};
  if (target === 'win' || target === 'loss') {
    updates.preStagedOutcome = target;

    const currentPrice = getCurrentPrice(trade.asset);
    const naturallyWon =
      (trade.direction === 'up'   && currentPrice > trade.entryPrice) ||
      (trade.direction === 'down' && currentPrice < trade.entryPrice);

    // Only nudge when natural ≠ target. If already on the correct side we
    // just freeze the target and let the market continue naturally.
    if ((target === 'win' && !naturallyWon) || (target === 'loss' && naturallyWon)) {
      // ADAPTIVE magnitude: move the price exactly far enough to land just past
      // entry on the target side. No upper cap — under-shooting was the source
      // of the "outcome=loss but close > entry" visual bug. We compensate by
      // playing the move out over multiple ticks so the candle wick looks like
      // a clean last-second reversal, not a teleport.
      const currentRel = (currentPrice - trade.entryPrice) / trade.entryPrice;
      const targetSign = target === 'win'
        ? (trade.direction === 'up' ? 1 : -1)
        : (trade.direction === 'up' ? -1 : 1);
      const moveRel = targetSign * NUDGE_BUFFER - currentRel;
      const magnitude = Math.abs(moveRel);
      const dir = moveRel >= 0 ? 'up' : 'down';
      // Spread across enough ticks that per-tick step stays under PER_TICK_MAX,
      // but never longer than the prestage window can finish (NUDGE_TICKS_MAX).
      let ticks = Math.max(NUDGE_TICKS_MIN, Math.ceil(magnitude / PER_TICK_MAX));
      if (ticks > NUDGE_TICKS_MAX) ticks = NUDGE_TICKS_MAX;
      injectNudge(trade.asset, magnitude, dir, ticks);
      updates.wedgeApplied = true;
      updates.wedgeMagnitude = +(magnitude * 100).toFixed(4); // store as %
      updates.wedgeTicks = ticks;
    }
  }
  if (Object.keys(updates).length > 0) {
    await db.collection('trades').updateOne({ id: trade.id }, { $set: updates });
  }
}

async function resolveOne(db, trade) {
  const asset = getAsset(trade.asset);
  if (!asset) return;
  const settings = await db.collection('settings').findOne({ id: 'global' }) ||
    { winRatio: 0.2, payoutRate: 1.8, manipulationEnabled: true };

  let closePrice = getCurrentPrice(trade.asset);
  let outcome;

  if (trade.preStagedOutcome === 'win' || trade.preStagedOutcome === 'loss') {
    // Pre-stager already smoothly drifted the price — trust it.
    outcome = trade.preStagedOutcome;
  } else if (trade.preStaged) {
    // Pre-stager ran and decided "natural" — no nudge was applied.
    const naturallyWon =
      (trade.direction === 'up'   && closePrice > trade.entryPrice) ||
      (trade.direction === 'down' && closePrice < trade.entryPrice);
    outcome = naturallyWon ? 'win' : 'loss';
  } else {
    // Fallback: trade expired before the pre-stager could run (duration was
    // shorter than PRESTAGE_LEAD_MS, or the engine was just (re)started).
    // In this rare path we still avoid a visible spike by using the same
    // adaptive multi-tick nudge and waiting for it to play out.
    const { outcome: target } = await determineTarget(db, trade, settings);
    const naturallyWon =
      (trade.direction === 'up'   && closePrice > trade.entryPrice) ||
      (trade.direction === 'down' && closePrice < trade.entryPrice);
    if (target === null) {
      outcome = naturallyWon ? 'win' : 'loss';
    } else {
      outcome = target;
      if ((target === 'win' && !naturallyWon) || (target === 'loss' && naturallyWon)) {
        const currentRel = (closePrice - trade.entryPrice) / trade.entryPrice;
        const targetSign = target === 'win'
          ? (trade.direction === 'up' ? 1 : -1)
          : (trade.direction === 'up' ? -1 : 1);
        const moveRel = targetSign * NUDGE_BUFFER - currentRel;
        const magnitude = Math.min(NUDGE_MAG_CAP, Math.abs(moveRel));
        const dir = moveRel >= 0 ? 'up' : 'down';
        const ticks = Math.max(NUDGE_TICKS_MIN, Math.ceil(magnitude / PER_TICK_MAX));
        injectNudge(trade.asset, magnitude, dir, ticks);
        await new Promise((r) => setTimeout(r, ticks * 260));
        closePrice = getCurrentPrice(trade.asset);
      }
    }
  }

  // Re-read close price (the pre-stage nudge may have still been finishing
  // its last tick at the moment the trade expired).
  closePrice = getCurrentPrice(trade.asset);

  // Tie-breaker: exact equality counts as a loss.
  if (closePrice === trade.entryPrice) outcome = 'loss';

  // SAFETY NET — guarantee the recorded close price lands on the same side of
  // entry as the recorded outcome. Without this, a force-loss on a strongly
  // winning trade can leave the visible close above entry (for UP trades) or
  // below entry (for DOWN trades), which looks broken to the trader. We snap
  // the engine price to a value just past entry on the correct side and
  // record that as the close. The snap also writes through to the live
  // candle on every interval so the chart shows a clear last-second
  // reversal wick instead of a frozen body.
  const matches =
    outcome === 'win'
      ? (trade.direction === 'up'   ? closePrice > trade.entryPrice
                                    : closePrice < trade.entryPrice)
      : (trade.direction === 'up'   ? closePrice < trade.entryPrice
                                    : closePrice > trade.entryPrice);
  if (!matches) {
    const winSide = (trade.direction === 'up' ? 1 : -1);
    const sign = outcome === 'win' ? winSide : -winSide;
    closePrice = +(trade.entryPrice * (1 + sign * NUDGE_BUFFER)).toFixed(8);
    snapPrice(trade.asset, closePrice);
  }

  const payoutRate = settings.payoutRate || 1.8;
  const payout = outcome === 'win' ? +(trade.amount * payoutRate).toFixed(2) : 0;
  const pnl = outcome === 'win' ? +(trade.amount * (payoutRate - 1)).toFixed(2) : -trade.amount;

  await db.collection('trades').updateOne(
    { id: trade.id },
    { $set: {
        status: 'closed',
        closePrice,
        outcome,
        payout,
        pnl,
        resolvedAt: new Date()
      }
    }
  );

  if (outcome === 'win') {
    const inc = trade.account === 'demo'
      ? { demoBalance: payout }
      : { liveBalance: payout };
    await db.collection('users').updateOne({ id: trade.userId }, { $inc: inc });
  }
}

export function startResolver() {
  if (global.__tradeResolverStarted) return;
  global.__tradeResolverStarted = true;

  // Pre-stager — 250 ms cadence, non-overlapping.
  let preStageBusy = false;
  setInterval(async () => {
    if (preStageBusy) return;
    preStageBusy = true;
    try {
      const db = await getDb();
      const nowMs = Date.now();
      const soon = new Date(nowMs + PRESTAGE_LEAD_MS);
      const candidates = await db.collection('trades').find({
        status: 'open',
        preStaged: { $ne: true },
        expiresAt: { $gt: new Date(nowMs), $lte: soon }
      }).limit(100).toArray();
      for (const t of candidates) {
        try { await preStageOne(db, t); } catch (e) { console.error('preStage err', e); }
      }
    } catch (e) {
      console.error('pre-stager error', e);
    } finally {
      preStageBusy = false;
    }
  }, 250);

  // Resolver — 500 ms cadence, non-overlapping.
  let resolveBusy = false;
  setInterval(async () => {
    if (resolveBusy) return;
    resolveBusy = true;
    try {
      const db = await getDb();
      const now = new Date();
      const expired = await db.collection('trades').find({
        status: 'open',
        expiresAt: { $lte: now }
      }).limit(50).toArray();
      for (const t of expired) {
        try { await resolveOne(db, t); } catch (e) { console.error('resolve err', e); }
      }
    } catch (e) {
      console.error('resolver error', e);
    } finally {
      resolveBusy = false;
    }
  }, 500);
}
