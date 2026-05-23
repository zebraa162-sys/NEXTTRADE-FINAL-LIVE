// In-memory price engine supporting BOTH:
//   - OTC synthetic assets (Geometric Brownian Motion ticks every 250ms)
//   - LIVE assets (prices pushed in via onLiveTick from Finnhub WS / REST poller)
// Aggregates candles per interval (5s/15s/60s) for both kinds and broadcasts ticks
// to SSE streamers.

import { LIVE_ASSETS, OTC_TO_LIVE } from './liveAssetsConfig';

// OTC synthetic markets. Only XAUUSD anchors to a real live feed; the rest
// are pure synthetic exotic forex pairs that don't have free public live
// quotes available, so they run as standalone GBM markets with reasonable
// realistic mid-market base rates.
const OTC_ASSETS = {
  // Gold OTC — anchored to live XAU/USD
  XAUUSD:  { name: 'Gold (OTC)',     display: 'XAU/USD',     price: 2350.0, vol: 0.05,  drift: 0.0, decimals: 3, payout: 0.85 },
  // Exotic forex pairs (pure synthetic, anchored only to hardcoded base price)
  USDPHP:  { name: 'USD/PHP (OTC)',  display: 'USD/PHP',     price: 56.40,  vol: 0.04,  drift: 0.0, decimals: 4, payout: 0.95 },
  USDARS:  { name: 'USD/ARS (OTC)',  display: 'USD/ARS',     price: 1010.0, vol: 0.06,  drift: 0.0, decimals: 3, payout: 0.94 },
  USDBDT:  { name: 'USD/BDT (OTC)',  display: 'USD/BDT',     price: 110.30, vol: 0.04,  drift: 0.0, decimals: 4, payout: 0.93 },
  USDCOP:  { name: 'USD/COP (OTC)',  display: 'USD/COP',     price: 4120.0, vol: 0.05,  drift: 0.0, decimals: 3, payout: 0.93 },
  NZDCAD:  { name: 'NZD/CAD (OTC)',  display: 'NZD/CAD',     price: 0.8320, vol: 0.04,  drift: 0.0, decimals: 5, payout: 0.92 },
  NZDUSD:  { name: 'NZD/USD (OTC)',  display: 'NZD/USD',     price: 0.6120, vol: 0.04,  drift: 0.0, decimals: 5, payout: 0.92 },
  USDINR:  { name: 'USD/INR (OTC)',  display: 'USD/INR',     price: 84.20,  vol: 0.03,  drift: 0.0, decimals: 4, payout: 0.92 },
  USDDZD:  { name: 'USD/DZD (OTC)',  display: 'USD/DZD',     price: 134.50, vol: 0.04,  drift: 0.0, decimals: 4, payout: 0.91 },
  USDBRL:  { name: 'USD/BRL (OTC)',  display: 'USD/BRL',     price: 5.78,   vol: 0.05,  drift: 0.0, decimals: 5, payout: 0.90 },
  CADCHF:  { name: 'CAD/CHF (OTC)',  display: 'CAD/CHF',     price: 0.6480, vol: 0.04,  drift: 0.0, decimals: 5, payout: 0.88 },
  EURNZD:  { name: 'EUR/NZD (OTC)',  display: 'EUR/NZD',     price: 1.7820, vol: 0.04,  drift: 0.0, decimals: 5, payout: 0.88 },
  USDPKR:  { name: 'USD/PKR (OTC)',  display: 'USD/PKR',     price: 278.40, vol: 0.04,  drift: 0.0, decimals: 4, payout: 0.88 },
  AUDNZD:  { name: 'AUD/NZD (OTC)',  display: 'AUD/NZD',     price: 1.0710, vol: 0.04,  drift: 0.0, decimals: 5, payout: 0.86 },
  USDMXN:  { name: 'USD/MXN (OTC)',  display: 'USD/MXN',     price: 18.10,  vol: 0.05,  drift: 0.0, decimals: 5, payout: 0.85 },
  NZDCHF:  { name: 'NZD/CHF (OTC)',  display: 'NZD/CHF',     price: 0.5400, vol: 0.04,  drift: 0.0, decimals: 5, payout: 0.84 },
  USDEGP:  { name: 'USD/EGP (OTC)',  display: 'USD/EGP',     price: 49.10,  vol: 0.05,  drift: 0.0, decimals: 4, payout: 0.83 },
  NZDJPY:  { name: 'NZD/JPY (OTC)',  display: 'NZD/JPY',     price: 95.20,  vol: 0.04,  drift: 0.0, decimals: 3, payout: 0.82 },
  GBPNZD:  { name: 'GBP/NZD (OTC)',  display: 'GBP/NZD',     price: 2.0710, vol: 0.04,  drift: 0.0, decimals: 5, payout: 0.78 },
  USDIDR:  { name: 'USD/IDR (OTC)',  display: 'USD/IDR',     price: 15820,  vol: 0.04,  drift: 0.0, decimals: 2, payout: 0.77 },
  USDNGN:  { name: 'USD/NGN (OTC)',  display: 'USD/NGN',     price: 1620,   vol: 0.05,  drift: 0.0, decimals: 2, payout: 0.77 },
};

function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Supported candle intervals in seconds: 5s, 15s, 1m, 3m, 5m, 10m.
const INTERVALS_SEC = [5, 15, 60, 180, 300, 600];
const EMPTY_CANDLES = () => Object.fromEntries(INTERVALS_SEC.map(i => [i, []]));
const EMPTY_CURRENT = () => Object.fromEntries(INTERVALS_SEC.map(i => [i, null]));

function newAssetState(symbol, def, kind) {
  return {
    symbol,
    kind, // 'otc' | 'live'
    name: def.name,
    display: def.display || symbol,
    price: def.price || 0,
    basePrice: def.price || 0,
    vol: def.vol || 0.1,
    drift: def.drift || 0,
    decimals: def.decimals,
    payout: def.payout,
    support: (def.price || 0) * 0.994,
    resistance: (def.price || 0) * 1.006,
    candles: EMPTY_CANDLES(),
    currentCandle: EMPTY_CURRENT(),
    pendingNudge: 0,
    nudgeTicksLeft: 0,
    streamers: new Set(),
    lastTickT: 0,
    seeded: kind === 'otc'
  };
}

function prewarmOTC(s, def) {
  const now = Date.now();
  let lastClose = def.price;
  s.candles = EMPTY_CANDLES();
  s.currentCandle = EMPTY_CURRENT();
  for (const interval of INTERVALS_SEC) {
    let p = def.price;
    const arr = s.candles[interval];
    for (let i = 80; i > 0; i--) {
      const tStart = Math.floor((now - i * interval * 1000) / (interval * 1000)) * (interval * 1000);
      const o = p;
      let h = o, l = o, c = o;
      const ticks = Math.max(2, Math.min(interval * 4, 200));
      for (let j = 0; j < ticks; j++) {
        const dt = (interval / ticks) / 86400;
        const z = randn();
        c = c * Math.exp((-0.5 * def.vol * def.vol) * dt + def.vol * Math.sqrt(dt) * z);
        if (c > h) h = c; if (c < l) l = c;
      }
      arr.push({ time: Math.floor(tStart / 1000), open: o, high: h, low: l, close: c });
      p = c;
    }
    if (interval === 5) lastClose = p;
  }
  s.price = lastClose;
  s.basePrice = lastClose;
  s.support = lastClose * (1 - (0.004 + Math.random() * 0.004));
  s.resistance = lastClose * (1 + (0.004 + Math.random() * 0.004));
}

// Pre-warm a LIVE asset's candle history when its very first real tick arrives.
//
// Without this, a freshly-picked live currency starts with zero historical
// bars on every timeframe — so the chart appears "empty / starting from
// candle one" and switching timeframes (5s ↔ 1m ↔ 10m) shows discontinuities
// because each interval only has bars accumulated since pod start.
//
// We synthesise 80 plausible historical bars per interval around the real
// live `basePrice`, using low-volatility GBM ticks (much tighter than OTC).
// New live ticks then naturally extend this history, so the chart looks
// continuous and switching timeframes never breaks.
function prewarmLive(s, basePrice) {
  const now = Date.now();
  // Forex / metal volatility is much tighter than synthetic OTC. Use a small
  // value so the synthetic backfill blends seamlessly with real ticks.
  const vol = 0.015;
  s.candles = EMPTY_CANDLES();
  s.currentCandle = EMPTY_CURRENT();
  for (const interval of INTERVALS_SEC) {
    let p = basePrice;
    const arr = s.candles[interval];
    for (let i = 80; i > 0; i--) {
      const tStart = Math.floor((now - i * interval * 1000) / (interval * 1000)) * (interval * 1000);
      const o = p;
      let h = o, l = o, c = o;
      const ticks = Math.max(2, Math.min(interval * 2, 120));
      for (let j = 0; j < ticks; j++) {
        const dt = (interval / ticks) / 86400;
        const z = randn();
        c = c * Math.exp((-0.5 * vol * vol) * dt + vol * Math.sqrt(dt) * z);
        if (c > h) h = c; if (c < l) l = c;
      }
      // Mean-revert each bar back toward basePrice so the synthetic history
      // doesn't drift away from the real live price.
      const drift = (basePrice - c) * 0.25;
      o + drift; // no-op kept for clarity; we keep `o` original (this is the
                 // open of the bar). The reverting effect is applied via
                 // resetting `p` for the next bar.
      arr.push({ time: Math.floor(tStart / 1000), open: o, high: h, low: l, close: c });
      // Pull next bar's start back toward basePrice (75/25 blend) so the
      // backfill clusters around the real live price.
      p = c * 0.75 + basePrice * 0.25;
    }
  }
}

function initState() {
  const state = {};
  for (const [k, def] of Object.entries(OTC_ASSETS)) {
    state[k] = newAssetState(k, def, 'otc');
    prewarmOTC(state[k], def);
  }
  for (const [k, def] of Object.entries(LIVE_ASSETS)) {
    state[k] = newAssetState(k, { name: def.name, display: def.display, price: 0, decimals: def.decimals, payout: def.payout }, 'live');
  }
  return state;
}

if (!global.__priceEngine) {
  global.__priceEngine = {
    state: initState(),
    tickIntervalMs: 250,
    started: false,
  };
}

function notifyStreamers(s, payload) {
  for (const w of s.streamers) {
    try { w(payload); } catch {}
  }
}

function updateCandles(s, price, now) {
  for (const interval of INTERVALS_SEC) {
    const bucketTime = Math.floor(now / 1000 / interval) * interval;
    let cc = s.currentCandle[interval];
    if (!cc || cc.time !== bucketTime) {
      if (cc) {
        s.candles[interval].push(cc);
        if (s.candles[interval].length > 300) s.candles[interval].shift();
      }
      cc = { time: bucketTime, open: price, high: price, low: price, close: price };
      s.currentCandle[interval] = cc;
    } else {
      if (price > cc.high) cc.high = price;
      if (price < cc.low) cc.low = price;
      cc.close = price;
    }
  }
}

// Called by liveFeed.js whenever a real-market tick arrives for a live asset
export function onLiveTick(symbol, price, t) {
  const s = global.__priceEngine.state[symbol];
  if (!s || s.kind !== 'live' || !(price > 0)) return;
  // Re-prewarm if this asset hasn't been pre-warmed under the current
  // schema (older instances may have `seeded=true` but no synthetic history).
  const needsPrewarm = !s.seeded || s.prewarmVersion !== 2;
  if (needsPrewarm) {
    s.basePrice = price;
    s.support = price * 0.997;
    s.resistance = price * 1.003;
    // Synthesise 80 bars of plausible history per interval around the very
    // first real price so the chart shows a populated, continuous history
    // immediately AND so switching between 5s / 15s / 1m / 3m / 5m / 10m
    // never collapses to a single candle.
    prewarmLive(s, price);
    s.seeded = true;
    s.prewarmVersion = 2;
  }
  // While a nudge is in progress, the 250ms engine timer is driving price
  // updates to keep the nudge smooth and consistent with OTC cadence. Raw
  // live updates would otherwise reset s.price mid-nudge and undo the
  // gradual drift, producing a visible spike at the next tick. We park
  // the raw price for after the nudge completes (decay back to natural).
  if (s.nudgeTicksLeft > 0) {
    s.parkedLivePrice = price;
    s.lastTickT = t || Date.now();
    return;
  }
  // After a nudge finishes, gently decay the residual offset between our
  // last nudged price and the latest raw live price so the chart drifts
  // back to real market over a few feed ticks instead of jumping.
  if (s.parkedLivePrice && Math.abs(price - s.price) / price > 0.0001) {
    // 30% per live tick → ~5 ticks (~10s at 2s feed cadence) to converge
    price = s.price * 0.7 + price * 0.3;
  }
  s.parkedLivePrice = 0;
  s.price = price;
  s.lastTickT = t || Date.now();
  updateCandles(s, price, Date.now());
  notifyStreamers(s, { type: 'tick', price, t: s.lastTickT });

  // Anchor the corresponding OTC synthetic asset to this real-market price.
  // Per the original brief: "OTC candles for forex/metals etc that follow the
  // live price". OTC keeps its own GBM noise + S/R bias but drifts around the
  // real price with a tight clamp to prevent wild divergence.
  const otcSym = Object.keys(OTC_TO_LIVE).find(k => OTC_TO_LIVE[k] === symbol);
  if (otcSym) {
    const otc = global.__priceEngine.state[otcSym];
    if (otc && otc.kind === 'otc') {
      if (!otc.anchored) {
        // First-time anchor. The hardcoded base for this OTC may have been
        // very different from the real live price (e.g. XAUUSD seed 2350 vs
        // live ~4760). We need to relocate the OTC to the live price level
        // WITHOUT wiping candle history — wiping causes a visible gap on the
        // chart between the candles that accumulated since engine start and
        // the freshly-synthesised backfill.
        //
        // Approach: scale every existing candle (closed + current) by the
        // price ratio so the entire historical curve shifts to the live
        // level and stays continuous, then update the asset's running price
        // and S/R bands. Future ticks continue naturally from there.
        const ratio = (otc.price > 0) ? (price / otc.price) : 1;
        if (ratio > 0 && Math.abs(ratio - 1) > 0.0001) {
          for (const interval of INTERVALS_SEC) {
            const arr = otc.candles[interval] || [];
            for (const c of arr) {
              c.open  *= ratio;
              c.high  *= ratio;
              c.low   *= ratio;
              c.close *= ratio;
            }
            const cc = otc.currentCandle[interval];
            if (cc) {
              cc.open  *= ratio;
              cc.high  *= ratio;
              cc.low   *= ratio;
              cc.close *= ratio;
            }
          }
        }
        otc.price = price;
        otc.basePrice = price;
        otc.support = price * (1 - 0.003);
        otc.resistance = price * (1 + 0.003);
        otc.anchored = true;
      } else {
        // Pull basePrice quickly toward live (25% per live tick), and also
        // gently nudge current price so it tracks live. Keeps OTC close to
        // real market without killing noise.
        otc.basePrice = otc.basePrice * 0.75 + price * 0.25;
        // Also re-center S/R around the new anchor
        otc.support = otc.basePrice * (1 - 0.003);
        otc.resistance = otc.basePrice * (1 + 0.003);
      }
    }
  }
}

function tickOTC(s, now) {
  const dt = 0.25 / 86400;
  const z = randn();
  let mu = s.drift;
  if (s.price >= s.resistance && Math.random() < 0.7) mu = -Math.abs(s.vol) * 0.5;
  else if (s.price <= s.support && Math.random() < 0.7) mu = Math.abs(s.vol) * 0.5;
  const bandFromCenter = (s.price - s.basePrice) / s.basePrice;
  // Stronger mean-reversion (was 0.5) for tight live tracking
  mu += -bandFromCenter * 2.0;
  let newPrice = s.price * Math.exp((mu - 0.5 * s.vol * s.vol) * dt + s.vol * Math.sqrt(dt) * z);
  // Hard clamp: keep OTC within ±0.4% of basePrice (which tracks live).
  // Prevents long-term drift that causes big visual gap with live feed.
  if (s.anchored) {
    const maxDev = 0.004;
    const lo = s.basePrice * (1 - maxDev);
    const hi = s.basePrice * (1 + maxDev);
    if (newPrice < lo) newPrice = lo;
    else if (newPrice > hi) newPrice = hi;
  }
  if (s.nudgeTicksLeft > 0) {
    newPrice = newPrice * (1 + s.pendingNudge);
    s.nudgeTicksLeft -= 1;
    if (s.nudgeTicksLeft === 0) s.pendingNudge = 0;
  }
  s.price = newPrice;
  updateCandles(s, newPrice, now);
  notifyStreamers(s, { type: 'tick', price: newPrice, t: now });
}

export function startEngine() {
  const eng = global.__priceEngine;
  if (!eng.timer) {
    eng.timer = setInterval(() => {
      const now = Date.now();
      for (const s of Object.values(eng.state)) {
        if (s.kind === 'otc') {
          tickOTC(s, now);
        } else if (s.kind === 'live' && s.nudgeTicksLeft > 0 && s.price > 0) {
          // Drive LIVE-asset nudges at the same 250ms cadence as OTC, so the
          // pre-stage drift is smooth (4 increments / second) regardless of
          // how often the live feed publishes. We blend a tiny GBM step in
          // with the nudge so the candle wiggle around the trend looks
          // identical to natural noise (real forex 15s noise is ~0.001 %).
          const z = randn();
          const perTickNoiseSd = 0.00002; // 0.002 % per tick — matches real forex
          const noise = 1 + perTickNoiseSd * z;
          const newPrice = s.price * (1 + s.pendingNudge) * noise;
          s.price = newPrice;
          s.nudgeTicksLeft -= 1;
          if (s.nudgeTicksLeft === 0) s.pendingNudge = 0;
          updateCandles(s, newPrice, now);
          notifyStreamers(s, { type: 'tick', price: newPrice, t: now });
        }
      }
      if (now % 30000 < eng.tickIntervalMs) {
        for (const s of Object.values(eng.state)) {
          if (s.kind === 'otc') {
            s.basePrice = s.price;
            s.support = s.price * (1 - (0.004 + Math.random() * 0.004));
            s.resistance = s.price * (1 + (0.004 + Math.random() * 0.004));
          }
        }
      }
    }, eng.tickIntervalMs);
  }

  if (!eng.gapFiller) {
    eng.gapFiller = setInterval(() => {
      const now = Date.now();
      for (const s of Object.values(eng.state)) {
        // Run for BOTH live and otc assets so neither type can show holes
        // in the candle history when a tick is briefly skipped (e.g. during
        // a feed stall or a brief Node event-loop blip).
        if (!s.seeded || !(s.price > 0)) continue;
        for (const interval of [5, 15, 60, 180, 300, 600]) {
          // Pass 1: heal any internal holes in the historical array (a
          // missed bucket between two existing candles). Pad with flat
          // candles using the previous close so the chart never shows gaps.
          const arr = s.candles[interval];
          if (arr && arr.length > 1) {
            const patched = [arr[0]];
            for (let i = 1; i < arr.length; i++) {
              const prev = patched[patched.length - 1];
              let t = prev.time + interval;
              while (t < arr[i].time) {
                patched.push({ time: t, open: prev.close, high: prev.close, low: prev.close, close: prev.close });
                t += interval;
              }
              patched.push(arr[i]);
            }
            if (patched.length !== arr.length) {
              s.candles[interval] = patched;
            }
          }

          // Pass 2: advance currentCandle forward through any unseen buckets
          // up to "now".
          const bucketTime = Math.floor(now / 1000 / interval) * interval;
          const cc = s.currentCandle[interval];
          if (!cc) {
            s.currentCandle[interval] = { time: bucketTime, open: s.price, high: s.price, low: s.price, close: s.price };
            continue;
          }
          if (cc.time !== bucketTime) {
            s.candles[interval].push(cc);
            let t = cc.time + interval;
            while (t < bucketTime) {
              s.candles[interval].push({ time: t, open: cc.close, high: cc.close, low: cc.close, close: cc.close });
              t += interval;
            }
            if (s.candles[interval].length > 300) {
              const overflow = s.candles[interval].length - 300;
              s.candles[interval].splice(0, overflow);
            }
            s.currentCandle[interval] = { time: bucketTime, open: cc.close, high: Math.max(cc.close, s.price), low: Math.min(cc.close, s.price), close: s.price };
          }
        }
      }
    }, 200);
  }

  eng.started = true;
}

export function getEngine() { return global.__priceEngine; }
export function getState() { return global.__priceEngine.state; }
export function getAsset(sym) { return global.__priceEngine.state[sym]; }
export function getCurrentPrice(sym) { return global.__priceEngine.state[sym]?.price; }

export function getAssets() {
  return Object.values(global.__priceEngine.state).map(s => ({
    symbol: s.symbol, name: s.name, display: s.display, price: s.price,
    decimals: s.decimals, payout: s.payout, kind: s.kind,
    support: s.support, resistance: s.resistance, ready: !!s.seeded
  }));
}

export function getCandles(sym, interval = 5) {
  const s = global.__priceEngine.state[sym];
  if (!s) return [];
  const arr = [...(s.candles[interval] || [])];
  if (s.currentCandle[interval]) arr.push(s.currentCandle[interval]);
  return arr;
}

export function injectNudge(sym, relativeMagnitude, direction = 'up', ticks = 4) {
  const s = global.__priceEngine.state[sym];
  if (!s) return;
  s.pendingNudge = (direction === 'up' ? 1 : -1) * Math.abs(relativeMagnitude) / ticks;
  s.nudgeTicksLeft = ticks;
}

export function addStreamer(symbol, writer) {
  const s = global.__priceEngine.state[symbol];
  if (!s) return () => {};
  s.streamers.add(writer);
  return () => { try { s.streamers.delete(writer); } catch {} };
}
