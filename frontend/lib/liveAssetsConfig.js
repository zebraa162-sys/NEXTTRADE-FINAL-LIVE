// Live asset configuration (separate file to avoid circular imports).
// Maps internal symbol keys to external feed sources.
//
// All non-XAUUSD live pairs are major forex pairs fetched via Yahoo Finance
// (free, no auth) using the `<PAIR>=X` symbol format. Crypto and stocks have
// been removed per product spec — forex + gold only.

export const LIVE_ASSETS = {
  // --- Forex majors / crosses (live via Yahoo) ---
  USDJPY_LIVE: { fhSymbol: 'USDJPY=X', name: 'USD/JPY', display: 'USD/JPY', decimals: 3, payout: 0.86, kind: 'forex' },
  EURJPY_LIVE: { fhSymbol: 'EURJPY=X', name: 'EUR/JPY', display: 'EUR/JPY', decimals: 3, payout: 0.83, kind: 'forex' },
  AUDJPY_LIVE: { fhSymbol: 'AUDJPY=X', name: 'AUD/JPY', display: 'AUD/JPY', decimals: 3, payout: 0.80, kind: 'forex' },
  CADJPY_LIVE: { fhSymbol: 'CADJPY=X', name: 'CAD/JPY', display: 'CAD/JPY', decimals: 3, payout: 0.75, kind: 'forex' },
  CHFJPY_LIVE: { fhSymbol: 'CHFJPY=X', name: 'CHF/JPY', display: 'CHF/JPY', decimals: 3, payout: 0.55, kind: 'forex' },
  GBPJPY_LIVE: { fhSymbol: 'GBPJPY=X', name: 'GBP/JPY', display: 'GBP/JPY', decimals: 3, payout: 0.55, kind: 'forex' },
  GBPUSD_LIVE: { fhSymbol: 'GBPUSD=X', name: 'GBP/USD', display: 'GBP/USD', decimals: 5, payout: 0.75, kind: 'forex' },
  EURUSD_LIVE: { fhSymbol: 'EURUSD=X', name: 'EUR/USD', display: 'EUR/USD', decimals: 5, payout: 0.50, kind: 'forex' },
  AUDUSD_LIVE: { fhSymbol: 'AUDUSD=X', name: 'AUD/USD', display: 'AUD/USD', decimals: 5, payout: 0.60, kind: 'forex' },
  USDCAD_LIVE: { fhSymbol: 'USDCAD=X', name: 'USD/CAD', display: 'USD/CAD', decimals: 5, payout: 0.50, kind: 'forex' },
  USDCHF_LIVE: { fhSymbol: 'USDCHF=X', name: 'USD/CHF', display: 'USD/CHF', decimals: 5, payout: 0.40, kind: 'forex' },
  EURGBP_LIVE: { fhSymbol: 'EURGBP=X', name: 'EUR/GBP', display: 'EUR/GBP', decimals: 5, payout: 0.60, kind: 'forex' },
  EURCAD_LIVE: { fhSymbol: 'EURCAD=X', name: 'EUR/CAD', display: 'EUR/CAD', decimals: 5, payout: 0.70, kind: 'forex' },
  EURAUD_LIVE: { fhSymbol: 'EURAUD=X', name: 'EUR/AUD', display: 'EUR/AUD', decimals: 5, payout: 0.50, kind: 'forex' },
  EURCHF_LIVE: { fhSymbol: 'EURCHF=X', name: 'EUR/CHF', display: 'EUR/CHF', decimals: 5, payout: 0.45, kind: 'forex' },
  AUDCAD_LIVE: { fhSymbol: 'AUDCAD=X', name: 'AUD/CAD', display: 'AUD/CAD', decimals: 5, payout: 0.50, kind: 'forex' },
  AUDCHF_LIVE: { fhSymbol: 'AUDCHF=X', name: 'AUD/CHF', display: 'AUD/CHF', decimals: 5, payout: 0.40, kind: 'forex' },
  GBPAUD_LIVE: { fhSymbol: 'GBPAUD=X', name: 'GBP/AUD', display: 'GBP/AUD', decimals: 5, payout: 0.40, kind: 'forex' },
  GBPCAD_LIVE: { fhSymbol: 'GBPCAD=X', name: 'GBP/CAD', display: 'GBP/CAD', decimals: 5, payout: 0.40, kind: 'forex' },
  GBPCHF_LIVE: { fhSymbol: 'GBPCHF=X', name: 'GBP/CHF', display: 'GBP/CHF', decimals: 5, payout: 0.40, kind: 'forex' },

  // --- Metals (anchor for OTC Gold) ---
  // Yahoo's spot symbol "XAUUSD=X" returns null for the chart endpoint, so
  // we use the gold front-month future ("GC=F") which is reliably exposed
  // and tracks spot within ~$1. We still display this as XAU/USD in the UI.
  XAUUSD_LIVE: { fhSymbol: 'GC=F', name: 'Gold Spot', display: 'XAU/USD', decimals: 3, payout: 0.85, kind: 'metal' },
};

// Map each OTC synthetic asset to its real-world live counterpart. Only XAUUSD
// is anchored to a live feed — the exotic OTC forex pairs (USDPKR, USDPHP, etc)
// don't have free public live quotes so they run as pure synthetic markets.
export const OTC_TO_LIVE = {
  XAUUSD: 'XAUUSD_LIVE',
};
