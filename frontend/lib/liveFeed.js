// Finnhub live data feed.
//   - WebSocket for real-time crypto + stock trades
//   - REST polling for forex + metals (free tier limitation)
// Pushes ticks into priceEngine via onLiveTick.

import WebSocket from 'ws';
import { LIVE_ASSETS } from './liveAssetsConfig';
import { onLiveTick } from './priceEngine';

const TOKEN = process.env.FINNHUB_API_KEY || '';

async function fetchQuote(key) {
  const a = LIVE_ASSETS[key];
  if (!a) return;
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(a.fhSymbol)}&token=${TOKEN}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    if (data && typeof data.c === 'number' && data.c > 0) {
      onLiveTick(key, data.c, Date.now());
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

async function fetchForexFallback(key) {
  // Try forex/rates as fallback for OANDA forex/metal symbols
  const a = LIVE_ASSETS[key];
  if (!a) return false;
  const m = a.fhSymbol.match(/^OANDA:([A-Z]{3})_([A-Z]{3})$/);
  if (!m) return false;
  const base = m[1], target = m[2];
  try {
    const url = `https://finnhub.io/api/v1/forex/rates?base=${base}&token=${TOKEN}`;
    const res = await fetch(url, { cache: 'no-store' });
    const d = await res.json();
    if (d && d.quote && typeof d.quote[target] === 'number' && d.quote[target] > 0) {
      onLiveTick(key, d.quote[target], Date.now());
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

// Yahoo Finance unofficial chart endpoint - no auth needed.
// Used as the PRIMARY source for forex + metals (free + reliable). The Yahoo
// chart endpoint returns regularMarketPrice updated every ~minute.
// We derive the Yahoo symbol from the LIVE_ASSETS fhSymbol when possible
// (we set fhSymbol directly to Yahoo `<PAIR>=X` format in liveAssetsConfig).
async function fetchYahoo(key) {
  const a = LIVE_ASSETS[key];
  if (!a) return false;
  // Accept Yahoo symbols ending in =X (forex), =F (futures like GC=F gold),
  // or fall back to OANDA-style mapping.
  let ysym = a.fhSymbol;
  if (!/=[XF]$/.test(ysym)) {
    const m = ysym.match(/^OANDA:([A-Z]{3})_([A-Z]{3})$/);
    if (m) ysym = `${m[1]}${m[2]}=X`;
    else return false;
  }
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ysym)}?interval=1m&range=1d`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; trading-lite/1.0)' }
    });
    if (!res.ok) return false;
    const d = await res.json();
    const price = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof price === 'number' && price > 0) {
      onLiveTick(key, price, Date.now());
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

async function seedAllPrices() {
  // Parallelize Yahoo fetches for fast initial seed. Prioritize Gold so that
  // the OTC XAU anchor kicks in immediately rather than after 20 sequential
  // fetches.
  const keys = Object.keys(LIVE_ASSETS).sort((a, b) => (a === 'XAUUSD_LIVE' ? -1 : b === 'XAUUSD_LIVE' ? 1 : 0));
  await Promise.allSettled(keys.map(k => fetchYahoo(k)));
}

async function pollLowFreqSymbols() {
  // All current LIVE assets are forex/metals - poll via Yahoo every cycle
  await Promise.allSettled(Object.keys(LIVE_ASSETS).map(k => fetchYahoo(k)));
}

function connectWS() {
  // Crypto + stocks removed from LIVE catalogue, so the Finnhub WS is no
  // longer required. Kept as a no-op so existing callers don't break.
  return;
}

export function startLiveFeed() {
  if (global.__liveFeedStarted) return;
  global.__liveFeedStarted = true;
  // 1) Seed initial prices
  seedAllPrices();
  // 2) WS for crypto/stocks
  connectWS();
  // 3) Polling fallback every 2s
  setInterval(pollLowFreqSymbols, 2000);
  // 4) Re-seed quotes every 30s in case any didn't get a value
  setInterval(seedAllPrices, 30000);
}
