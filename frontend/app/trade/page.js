'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  Bell, Plus, Minus, Clock, Activity, BarChart3, Settings, X, Check, Search,
  Globe, Zap, Wallet, ArrowDownToLine, MousePointer, Slash, Square, Eraser,
  Trash2, History as HistoryIcon, Sliders, Menu, Pencil, Trophy, Megaphone,
  LifeBuoy, User as UserIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import QuotexLogo from '@/components/QuotexLogo';
import OTCChart from '@/components/OTCChart';
import AccountSwitcher from '@/components/AccountSwitcher';
import DepositModal from '@/components/DepositModal';
import WithdrawalModal from '@/components/WithdrawalModal';
import Leaderboard from '@/components/Leaderboard';
import AssetList from '@/components/AssetList';
import { api, getStoredUser, setStoredUser, setToken } from '@/lib/api';
import { toast } from 'sonner';

const DURATIONS = [
  { v: 5, l: '5s' }, { v: 15, l: '15s' }, { v: 30, l: '30s' },
  { v: 60, l: '1m' }, { v: 180, l: '3m' }, { v: 300, l: '5m' }
];
const INTERVALS = [
  { v: 5, l: '5s' }, { v: 15, l: '15s' }, { v: 60, l: '1m' },
  { v: 180, l: '3m' }, { v: 300, l: '5m' }, { v: 600, l: '10m' }
];

function fmtPrice(p, d = 5) {
  if (p === undefined || p === null || isNaN(p)) return '--';
  return Number(p).toFixed(d);
}

export default function TradeTerminal() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  // Hydration flag — until the stored user is loaded we don't render the
  // workspace, so we never flash the hard-coded defaults before the user's
  // saved preferences (last asset / interval / duration / amount) take over.
  const [hydrated, setHydrated] = useState(false);
  const [assets, setAssets] = useState([]);
  const [asset, setAsset] = useState('XAUUSD');
  const [interval, setInterval_] = useState(5);
  const [decimals, setDecimals] = useState(3);
  const [payoutPct, setPayoutPct] = useState(0.85);
  const [livePrice, setLivePrice] = useState(null);
  const [candles, setCandles] = useState([]);
  const [support, setSupport] = useState(null);
  const [resistance, setResistance] = useState(null);

  const [duration, setDuration] = useState(60);
  const [amount, setAmount] = useState(10);
  const [assetTab, setAssetTab] = useState('otc');
  const [search, setSearch] = useState('');

  const [activeTrades, setActiveTrades] = useState([]);
  const [history, setHistory] = useState([]);
  const [outcomePopup, setOutcomePopup] = useState(null);
  const seenClosedIds = useRef(new Set());

  // Drawing state (per-asset)
  const [tool, setTool] = useState('cursor');
  const [shapesByAsset, setShapesByAsset] = useState({});
  const [toolsOpen, setToolsOpen] = useState(false); // collapsible drawing toolbar
  const shapes = shapesByAsset[asset] || [];
  const setShapes = (next) => setShapesByAsset(s => ({ ...s, [asset]: typeof next === 'function' ? next(s[asset] || []) : next }));

  // Modals + side panels
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false); // trade form bottom sheet
  const [mobileAssetsOpen, setMobileAssetsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [announcement, setAnnouncement] = useState(null);
  // Indicator toggles (visual only — overlays come in next phase)
  const [ind, setInd] = useState({ rsi: false, ema: false, bb: false });
  const [supportUnread, setSupportUnread] = useState(0);

  // ---- Auth ----
  useEffect(() => {
    const u = getStoredUser();
    if (!u) { router.push('/login'); return; }

    // Apply any locally-cached prefs immediately so the page paints in the
    // user's last workspace. Server-side prefs come back via api.me() right
    // after — if they differ they win, but in the common case the cache is
    // already up-to-date and there's no flicker.
    applyPrefs(u.prefs);
    setUser(u);
    setHydrated(true);

    api.me().then(r => {
      setUser(r.user);
      setStoredUser(r.user);
      applyPrefs(r.user?.prefs);
    }).catch(() => {
      setToken(null); router.push('/login');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Apply stored preferences to local state (ignores blank/invalid values
  // so first-time users keep the sensible defaults).
  const applyPrefs = (p) => {
    if (!p || typeof p !== 'object') return;
    if (typeof p.lastAsset === 'string' && p.lastAsset)              setAsset(p.lastAsset);
    if (typeof p.lastInterval === 'number' && p.lastInterval > 0)    setInterval_(p.lastInterval);
    if (typeof p.lastDuration === 'number' && p.lastDuration > 0)    setDuration(p.lastDuration);
    if (typeof p.lastAmount === 'number' && p.lastAmount > 0)        setAmount(p.lastAmount);
    if (p.lastAssetTab === 'otc' || p.lastAssetTab === 'live')       setAssetTab(p.lastAssetTab);
  };

  const refreshMe = async () => {
    try { const r = await api.me(); setUser(r.user); setStoredUser(r.user); } catch {}
  };

  // Persist trade workspace preferences to the server (debounced 600 ms) so
  // that next login lands the user back on their last asset / timeframe /
  // duration / amount / OTC-vs-LIVE tab. We only start saving AFTER the
  // initial hydration so we don't overwrite the user's stored prefs with
  // the hard-coded defaults during boot.
  useEffect(() => {
    if (!hydrated || !user) return;
    const id = setTimeout(() => {
      const payload = {
        lastAsset: asset,
        lastInterval: interval,
        lastDuration: duration,
        lastAmount: Number(amount) || 0,
        lastAssetTab: assetTab,
      };
      api.savePrefs(payload).then(() => {
        // Mirror into localStorage so a subsequent page load (before the
        // /api/auth/me round-trip finishes) already sees the latest prefs.
        const stored = getStoredUser();
        if (stored) setStoredUser({ ...stored, prefs: { ...(stored.prefs || {}), ...payload } });
      }).catch(() => { /* silent — not critical */ });
    }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, asset, interval, duration, amount, assetTab]);

  // ---- Assets ----
  useEffect(() => {
    const tick = async () => {
      try { const r = await api.assets(); setAssets(r.assets || []); } catch {}
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, []);

  // ---- Candles polling ----
  useEffect(() => {
    let stop = false; let timer;
    const tick = async () => {
      if (stop) return;
      try {
        const r = await api.candles(asset, interval);
        if (!stop) {
          setCandles(r.candles || []);
          setDecimals(r.decimals);
          setPayoutPct(r.payout);
          if (r.support) setSupport(r.support);
          if (r.resistance) setResistance(r.resistance);
        }
      } catch {}
      timer = setTimeout(tick, 350);
    };
    tick();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [asset, interval]);

  // ---- SSE live ticks ----
  useEffect(() => {
    const es = new EventSource(`/api/stream/${asset}`);
    es.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if ((m.type === 'tick' || m.type === 'snapshot') && m.price && m.price > 0) setLivePrice(m.price);
      } catch {}
    };
    return () => es.close();
  }, [asset]);

  // ---- Trades polling ----
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      if (stop) return;
      try {
        const r = await api.myTrades('all');
        const open = r.trades.filter(t => t.status === 'open');
        const closed = r.trades.filter(t => t.status === 'closed');
        setActiveTrades(open);
        setHistory(closed.slice(0, 50));
        for (const t of closed) {
          if (!seenClosedIds.current.has(t.id)) {
            seenClosedIds.current.add(t.id);
            const ra = t.resolvedAt ? new Date(t.resolvedAt).getTime() : 0;
            if (Date.now() - ra < 12_000) { setOutcomePopup(t); refreshMe(); }
          }
        }
      } catch {}
      setTimeout(poll, 700);
    };
    poll();
    return () => { stop = true; };
  }, []);

  // Auto-dismiss outcome toast after 6 seconds
  useEffect(() => {
    if (!outcomePopup) return;
    const id = setTimeout(() => setOutcomePopup(null), 6000);
    return () => clearTimeout(id);
  }, [outcomePopup]);

  // Fetch active announcement on mount. The popup should show only ONCE per
  // login session. We use sessionStorage keyed by announcement id so that:
  //   - it appears the first time the user lands on the dashboard after login
  //   - dismissing it marks that announcement as seen for the session
  //   - navigating back to the dashboard in the same session will not show it again
  //   - a fresh login (sessionStorage cleared) will show it again
  //   - if admin publishes a NEW announcement with a different id, it will show again
  useEffect(() => {
    if (!user) return;
    api.activeAnnouncement().then(r => {
      const a = r?.announcement;
      if (!a) return;
      try {
        const key = `hasSeenAnnouncement_${a.id || a._id}`;
        if (typeof window !== 'undefined' && window.sessionStorage.getItem(key)) return;
      } catch {}
      setAnnouncement(a);
    }).catch(() => {});
  }, [user]);

  const dismissAnnouncement = () => {
    if (announcement) {
      try {
        const key = `hasSeenAnnouncement_${announcement.id || announcement._id}`;
        if (typeof window !== 'undefined') window.sessionStorage.setItem(key, '1');
      } catch {}
    }
    setAnnouncement(null);
  };

  // ---- Poll Support unread count (admin replies) ----
  useEffect(() => {
    if (!user) return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      try {
        const r = await api.unreadSupport();
        if (!stop) setSupportUnread(r.unread || 0);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 6000);
    return () => { stop = true; clearInterval(id); };
  }, [user]);

  const placeTrade = async (direction) => {
    if (!user) return;
    // Coerce + validate amount (might be empty string while user is typing)
    const amt = Math.max(1, Math.floor(Number(amount) || 0));
    if (amt < 1) { toast.error('Enter a valid amount'); return; }
    if (amt !== Number(amount)) setAmount(amt);
    // Coerce + validate duration too (typed mm:ss could be < 5s)
    const dur = Math.max(5, Math.min(1800, Math.floor(Number(duration) || 0)));
    if (dur !== duration) setDuration(dur);
    try {
      const r = await api.placeTrade({ asset, direction, amount: amt, durationSec: dur });
      setUser(r.user); setStoredUser(r.user);
      toast.success(`Trade Opened: ${direction.toUpperCase()} ${asset} for $${amt}`);
    } catch (e) { toast.error(e.message); }
  };

  const balance = user ? (user.activeAccount === 'demo' ? user.demoBalance : user.liveBalance) : 0;
  const currentAsset = useMemo(() => assets.find(a => a.symbol === asset), [assets, asset]);
  const payoutAmount = useMemo(() => {
    const a = Number(amount) || 0;
    return +(a * (1 + payoutPct)).toFixed(2);
  }, [amount, payoutPct]);
  const filteredLive = useMemo(() => assets.filter(a => a.kind === 'live'), [assets]);
  const filteredOTC  = useMemo(() => assets.filter(a => a.kind === 'otc'), [assets]);
  // Decorate each on-asset active trade with its global card index (matching
  // the #N badge in the sidebar) so the chart overlay can draw the same tag.
  const visibleTrades = activeTrades
    .map((t, i) => ({ ...t, _idx: i + 1 }))
    .filter(t => t.asset === asset);

  const onShapeAdd = (sh) => setShapes(arr => [...arr, sh]);
  const onShapeRemove = (id) => setShapes(arr => arr.filter(s => s.id !== id));
  const clearShapes = () => setShapes([]);

  const pickAsset = (a) => { setAsset(a.symbol); setSearch(''); setMobileAssetsOpen(false); };

  // NOTE: AssetList is now a top-level component in /components/AssetList.jsx.
  // Nesting it inside this render function made React unmount+remount the
  // list on every state change — that is why picking a currency pair or
  // toggling OTC/LIVE used to need two clicks. Passing all needed state
  // through as props keeps a stable component identity.

  // ---------- Trade form (time + amount + up/down) — shared ----------
  const TradeForm = ({ compact }) => (
    <div className={compact ? '' : 'p-4 border-b border-white/5'}>
      {!compact && (
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-white/40 flex items-center gap-1">
              Asset
              {currentAsset?.kind === 'live' ? (
                <span className="px-1 py-0.5 bg-[#ff5555]/20 text-[#ff5555] text-[8px] font-bold rounded animate-pulse">LIVE</span>
              ) : (
                <span className="px-1 py-0.5 bg-[#00b97a]/15 text-[#00b97a] text-[8px] font-bold rounded">OTC</span>
              )}
            </div>
            <div className="text-lg font-bold">{currentAsset?.display || asset}</div>
          </div>
          <div className="text-[#f0b90b] font-bold text-lg">{Math.round(payoutPct * 100)}%</div>
        </div>
      )}

      <div className="bg-[#11161e] rounded-lg p-3 border border-white/5 mb-3">
        <div className="text-[10px] uppercase text-white/40 mb-1.5">Time</div>
        <div className="flex items-center justify-between">
          <button onClick={() => { const i = DURATIONS.findIndex(d => d.v === duration); if (i > 0) setDuration(DURATIONS[i - 1].v); }} className="w-8 h-8 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center" data-testid="time-minus-btn">
            <Minus className="w-4 h-4" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={`${Math.floor(duration / 60).toString().padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`}
            onChange={e => {
              // Accept "mm:ss" or raw seconds typed in. Clamp 5s..30min.
              const raw = e.target.value.replace(/[^0-9:]/g, '');
              let secs;
              if (raw.includes(':')) {
                const [m = '0', s = '0'] = raw.split(':');
                secs = (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0);
              } else {
                secs = parseInt(raw, 10) || 0;
              }
              if (secs < 1) secs = 1;
              if (secs > 1800) secs = 1800; // cap at 30 min
              setDuration(secs);
            }}
            onBlur={() => { if (duration < 5) setDuration(5); }}
            data-testid="time-input"
            className="font-mono text-lg font-bold bg-transparent text-center w-20 outline-none focus:text-[#00b97a] caret-[#00b97a]"
          />
          <button onClick={() => { const i = DURATIONS.findIndex(d => d.v === duration); if (i < DURATIONS.length - 1) setDuration(DURATIONS[i + 1].v); }} className="w-8 h-8 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center" data-testid="time-plus-btn">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1 mt-2">
          {DURATIONS.map(d => (
            <button key={d.v} onClick={() => setDuration(d.v)} className={`flex-1 text-[10px] py-1 rounded ${duration === d.v ? 'bg-[#00b97a] text-white' : 'bg-white/5 text-white/50 hover:text-white'}`} data-testid={`time-preset-${d.v}`}>
              {d.l}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#11161e] rounded-lg p-3 border border-white/5 mb-3">
        <div className="text-[10px] uppercase text-white/40 mb-1.5">Investment</div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAmount(a => Math.max(1, (Number(a) || 0) - 1))} className="w-8 h-8 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center" data-testid="amount-minus-btn">
            <Minus className="w-4 h-4" />
          </button>
          <Input
            type="number"
            inputMode="decimal"
            min={1}
            value={amount}
            onChange={e => {
              // Allow empty / 0 transiently so the user can type freely
              // (e.g. clear the field and type 250). We only clamp on blur
              // and again at trade submission time.
              const v = e.target.value;
              setAmount(v === '' ? '' : Number(v));
            }}
            onBlur={() => { const n = Number(amount); setAmount(Number.isFinite(n) && n >= 1 ? n : 1); }}
            className="bg-transparent border-none text-center font-bold text-lg flex-1"
            data-testid="amount-input"
          />
          <button onClick={() => setAmount(a => (Number(a) || 0) + 1)} className="w-8 h-8 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center" data-testid="amount-plus-btn">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1 mt-2">
          {[1, 10, 50, 100, 500].map(v => (
            <button key={v} onClick={() => setAmount(v)} className="flex-1 text-[10px] py-1 rounded bg-white/5 hover:bg-white/10 text-white/60" data-testid={`amount-preset-${v}`}>${v}</button>
          ))}
        </div>
      </div>

      <div className="flex justify-between text-sm mb-3 px-1">
        <span className="text-white/50">Payout</span>
        <span className="font-bold text-[#00b97a]">${payoutAmount.toFixed(2)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => { placeTrade('up'); setMobilePanelOpen(false); }} className="h-12 bg-[#00b97a] hover:bg-[#00a86d] font-bold text-base glow-pulse-green transition-transform active:scale-95">
          Up <TrendingUp className="w-4 h-4 ml-1" />
        </Button>
        <Button onClick={() => { placeTrade('down'); setMobilePanelOpen(false); }} className="h-12 bg-[#ff5555] hover:bg-[#ee4444] font-bold text-base glow-pulse-red transition-transform active:scale-95">
          Down <TrendingDown className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-[100dvh] w-screen bg-[#0c1015] text-white flex flex-col overflow-hidden">
      {/* ===================== HEADER ===================== */}
      {/* Desktop / tablet header */}
      <header className="hidden md:flex items-center justify-between px-4 h-14 border-b border-white/5 bg-[#0a0d12]">
        <div className="flex items-center gap-6">
          <QuotexLogo />
        </div>
        <div className="flex items-center gap-2">
          <AccountSwitcher
            user={user}
            onUserUpdate={(u) => { setUser(u); setStoredUser(u); }}
            onOpenDeposit={() => setDepositOpen(true)}
            onOpenWithdrawal={() => setWithdrawOpen(true)}
          />
          <Button onClick={() => setDepositOpen(true)} className="bg-[#00b97a] hover:bg-[#00a86d] font-semibold h-9">
            <Plus className="w-4 h-4 mr-1" /> Deposit
          </Button>
          <Button onClick={() => setWithdrawOpen(true)} variant="ghost" className="bg-white/5 hover:bg-white/10 h-9">Withdrawal</Button>
        </div>
      </header>

      {/* Mobile header — compact Quotex-style */}
      <header className="md:hidden flex items-center justify-between px-3 h-12 border-b border-white/5 bg-[#0a0d12] shrink-0">
        <button onClick={() => setMobileMenuOpen(true)} className="w-9 h-9 rounded-md hover:bg-white/5 flex items-center justify-center">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex-1 flex justify-center">
          <AccountSwitcher
            user={user}
            onUserUpdate={(u) => { setUser(u); setStoredUser(u); }}
            onOpenDeposit={() => setDepositOpen(true)}
            onOpenWithdrawal={() => setWithdrawOpen(true)}
            compact
          />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setDepositOpen(true)} className="h-8 px-3 bg-[#00b97a] hover:bg-[#00a86d] text-white text-xs font-bold rounded-md flex items-center">
            <Plus className="w-3.5 h-3.5 mr-0.5" /> Deposit
          </button>
        </div>
      </header>

      {/* ===================== BODY ===================== */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop left rail — labelled navigation */}
        <aside className="hidden md:flex w-48 border-r border-white/5 bg-[#0a0d12] flex-col py-2 gap-0.5 shrink-0">
          <RailBtn icon={BarChart3} label="Trade" active />
          <RailBtn icon={Trophy} label="Leaderboard" onClick={() => setLeaderboardOpen(true)} />
          <RailBtn icon={Activity} label="Indicators" onClick={() => setIndicatorsOpen(true)} />
          <RailBtn icon={HistoryIcon} label="History" onClick={() => setHistoryOpen(true)} />
          <RailBtn icon={Wallet} label="Deposit" onClick={() => setDepositOpen(true)} />
          <RailBtn icon={ArrowDownToLine} label="Withdraw" onClick={() => setWithdrawOpen(true)} />
          <RailBtn icon={UserIcon} label="My Account" onClick={() => router.push('/account')} />
          <div className="flex-1" />
          <RailBtn icon={LifeBuoy} label="Support" badge={supportUnread} onClick={() => router.push('/support')} />
          <RailBtn icon={Settings} label="Settings" onClick={() => setSettingsOpen(true)} />
        </aside>

        {/* Chart area */}
        <main className="flex-1 flex flex-col relative bg-[#0c1015] min-w-0">
          {/* Top floating chart controls */}
          <div className="absolute top-2 md:top-3 left-2 md:left-3 z-20 flex items-center gap-1.5 md:gap-2 flex-wrap max-w-[calc(100%-0.75rem)]">
            {/* Desktop-only asset selector. On mobile, asset picker lives in the bottom panel */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="hidden md:flex bg-[#11161e] border border-white/10 rounded-lg px-3 py-2 items-center gap-3 hover:bg-[#161c26] min-w-[170px]">
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold">{currentAsset?.display || asset}</div>
                      {currentAsset?.kind === 'live' ? (
                        <span className="px-1 py-0.5 bg-[#ff5555]/20 text-[#ff5555] text-[9px] font-bold rounded uppercase animate-pulse">LIVE</span>
                      ) : (
                        <span className="px-1 py-0.5 bg-[#00b97a]/15 text-[#00b97a] text-[9px] font-bold rounded uppercase">OTC</span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#f0b90b] font-bold">{Math.round(payoutPct * 100)}% payout</div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-white/40" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#11161e] border-white/10 w-[360px] p-0" align="start">
                <AssetList
                  assets={assets}
                  assetTab={assetTab}
                  setAssetTab={setAssetTab}
                  search={search}
                  setSearch={setSearch}
                  onPick={pickAsset}
                />
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-0.5 bg-[#11161e] border border-white/10 rounded-lg p-0.5 md:p-1">
              {INTERVALS.map(it => (
                <button key={it.v} onClick={() => setInterval_(it.v)} className={`px-2 md:px-3 py-1 text-[10px] md:text-xs rounded font-semibold ${interval === it.v ? 'bg-[#00b97a] text-white' : 'text-white/50 hover:text-white'}`}>
                  {it.l}
                </button>
              ))}
            </div>
            <div className="hidden sm:block bg-[#11161e] border border-white/10 rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs text-white/60">
              <span className="hidden md:inline">{currentAsset?.kind === 'live' ? 'Live ' : ''}price: </span>
              <span className="font-mono text-white font-bold">{fmtPrice(livePrice, decimals)}</span>
            </div>
          </div>

          <div className="flex-1 relative">
            <OTCChart
              symbol={asset}
              candles={candles}
              livePrice={livePrice}
              support={currentAsset?.kind === 'otc' ? support : null}
              resistance={currentAsset?.kind === 'otc' ? resistance : null}
              activeTrades={visibleTrades}
              decimals={decimals}
              intervalSec={interval}
              payoutPct={payoutPct}
              tool={tool}
              shapes={shapes}
              onShapeAdd={onShapeAdd}
              onShapeRemove={onShapeRemove}
            />

            {/* Collapsible Drawing toolbar (bottom-left of chart) */}
            <div className="absolute left-2 md:left-3 z-20 flex flex-col items-start gap-1"
                 style={{ bottom: '0.75rem' }}>
              {/* Expanded tools */}
              <AnimatePresence>
                {toolsOpen && (
                  <motion.div
                    initial={{ opacity: 0, x: -8, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    exit={{ opacity: 0, x: -8, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="bg-[#11161e] border border-white/10 rounded-lg p-1 flex flex-col gap-1 shadow-xl overflow-hidden"
                  >
                    <ToolBtn icon={MousePointer} title="Cursor" active={tool === 'cursor'} onClick={() => setTool('cursor')} />
                    <ToolBtn icon={Slash} title="Trendline" active={tool === 'trendline'} onClick={() => setTool('trendline')} />
                    <ToolBtn icon={Square} title="Rectangle" active={tool === 'rectangle'} onClick={() => setTool('rectangle')} />
                    <ToolBtn icon={Eraser} title="Eraser (click shape)" active={tool === 'eraser'} onClick={() => setTool('eraser')} />
                    <div className="h-px bg-white/5 my-0.5" />
                    <ToolBtn icon={Trash2} title="Clear all drawings" onClick={clearShapes} />
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Toggle button */}
              <button
                onClick={() => setToolsOpen(v => !v)}
                title={toolsOpen ? 'Hide drawing tools' : 'Show drawing tools'}
                className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-xl border ${
                  toolsOpen ? 'bg-[#1a8eff] border-[#1a8eff] text-white' : 'bg-[#11161e] border-white/10 text-white/70 hover:text-white hover:bg-[#161c26]'
                }`}
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ===== Mobile permanent bottom trade panel (Quotex-style) ===== */}
          <div className="md:hidden border-t border-white/5 bg-[#0a0d12] shrink-0"
               style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {/* Asset row */}
            <button onClick={() => setMobileAssetsOpen(true)}
                    className="w-full flex items-center justify-between px-3 py-2 border-b border-white/5 active:bg-white/5">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${currentAsset?.kind === 'live' ? 'bg-[#ff5555]/20 text-[#ff5555]' : 'bg-[#f0b90b]/20 text-[#f0b90b]'}`}>
                  {currentAsset?.display?.[0] || 'A'}
                </div>
                <div className="text-sm font-bold">{currentAsset?.display || asset}</div>
                {currentAsset?.kind === 'live' ? (
                  <span className="px-1 py-0.5 bg-[#ff5555]/20 text-[#ff5555] text-[9px] font-bold rounded uppercase animate-pulse">LIVE</span>
                ) : (
                  <span className="px-1 py-0.5 bg-[#00b97a]/15 text-[#00b97a] text-[9px] font-bold rounded uppercase">OTC</span>
                )}
                <span className="text-[#f0b90b] font-bold text-sm">{Math.round(payoutPct * 100)}%</span>
                <ChevronDown className="w-4 h-4 text-white/40" />
              </div>
              <div className="text-[10px] text-white/40 font-mono">{fmtPrice(livePrice, decimals)}</div>
            </button>

            {/* Timer & Investment */}
            <div className="grid grid-cols-2 gap-2 px-3 pt-2">
              {/* Timer */}
              <div className="relative rounded-md border border-white/10 bg-[#11161e] px-2 pt-2 pb-1">
                <span className="absolute -top-1.5 left-2 text-[9px] text-white/40 uppercase bg-[#0a0d12] px-1">Timer</span>
                <div className="flex items-center justify-between">
                  <button onClick={() => { const i = DURATIONS.findIndex(d => d.v === duration); if (i > 0) setDuration(DURATIONS[i - 1].v); }} className="w-6 h-6 rounded-full bg-white/5 active:bg-white/10 flex items-center justify-center">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={`00:${Math.floor(duration / 60).toString().padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9:]/g, '');
                      const parts = raw.split(':').filter(Boolean);
                      let secs = 0;
                      if (parts.length === 1) secs = parseInt(parts[0], 10) || 0;
                      else if (parts.length === 2) secs = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
                      else if (parts.length >= 3) secs = (parseInt(parts[0], 10) || 0) * 3600 + (parseInt(parts[1], 10) || 0) * 60 + (parseInt(parts[2], 10) || 0);
                      if (secs < 1) secs = 1;
                      if (secs > 1800) secs = 1800;
                      setDuration(secs);
                    }}
                    onBlur={() => { if (duration < 5) setDuration(5); }}
                    data-testid="mobile-time-input"
                    className="font-mono text-base font-bold bg-transparent text-center w-24 outline-none focus:text-[#00b97a] caret-[#00b97a]"
                  />
                  <button onClick={() => { const i = DURATIONS.findIndex(d => d.v === duration); if (i < DURATIONS.length - 1) setDuration(DURATIONS[i + 1].v); }} className="w-6 h-6 rounded-full bg-white/5 active:bg-white/10 flex items-center justify-center">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {/* Investment */}
              <div className="relative rounded-md border border-white/10 bg-[#11161e] px-2 pt-2 pb-1">
                <span className="absolute -top-1.5 left-2 text-[9px] text-white/40 uppercase bg-[#0a0d12] px-1">Investment</span>
                <div className="flex items-center justify-between">
                  <button onClick={() => setAmount(a => Math.max(1, (Number(a) || 0) - 1))} className="w-6 h-6 rounded-full bg-white/5 active:bg-white/10 flex items-center justify-center">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-baseline gap-0.5">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={1}
                      value={amount}
                      onChange={e => {
                        const v = e.target.value;
                        setAmount(v === '' ? '' : Number(v));
                      }}
                      onBlur={() => { const n = Number(amount); setAmount(Number.isFinite(n) && n >= 1 ? n : 1); }}
                      data-testid="mobile-amount-input"
                      className="font-bold text-base bg-transparent text-center w-14 outline-none focus:text-[#00b97a] caret-[#00b97a]"
                    />
                    <span className="text-base font-bold">$</span>
                  </div>
                  <button onClick={() => setAmount(a => (Number(a) || 0) + 1)} className="w-6 h-6 rounded-full bg-white/5 active:bg-white/10 flex items-center justify-center">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Payout row */}
            <div className="flex items-center justify-between px-3 py-1.5 text-xs">
              <span className="text-white/50">Payout</span>
              <span className="flex-1 mx-2 border-b border-dotted border-white/15" />
              <span className="font-bold text-[#00b97a]">{payoutAmount.toFixed(0)} $</span>
            </div>

            {/* Up / Down */}
            <div className="grid grid-cols-2 gap-2 px-3 pb-2">
              <button onClick={() => placeTrade('up')} className="h-11 rounded-lg bg-[#00b97a] hover:bg-[#00a86d] active:scale-[0.97] font-bold text-sm flex items-center justify-between px-4 transition glow-pulse-green">
                <span>Up</span>
                <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5" />
                </span>
              </button>
              <button onClick={() => placeTrade('down')} className="h-11 rounded-lg bg-[#ff5555] hover:bg-[#ee4444] active:scale-[0.97] font-bold text-sm flex items-center justify-between px-4 transition glow-pulse-red">
                <span>Down</span>
                <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <TrendingDown className="w-3.5 h-3.5" />
                </span>
              </button>
            </div>
          </div>
        </main>

        {/* Desktop right panel */}
        <aside className="hidden md:flex w-80 border-l border-white/5 bg-[#0a0d12] flex-col">
          <TradeForm />

          {/* All active trades — each gets its own card so traders can see and
              track multiple simultaneous positions. The card index (#1, #2,
              ...) matches the small numbered tag drawn on the chart so the
              user can correlate each card with its on-chart marker. */}
          {activeTrades.length > 0 && (
            <div className="border-b border-white/5 px-3 py-3 space-y-2 max-h-[40%] overflow-y-auto scrollbar-thin" data-testid="active-trades-stack">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/40 px-1">
                <span>Active trades</span>
                <span className="text-[#f0b90b] font-bold">{activeTrades.length}</span>
              </div>
              {activeTrades.map((t, i) => (
                <ActiveTradeCard
                  key={t.id}
                  trade={t}
                  live={t.asset === asset ? livePrice : null}
                  pct={payoutPct}
                  index={i + 1}
                  isCurrent={t.asset === asset}
                />
              ))}
            </div>
          )}

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-4 pt-3 pb-2 flex justify-between text-xs">
              <span className="text-white/50">Trades <span className="text-white font-bold">{activeTrades.length}</span></span>
              <span className="text-white/50">History <span className="text-white font-bold">{history.length}</span></span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3 space-y-2">
              {activeTrades.length === 0 && history.length === 0 ? (
                <div className="text-center text-white/30 text-xs py-8 border border-dashed border-white/5 rounded-lg">
                  No trades yet. Use the form above to open one.
                </div>
              ) : (
                <>
                  {history.map(t => <TradeRow key={t.id} t={t} pct={payoutPct} />)}
                </>
              )}
              {/* Leaderboard widget - desktop right panel */}
              <div className="pt-2">
                <Leaderboard compact />
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ===================== Mobile bottom-sheet: Asset selector ===================== */}
      <Sheet open={mobileAssetsOpen} onOpenChange={setMobileAssetsOpen}>
        <SheetContent side="bottom" className="bg-[#0a0d12] border-white/10 text-white p-0 h-[80vh] flex flex-col rounded-t-2xl overflow-hidden">
          <SheetTitle className="sr-only">Choose asset</SheetTitle>
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto my-3 shrink-0" />
          <div className="flex-1 min-h-0 flex flex-col">
            <AssetList
              assets={assets}
              assetTab={assetTab}
              setAssetTab={setAssetTab}
              search={search}
              setSearch={setSearch}
              onPick={pickAsset}
              mobileFull
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ===================== Mobile menu drawer ===================== */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="bg-[#0a0d12] border-white/5 text-white w-72 p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="p-4 border-b border-white/5">
            <QuotexLogo />
            <div className="mt-3 text-xs text-white/50">{user?.email}</div>
          </div>
          <div className="p-2">
            {[
              { icon: BarChart3, label: 'Trade', active: true, onClick: () => setMobileMenuOpen(false) },
              { icon: Trophy, label: 'Leaderboard', onClick: () => { setMobileMenuOpen(false); setLeaderboardOpen(true); } },
              { icon: Activity, label: 'Indicators', onClick: () => { setMobileMenuOpen(false); setIndicatorsOpen(true); } },
              { icon: HistoryIcon, label: 'Trade history', onClick: () => { setMobileMenuOpen(false); setHistoryOpen(true); } },
              { icon: ArrowDownToLine, label: 'Withdrawal', onClick: () => { setMobileMenuOpen(false); setWithdrawOpen(true); } },
              { icon: LifeBuoy, label: 'Support', badge: supportUnread, onClick: () => { setMobileMenuOpen(false); router.push('/support'); } },
              { icon: Settings, label: 'Settings', onClick: () => { setMobileMenuOpen(false); setSettingsOpen(true); } },
            ].map((it, i) => (
              <button key={i} onClick={it.onClick} className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm ${it.active ? 'bg-[#00b97a]/15 text-[#00b97a]' : 'text-white/70 hover:bg-white/5'}`}>
                <it.icon className="w-4 h-4" />
                <span className="flex-1 text-left">{it.label}</span>
                {it.badge > 0 && (
                  <span className="px-1.5 h-4 min-w-[16px] rounded-full bg-[#ff5555] text-white text-[10px] font-bold flex items-center justify-center">
                    {it.badge > 99 ? '99+' : it.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* ===================== Outcome popup (small bottom-left toast) ===================== */}
      <AnimatePresence>
        {outcomePopup && (
          <motion.div
            key={outcomePopup.id}
            initial={{ opacity: 0, x: -40, scale: 0.85 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -40, scale: 0.9 }}
            transition={{ type: 'spring', damping: 18, stiffness: 220 }}
            className="fixed z-50 left-3 sm:left-4 bottom-3 sm:bottom-4 w-[min(88vw,300px)]"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
          >
            <div className={`rounded-xl border bg-[#11161e]/95 backdrop-blur-md shadow-2xl overflow-hidden ${
              outcomePopup.outcome === 'win' ? 'border-[#00b97a]/50 shadow-[#00b97a]/20' : 'border-[#ff5555]/50 shadow-[#ff5555]/20'
            }`}>
              <div className={`h-0.5 ${outcomePopup.outcome === 'win' ? 'bg-gradient-to-r from-[#00b97a] via-[#22d3ee] to-[#00b97a]' : 'bg-gradient-to-r from-[#ff5555] via-[#f0b90b] to-[#ff5555]'} animate-pulse`} />
              <div className="p-3 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${outcomePopup.outcome === 'win' ? 'bg-[#00b97a]/20 text-[#00b97a]' : 'bg-[#ff5555]/20 text-[#ff5555]'}`}>
                  {outcomePopup.outcome === 'win' ? <Check className="w-5 h-5" strokeWidth={3} /> : <X className="w-5 h-5" strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-white/40 leading-none">
                    {outcomePopup.outcome === 'win' ? 'You won' : 'You lost'}
                  </div>
                  <div className={`text-lg font-extrabold leading-tight ${outcomePopup.outcome === 'win' ? 'text-[#00b97a]' : 'text-[#ff5555]'}`}>
                    {outcomePopup.outcome === 'win' ? '+' : ''}${outcomePopup.pnl?.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-white/50 truncate">
                    {outcomePopup.asset} · {outcomePopup.direction.toUpperCase()} · ${outcomePopup.amount}
                  </div>
                </div>
                <button onClick={() => setOutcomePopup(null)} className="w-7 h-7 rounded-md hover:bg-white/5 flex items-center justify-center shrink-0">
                  <X className="w-4 h-4 text-white/40" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaderboard side panel (mobile drawer) */}
      <Sheet open={leaderboardOpen} onOpenChange={setLeaderboardOpen}>
        <SheetContent side="left" className="bg-[#0a0d12] border-white/5 text-white w-[90vw] max-w-[380px] p-0">
          <SheetTitle className="sr-only">Leaderboard</SheetTitle>
          <div className="p-4 border-b border-white/5">
            <h2 className="text-lg font-bold flex items-center gap-2"><Trophy className="w-5 h-5 text-[#f0b90b]" /> Top Traders</h2>
            <p className="text-xs text-white/50 mt-1">Live leaderboard · top 10 by total profit</p>
          </div>
          <div className="p-3">
            <Leaderboard />
          </div>
        </SheetContent>
      </Sheet>

      {/* ===================== Admin Announcement popup ===================== */}
      <Dialog open={!!announcement} onOpenChange={(o) => !o && dismissAnnouncement()}>
        <DialogContent className="bg-[#0a0d12] border border-[#1a8eff]/40 max-w-md p-0 overflow-hidden">
          <DialogTitle className="sr-only">Announcement</DialogTitle>
          {announcement && (
            <div>
              <div className="h-1 bg-gradient-to-r from-[#1a8eff] via-[#22d3ee] to-[#00b97a] animate-pulse" />
              <div className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-[#1a8eff]/15 flex items-center justify-center shrink-0">
                    <Megaphone className="w-5 h-5 text-[#1a8eff]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-[#1a8eff] font-bold">Announcement</div>
                    <h3 className="text-base font-bold mt-0.5">{announcement.title}</h3>
                  </div>
                </div>
                <div className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed mb-4">
                  {announcement.message}
                </div>
                {announcement.expiresAt && (
                  <div className="text-[10px] text-white/40 mb-3">
                    Active until {new Date(announcement.expiresAt).toLocaleString()}
                  </div>
                )}
                <Button onClick={dismissAnnouncement} className="w-full bg-[#1a8eff] hover:bg-[#1278e6] font-bold">
                  Got it
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Deposit/Withdrawal modals */}
      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawalModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} user={user} onUserUpdate={(u) => { setUser(u); setStoredUser(u); }} />

      {/* History side panel */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="bg-[#0a0d12] border-white/5 text-white w-[90vw] max-w-[420px]">
          <SheetTitle className="text-white">Trade History</SheetTitle>
          <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(100vh-100px)] scrollbar-thin pr-2">
            {history.length === 0 ? (
              <div className="text-white/40 text-sm py-12 text-center">No trade history yet.</div>
            ) : history.map(t => (
              <div key={t.id} className="bg-[#11161e] border border-white/5 rounded-lg p-3 text-xs">
                <div className="flex justify-between mb-1">
                  <span className="font-bold">{t.asset}</span>
                  <span className={`font-bold ${t.outcome === 'win' ? 'text-[#00b97a]' : 'text-[#ff5555]'}`}>{t.outcome?.toUpperCase()} {t.outcome === 'win' ? '+' : ''}${t.pnl?.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-white/50">
                  <div>{t.direction === 'up' ? '▲ UP' : '▼ DOWN'}</div>
                  <div>${t.amount}</div>
                  <div>{new Date(t.openedAt).toLocaleTimeString()}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1 font-mono text-[10px] text-white/60">
                  <div>Entry {Number(t.entryPrice).toFixed(5)}</div>
                  <div>Close {Number(t.closePrice || 0).toFixed(5)}</div>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Indicators side panel */}
      <Sheet open={indicatorsOpen} onOpenChange={setIndicatorsOpen}>
        <SheetContent side="left" className="bg-[#0a0d12] border-white/5 text-white w-[90vw] max-w-[360px]">
          <SheetTitle className="text-white">Technical Indicators</SheetTitle>
          <p className="text-xs text-white/50 mt-1 mb-4">Toggle indicators to overlay on the chart.</p>
          <div className="space-y-3">
            {[
              { k: 'rsi', label: 'RSI (14)', desc: 'Relative Strength Index, momentum oscillator' },
              { k: 'ema', label: 'EMA (20)', desc: 'Exponential Moving Average' },
              { k: 'bb', label: 'Bollinger Bands', desc: 'Volatility bands at 2σ' },
            ].map(it => (
              <div key={it.k} className="bg-[#11161e] border border-white/5 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{it.label}</div>
                  <div className="text-[10px] text-white/40">{it.desc}</div>
                </div>
                <Switch checked={ind[it.k]} onCheckedChange={(v) => setInd(s => ({ ...s, [it.k]: v }))} />
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-white/30 italic">Note: indicator visual overlays will render on the chart in a future update.</div>
        </SheetContent>
      </Sheet>

      {/* Settings panel */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="left" className="bg-[#0a0d12] border-white/5 text-white w-[90vw] max-w-[360px]">
          <SheetTitle className="text-white">Settings</SheetTitle>
          <div className="mt-4 space-y-3">
            <div className="bg-[#11161e] border border-white/5 rounded-lg p-3">
              <div className="text-sm font-medium mb-2">Account</div>
              <div className="text-xs text-white/50">Email: {user?.email}</div>
              <div className="text-xs text-white/50">Role: {user?.role}</div>
            </div>
            <div className="bg-[#11161e] border border-white/5 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Sound effects</div>
                  <div className="text-[10px] text-white/40">Play tick + outcome sounds</div>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
            <div className="bg-[#11161e] border border-white/5 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Notifications</div>
                  <div className="text-[10px] text-white/40">Show toast on trade open/close</div>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
            <Button onClick={async () => { try { const r = await api.resetDemo(); setUser(r.user); setStoredUser(r.user); toast.success('Demo balance reset'); } catch (e) { toast.error(e.message); } }} variant="outline" className="w-full bg-white/5 border-white/10 hover:bg-white/10">
              Reset demo balance to $10,000
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RailBtn({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`mx-2 flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
        active
          ? 'bg-[#00b97a]/15 text-[#00b97a] border border-[#00b97a]/20'
          : 'text-white/60 hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate flex-1 text-left">{label}</span>
      {badge > 0 && (
        <span className="px-1.5 h-4 min-w-[16px] rounded-full bg-[#ff5555] text-white text-[10px] font-bold flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

function ToolBtn({ icon: Icon, title, active, onClick }) {
  return (
    <button title={title} onClick={onClick} className={`w-8 h-8 rounded flex items-center justify-center transition ${active ? 'bg-[#1a8eff] text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
      <Icon className="w-4 h-4" />
    </button>
  );
}

function ActiveTradeCard({ trade: t, live, pct, index, isCurrent = true }) {
  const winning = (t.direction === 'up' && (live || 0) > t.entryPrice) || (t.direction === 'down' && (live || 0) < t.entryPrice);
  // Without a live price (other-asset trade) we can only show the stake exposure,
  // not a real-time PnL guess — show a neutral "—" instead.
  const hasLive = live !== null && live !== undefined && live > 0;
  const pnl = !hasLive ? 0 : (winning ? +(t.amount * pct).toFixed(2) : -t.amount);
  const remaining = Math.max(0, Math.ceil((new Date(t.expiresAt).getTime() - Date.now()) / 1000));
  const dirCls = t.direction === 'up' ? 'text-[#00b97a]' : 'text-[#ff5555]';
  const dirBg  = t.direction === 'up' ? 'bg-[#00b97a]/15' : 'bg-[#ff5555]/15';
  return (
    <div
      className={`bg-[#11161e] border rounded-lg p-3 transition ${isCurrent ? 'border-white/10' : 'border-white/5 opacity-90'}`}
      data-testid={`active-trade-card-${t.id}`}
    >
      <div className="flex justify-between items-center text-xs mb-2">
        <div className="flex items-center gap-1.5">
          {typeof index === 'number' && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[#f0b90b]/20 text-[#f0b90b] text-[10px] font-extrabold" data-testid={`active-trade-index-${t.id}`}>
              #{index}
            </span>
          )}
          <span className="text-white/50 uppercase text-[10px] tracking-wider">{isCurrent ? 'Live' : 'Other pair'}</span>
        </div>
        <span className={`font-bold ${dirCls}`}>
          {t.direction === 'up' ? '▲ UP' : '▼ DOWN'} · {t.asset}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <div className="text-[10px] text-white/40 uppercase">Stake</div>
          <div className="font-bold">${t.amount}</div>
        </div>
        <div>
          <div className="text-[10px] text-white/40 uppercase">Entry</div>
          <div className="font-mono text-[11px]">{Number(t.entryPrice).toFixed(5)}</div>
        </div>
        <div>
          <div className="text-[10px] text-white/40 uppercase">Time left</div>
          <div className="font-bold text-[#f0b90b]">{remaining}s</div>
        </div>
      </div>
      <div className={`flex items-center justify-between rounded-md px-2 py-1.5 ${hasLive ? dirBg : 'bg-white/5'}`}>
        <span className={`text-xs ${hasLive ? dirCls : 'text-white/40'}`}>P/L</span>
        <span className={`font-extrabold ${hasLive ? dirCls : 'text-white/40'}`}>
          {hasLive ? `${winning ? '+' : ''}$${pnl.toFixed(2)}` : '—'}
        </span>
      </div>
    </div>
  );
}

function MobileActiveTrade({ trade: t, live, pct }) {
  const winning = (t.direction === 'up' && (live || 0) > t.entryPrice) || (t.direction === 'down' && (live || 0) < t.entryPrice);
  const pnl = winning ? +(t.amount * pct).toFixed(2) : -t.amount;
  const remaining = Math.max(0, Math.ceil((new Date(t.expiresAt).getTime() - Date.now()) / 1000));
  return (
    <div>
      <div className="flex items-center justify-between text-[9px] uppercase text-white/40 mb-1">
        <span>{t.direction === 'up' ? '▲' : '▼'} {t.asset}</span>
        <span className="text-[#f0b90b] font-bold">{remaining}s</span>
      </div>
      <div className={`font-bold text-sm ${winning ? 'text-[#00b97a]' : 'text-[#ff5555]'}`}>
        {winning ? '+' : ''}${pnl.toFixed(2)}
      </div>
    </div>
  );
}

function TradeRow({ t, live, pct = 0.85, active }) {
  const winning = active
    ? (t.direction === 'up' && (live || 0) > t.entryPrice) || (t.direction === 'down' && (live || 0) < t.entryPrice)
    : t.outcome === 'win';
  const pnlNow = active ? (winning ? +(t.amount * pct).toFixed(2) : -t.amount) : t.pnl;
  const remaining = active ? Math.max(0, Math.ceil((new Date(t.expiresAt).getTime() - Date.now()) / 1000)) : 0;
  return (
    <div className="bg-[#11161e] border border-white/5 rounded-lg p-3 text-xs">
      <div className="flex justify-between items-start mb-1">
        <div className="font-bold">{t.asset}</div>
        <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.direction === 'up' ? 'bg-[#00b97a]/20 text-[#00b97a]' : 'bg-[#ff5555]/20 text-[#ff5555]'}`}>
          {t.direction === 'up' ? '▲' : '▼'} {t.direction.toUpperCase()}
        </div>
      </div>
      <div className="flex justify-between text-white/50 mb-1">
        <span>${t.amount}</span>
        {active ? <span className="text-[#f0b90b] font-mono">{remaining}s</span> : <span>{t.outcome?.toUpperCase()}</span>}
      </div>
      <div className={`flex justify-between text-sm font-bold ${winning ? 'text-[#00b97a]' : 'text-[#ff5555]'}`}>
        <span>P/L</span>
        <span>{winning ? '+' : ''}${pnlNow?.toFixed?.(2) ?? '0.00'}</span>
      </div>
    </div>
  );
}
