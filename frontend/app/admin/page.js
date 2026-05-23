'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Activity, Target, Check, X, RefreshCw, TrendingUp, TrendingDown,
  LogOut, Zap, BarChart3, Wallet, ArrowDownToLine, Megaphone, MessageSquare,
  LayoutDashboard, Globe, Shield, ChevronDown, ChevronRight, Bell, Cpu,
  TrendingDown as Down, TrendingUp as Up, Power, Rocket, GaugeCircle,
  LifeBuoy, Send, ArrowLeft, Loader2, Lock, Unlock, Inbox, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import TradingLiteLogo from '@/components/TradingLiteLogo';
import { api, getStoredUser, setStoredUser, setToken } from '@/lib/api';
import { toast } from 'sonner';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users',     label: 'Users',     icon: Users },
  { id: 'markets',   label: 'Markets',   icon: Globe },
  { id: 'deposits',  label: 'Deposits',  icon: Wallet },
  { id: 'withdrawals', label: 'Withdrawals', icon: ArrowDownToLine },
  { id: 'trades',    label: 'Trades',    icon: Activity },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'support',   label: 'Support',   icon: LifeBuoy },
];

const PATTERN_PRESETS = [
  { id: 'RANDOM', label: 'Random', icon: X },
  { id: 'WWL',    label: '2W -> 1L', icon: BarChart3 },
  { id: 'WLL',    label: '1W -> 2L', icon: Activity },
  { id: 'CUSTOM', label: 'Custom',   icon: Cpu },
];

export default function AdminPanel() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [users, setUsers] = useState([]);
  const [openTrades, setOpenTrades] = useState([]);
  const [closedTrades, setClosedTrades] = useState([]);
  const [pendingDeposits, setPendingDeposits] = useState([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState([]);
  const [stats, setStats] = useState({});
  const [settings, setSettings] = useState({
    winRatio: 0.5, payoutRate: 1.85, manipulationEnabled: true,
    bigWinInjection: false, dailyProfitTarget: 0, safetyNet: 5,
    tradePattern: 'RANDOM', minDeposit: 10, minWithdrawal: 10,
  });
  const [customPattern, setCustomPattern] = useState('WWL');
  const [navOpen, setNavOpen] = useState(false);
  const [supportUnread, setSupportUnread] = useState(0);

  useEffect(() => {
    const u = getStoredUser();
    if (!u) { router.push('/login'); return; }
    if (u.role !== 'admin') { router.push('/trade'); return; }
    setUser(u);
  }, [router]);

  const refresh = async () => {
    try {
      const [a, b, c, s, st, dep, wd, su] = await Promise.all([
        api.adminUsers(),
        api.adminTrades('open'),
        api.adminTrades('closed'),
        api.getSettings(),
        api.adminStats(),
        api.adminDeposits('pending'),
        api.adminWithdrawals('pending'),
        api.adminUnreadSupport().catch(() => ({ unread: 0 })),
      ]);
      setUsers(a.users || []);
      setOpenTrades(b.trades || []);
      setClosedTrades((c.trades || []).slice(0, 50));
      const sx = s.settings || {};
      setSettings(prev => ({ ...prev, ...sx }));
      setStats(st || {});
      setPendingDeposits(dep.deposits || []);
      setPendingWithdrawals(wd.withdrawals || []);
      setSupportUnread(su?.unread || 0);
    } catch (e) { /* silent */ }
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [user]);

  const saveSettings = async (next) => {
    try {
      const r = await api.setSettings(next);
      setSettings(prev => ({ ...prev, ...(r.settings || {}) }));
      toast.success('Settings updated');
    } catch (e) { toast.error(e.message); }
  };

  const force = async (id, outcome) => {
    try {
      await api.forceTrade(id, outcome);
      toast.success(outcome ? `Trade marked as FORCE ${outcome.toUpperCase()}` : 'Override removed');
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  const adjustBalance = async (uid, account, delta) => {
    try { await api.adminBalance(uid, account, delta); toast.success('Balance adjusted'); refresh(); }
    catch (e) { toast.error(e.message); }
  };
  const handleDeposit = async (id, action) => {
    try { if (action === 'approve') await api.approveDeposit(id); else await api.rejectDeposit(id); toast.success(`Deposit ${action}d`); refresh(); }
    catch (e) { toast.error(e.message); }
  };
  const handleWithdrawal = async (id, action) => {
    try { if (action === 'approve') await api.approveWithdrawal(id); else await api.rejectWithdrawal(id); toast.success(`Withdrawal ${action}d`); refresh(); }
    catch (e) { toast.error(e.message); }
  };
  const logout = () => { setToken(null); setStoredUser(null); router.push('/login'); };

  const houseEdge = Math.round((1 - (settings.winRatio ?? 0.5)) * 100);
  const winPct = Math.round((settings.winRatio ?? 0.5) * 100);

  // Map mode buttons -> winRatio values
  const setMode = (mode) => {
    let winRatio;
    if (mode === 'lose') winRatio = 0.0;
    else if (mode === 'win') winRatio = 1.0;
    else if (mode === 'stabilize') winRatio = 0.5;
    saveSettings({ winRatio });
  };

  const currentMode = settings.winRatio === 0
    ? 'lose'
    : settings.winRatio === 1
      ? 'win'
      : settings.winRatio === 0.5
        ? 'stabilize'
        : 'manual';

  return (
    <div className="min-h-screen bg-[#0c1015] text-white flex">
      {/* ==================== Sidebar ==================== */}
      <aside className={`fixed md:static z-40 inset-y-0 left-0 w-60 bg-[#0a0d12] border-r border-white/5 flex flex-col transition-transform ${navOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between">
            <TradingLiteLogo compact />
            <button className="md:hidden text-white/60" onClick={() => setNavOpen(false)}><X className="w-4 h-4" /></button>
          </div>
          <div className="mt-2 text-[10px] text-white/40 uppercase tracking-wider">NEXT-TRADEX v1.0</div>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-thin">
          {NAV_ITEMS.map(it => (
            <button
              key={it.id}
              onClick={() => { setView(it.id); setNavOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                view === it.id ? 'bg-[#1a8eff]/15 text-[#1a8eff] border border-[#1a8eff]/30' : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <it.icon className="w-4 h-4 shrink-0" />
              <span>{it.label}</span>
              {it.id === 'deposits' && pendingDeposits.length > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full bg-[#f0b90b] text-black text-[10px] font-bold">{pendingDeposits.length}</span>
              )}
              {it.id === 'withdrawals' && pendingWithdrawals.length > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full bg-[#ff5555] text-white text-[10px] font-bold">{pendingWithdrawals.length}</span>
              )}
              {it.id === 'support' && supportUnread > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full bg-[#ff5555] text-white text-[10px] font-bold">{supportUnread}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t border-white/5 space-y-1">
          <button onClick={() => router.push('/trade')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white">
            <ChevronRight className="w-4 h-4" /> Trading Room
          </button>
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#ff5555] hover:bg-[#ff5555]/10">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>
      {navOpen && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setNavOpen(false)} />}

      {/* ==================== Main column ==================== */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="h-14 sticky top-0 z-20 bg-[#0a0d12]/85 backdrop-blur border-b border-white/5 flex items-center justify-between px-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setNavOpen(true)} className="md:hidden text-white/60 hover:text-white">
              <LayoutDashboard className="w-5 h-5" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold capitalize truncate">{view === 'dashboard' ? 'Dashboard Overview' : view}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={refresh} className="text-white/60 hover:text-white"><RefreshCw className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="text-white/60 hover:text-white relative">
              <Bell className="w-5 h-5" />
              {(pendingDeposits.length + pendingWithdrawals.length) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#ff5555] text-[10px] font-bold flex items-center justify-center">
                  {pendingDeposits.length + pendingWithdrawals.length}
                </span>
              )}
            </Button>
            <div className="hidden sm:flex items-center gap-2 bg-[#11161e] border border-white/10 rounded-full px-3 py-1.5">
              <div className="w-6 h-6 rounded-full bg-[#00b97a]/20 flex items-center justify-center">
                <Shield className="w-3 h-3 text-[#00b97a]" />
              </div>
              <div className="text-xs">
                <div className="font-bold leading-none">Super Admin</div>
                <div className="text-[10px] text-white/40 mt-0.5">{user?.email}</div>
              </div>
            </div>
          </div>
        </header>

        {/* View body */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {view === 'dashboard' && (
            <DashboardView
              stats={stats}
              settings={settings}
              setSettings={setSettings}
              saveSettings={saveSettings}
              setMode={setMode}
              currentMode={currentMode}
              winPct={winPct}
              houseEdge={houseEdge}
              customPattern={customPattern}
              setCustomPattern={setCustomPattern}
            />
          )}
          {view === 'users' && (
            <UsersView users={users} adjustBalance={adjustBalance} />
          )}
          {view === 'deposits' && (
            <PaymentsView type="deposit" pendingCount={pendingDeposits.length} onAction={handleDeposit} />
          )}
          {view === 'withdrawals' && (
            <PaymentsView type="withdrawal" pendingCount={pendingWithdrawals.length} onAction={handleWithdrawal} />
          )}
          {view === 'trades' && (
            <TradesView openTrades={openTrades} closedTrades={closedTrades} onForce={force} />
          )}
          {view === 'markets' && <MarketsView />}
          {view === 'announcements' && <AnnouncementsView />}
          {view === 'support' && <SupportView onRefreshCount={refresh} />}
        </div>
      </main>
    </div>
  );
}

/* ==================== Views ==================== */

// Standalone component for the payout multiplier so the input owns its own
// "raw typing" string and the user can freely type values like `1.`, `1.2`,
// `1.45`, etc. without React forcing the value back to an integer on every
// keystroke. We only coerce to a number on blur (and clamp it to 1.0–5.0).
function PayoutMultiplierField({ value, onChange }) {
  const [draft, setDraft] = useState(() => Number(value).toFixed(2));

  // Sync from parent when settings refresh from the server, but never while
  // the user is actively typing into this field.
  useEffect(() => {
    const isFocused = typeof document !== 'undefined'
      && document.activeElement?.dataset?.testid === 'admin-payout-multiplier-input';
    if (isFocused) return;
    setDraft(Number(value).toFixed(2));
  }, [value]);

  const commit = () => {
    const n = parseFloat(draft);
    const clamped = Number.isFinite(n) && n >= 1 && n <= 5 ? n : 1.85;
    setDraft(clamped.toFixed(2));
    if (clamped !== Number(value)) onChange(clamped);
  };

  return (
    <div className="flex items-center gap-2 bg-[#0c1015] border border-white/10 rounded-md px-2 py-1" data-testid="admin-payout-multiplier-row">
      <span className="uppercase">Payout multiplier:</span>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => {
          // Accept any partial decimal: '', '1', '1.', '1.2', '1.45', '.5'.
          // Strip non-digits / non-dots, then collapse extra dots.
          const v = e.target.value.replace(/[^0-9.]/g, '');
          const firstDot = v.indexOf('.');
          const fixed = firstDot === -1
            ? v
            : v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
          setDraft(fixed);
        }}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
        data-testid="admin-payout-multiplier-input"
        className="bg-transparent border-0 h-6 w-14 text-xs p-0 text-white font-bold text-center outline-none focus:text-[#00b97a] caret-[#00b97a]"
      />
      <span className="text-white/50 font-bold">x</span>
      <span className="text-white/30">(applies to all new trades)</span>
    </div>
  );
}

function DashboardView({ stats, settings, setSettings, saveSettings, setMode, currentMode, winPct, houseEdge, customPattern, setCustomPattern }) {
  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={Users} label="Total Users" value={stats.totalUsers || 0} color="#00b97a" />
        <KpiCard icon={Wallet} label="Total Deposit" value={`$${fmt(stats.totalDeposit)}`} color="#1a8eff" />
        <KpiCard icon={ArrowDownToLine} label="Total Withdraw" value={`$${fmt(stats.totalWithdraw)}`} color="#ff5555" />
        <KpiCard icon={GaugeCircle} label="Active Balance" value={`$${fmt(stats.activeBalance)}`} color="#22d3ee" />
        <KpiCard icon={TrendingUp} label="Total Profit" value={`${(stats.totalProfit ?? 0) >= 0 ? '+' : ''}$${fmt(stats.totalProfit)}`} color="#00b97a" />
      </div>

      {/* Live System Control Center */}
      <Section
        icon={Cpu}
        title="Live System Control Center"
        subtitle="Manipulate global win rates in real-time."
        right={
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-[#0c1015] border border-white/10 rounded-md px-2 py-1.5">
              <Shield className="w-3.5 h-3.5 text-[#00b97a]" />
              <span className="text-[10px] uppercase text-white/40">Safety Net: $</span>
              <Input
                type="number"
                value={settings.safetyNet ?? 5}
                onChange={(e) => setSettings(s => ({ ...s, safetyNet: Number(e.target.value) || 0 }))}
                onBlur={() => saveSettings({ safetyNet: settings.safetyNet })}
                className="bg-transparent border-0 h-6 w-12 text-xs p-0 text-white"
              />
            </div>
            <ManipulationToggle
              enabled={settings.manipulationEnabled !== false}
              onToggle={(v) => { setSettings(s => ({ ...s, manipulationEnabled: v })); saveSettings({ manipulationEnabled: v }); }}
            />
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <ModeButton
            color="#ff5555"
            active={currentMode === 'lose'}
            disabled={settings.manipulationEnabled === false}
            onClick={() => setMode('lose')}
            icon={Down}
            label="Lose Mode"
            desc="Force users to lose"
          />
          <ModeButton
            color="#00b97a"
            active={currentMode === 'win'}
            disabled={settings.manipulationEnabled === false}
            onClick={() => setMode('win')}
            icon={Up}
            label="Win Mode"
            desc="Let users win"
          />
          <ModeButton
            color="#22d3ee"
            active={currentMode === 'stabilize'}
            disabled={settings.manipulationEnabled === false}
            onClick={() => setMode('stabilize')}
            icon={Shield}
            label="Stabilize"
            desc="50/50 fair odds"
          />
          {/* Manual control */}
          <div className={`bg-[#0c1015] border ${currentMode === 'manual' ? 'border-[#f0b90b]/60' : 'border-white/10'} rounded-xl p-4 ${settings.manipulationEnabled === false ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wider text-white/50 font-bold">Manual Control</div>
              <span className="text-xs font-bold text-[#f0b90b]">{winPct}%</span>
            </div>
            <Slider
              value={[winPct]}
              onValueChange={(v) => setSettings(s => ({ ...s, winRatio: v[0] / 100 }))}
              onValueCommit={(v) => saveSettings({ winRatio: v[0] / 100 })}
              min={0} max={100} step={1}
              className="my-3"
            />
            <Button onClick={() => saveSettings({ winRatio: settings.winRatio })} className="w-full h-8 bg-[#f0b90b] hover:bg-[#d9a609] text-black text-xs font-bold">
              Activate Rate
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/40">
          <span>House edge: <span className="text-white/70 font-bold">{houseEdge}%</span></span>
          <PayoutMultiplierField
            value={settings.payoutRate ?? 1.85}
            onChange={(n) => {
              setSettings(s => ({ ...s, payoutRate: n }));
              saveSettings({ payoutRate: n });
            }}
          />
        </div>
      </Section>

      {/* Trade Pattern Management */}
      <Section
        icon={Target}
        title="Trade Pattern Management"
        subtitle="Define specific sequences for trade outcomes (W=Win, L=Loss)."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold mb-2">Select Active Pattern</div>
            <div className="grid grid-cols-4 gap-2">
              {PATTERN_PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => saveSettings({ tradePattern: p.id })}
                  className={`p-3 rounded-lg border flex flex-col items-center gap-1 transition ${
                    settings.tradePattern === p.id
                      ? 'border-[#22d3ee] bg-[#22d3ee]/10 text-white'
                      : 'border-white/10 bg-[#0c1015] text-white/50 hover:text-white hover:border-white/30'
                  }`}
                >
                  <p.icon className="w-4 h-4" />
                  <span className="text-[10px] font-medium">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold mb-2">Custom Sequence Definition</div>
            <div className="flex items-center gap-2 bg-white rounded-lg p-1.5">
              <span className="text-black/50 text-xs px-2">⟨/⟩</span>
              <Input
                value={customPattern}
                onChange={(e) => setCustomPattern(e.target.value.toUpperCase().replace(/[^WL]/g, ''))}
                placeholder="WWL"
                className="border-0 bg-transparent text-black flex-1 h-7 px-1 focus-visible:ring-0"
              />
              <Button
                onClick={() => saveSettings({ tradePattern: customPattern || 'RANDOM' })}
                className="h-8 bg-[#1a8eff] hover:bg-[#1278e6] text-white px-4 text-xs font-bold"
              >
                Activate
              </Button>
            </div>
            <p className="text-[10px] text-white/40 mt-2 italic">
              ⓘ Use <span className="font-mono text-white/70">W</span> for Win and <span className="font-mono text-white/70">L</span> for Loss. Example: <span className="font-mono text-[#22d3ee]">WWL</span> = 2 wins followed by 1 loss.
            </p>
          </div>
        </div>
      </Section>

      {/* Big Win Injection + Daily Profit Target */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section icon={Rocket} title="Big Win Injection" subtitle="Recover user confidence after losses.">
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/50 max-w-[60%]">
              Periodically inject a guaranteed user win to keep engagement high after a streak of losses.
            </div>
            <Switch
              checked={!!settings.bigWinInjection}
              onCheckedChange={(v) => { setSettings(s => ({ ...s, bigWinInjection: v })); saveSettings({ bigWinInjection: v }); }}
            />
          </div>
        </Section>
        <Section icon={TrendingUp} title="Daily Profit Target" subtitle="Auto-adjust win rates to hit goals.">
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-sm">$</span>
            <Input
              type="number"
              value={settings.dailyProfitTarget ?? 0}
              onChange={(e) => setSettings(s => ({ ...s, dailyProfitTarget: Number(e.target.value) || 0 }))}
              className="bg-[#0c1015] border-white/10 h-9"
            />
            <Button onClick={() => saveSettings({ dailyProfitTarget: settings.dailyProfitTarget })} className="h-9 bg-[#00b97a] hover:bg-[#00a86d] text-xs font-bold">
              Save
            </Button>
          </div>
        </Section>
      </div>

      {/* Minimum deposit / withdrawal */}
      <Section icon={Wallet} title="Deposit & Withdrawal Limits" subtitle="Minimum amounts users can deposit or withdraw.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1.5">Min Deposit (USD)</div>
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-sm">$</span>
              <Input
                type="number"
                min={1}
                value={settings.minDeposit ?? 10}
                onChange={(e) => setSettings(s => ({ ...s, minDeposit: Number(e.target.value) || 0 }))}
                className="bg-[#0c1015] border-white/10 h-9"
              />
              <Button onClick={() => saveSettings({ minDeposit: settings.minDeposit })} className="h-9 bg-[#1a8eff] hover:bg-[#1278e6] text-xs font-bold px-4">Save</Button>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1.5">Min Withdrawal (USD)</div>
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-sm">$</span>
              <Input
                type="number"
                min={1}
                value={settings.minWithdrawal ?? 10}
                onChange={(e) => setSettings(s => ({ ...s, minWithdrawal: Number(e.target.value) || 0 }))}
                className="bg-[#0c1015] border-white/10 h-9"
              />
              <Button onClick={() => saveSettings({ minWithdrawal: settings.minWithdrawal })} className="h-9 bg-[#1a8eff] hover:bg-[#1278e6] text-xs font-bold px-4">Save</Button>
            </div>
          </div>
        </div>
      </Section>

      {/* Quick stats row */}
      <Section icon={Activity} title="Trading Activity" subtitle="Live pulse on platform performance.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Open trades" value={stats.openTrades || 0} color="#f0b90b" />
          <MiniStat label="Wins" value={stats.wins || 0} color="#00b97a" />
          <MiniStat label="Losses" value={stats.losses || 0} color="#ff5555" />
          <MiniStat label="Pending requests" value={(stats.pendingDeposits || 0) + (stats.pendingWithdrawals || 0)} color="#22d3ee" />
        </div>
      </Section>
    </div>
  );
}

function ManipulationToggle({ enabled, onToggle }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border ${enabled ? 'border-[#00b97a]/40 bg-[#00b97a]/10' : 'border-white/10 bg-[#0c1015]'}`}>
      <Power className={`w-3.5 h-3.5 ${enabled ? 'text-[#00b97a]' : 'text-white/40'}`} />
      <div className="text-xs leading-tight">
        <div className="font-bold uppercase tracking-wider">{enabled ? 'Win/Loss ON' : 'Natural'}</div>
        <div className="text-[9px] text-white/50">{enabled ? 'Admin rate active' : 'Pure market outcome'}</div>
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}

function ModeButton({ color, active, disabled, onClick, icon: Icon, label, desc }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative bg-[#0c1015] border rounded-xl p-4 text-left transition group ${
        active ? 'border-2 shadow-lg' : 'border-white/10 hover:border-white/30'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      style={active ? { borderColor: color, boxShadow: `0 0 0 1px ${color}55, 0 8px 24px ${color}33` } : {}}
    >
      <Icon className="w-6 h-6 mb-2" style={{ color }} />
      <div className="text-sm font-bold text-white">{label}</div>
      <div className="text-[10px] text-white/50 mt-1">{desc}</div>
      {active && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />
      )}
    </button>
  );
}

function KpiCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-[#11161e] border border-white/5 rounded-xl p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `${color}22` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <div className="text-[10px] uppercase tracking-wider text-white/50 font-medium">{label}</div>
      </div>
      <div className="text-xl sm:text-2xl font-extrabold" style={{ color }}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="bg-[#0c1015] rounded-lg border border-white/5 p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="text-xl font-bold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, right, children }) {
  return (
    <div className="bg-[#11161e] border border-white/5 rounded-xl p-4 sm:p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[#0c1015] flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-[#f0b90b]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base">{title}</div>
          {subtitle && <div className="text-xs text-white/50 mt-0.5">{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function SectionTitle({ title, count }) {
  return (
    <div className="flex items-center gap-2 text-sm font-bold mt-4 first:mt-0">
      <span>{title}</span>
      <span className="text-white/40 text-xs">({count})</span>
    </div>
  );
}

function PlaceholderView({ title, desc }) {
  return (
    <div className="bg-[#11161e] border border-white/5 rounded-xl p-12 text-center">
      <div className="text-2xl font-bold mb-2">{title}</div>
      <div className="text-sm text-white/50">{desc}</div>
    </div>
  );
}

function MarketsView() {
  const [assets, setAssets] = useState([]);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try { const r = await api.assets(); if (!stop) setAssets(r.assets || []); } catch {}
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => { stop = true; clearInterval(id); };
  }, []);
  return (
    <div className="bg-[#11161e] border border-white/5 rounded-xl p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#0a0d12] text-white/50 text-xs uppercase">
          <tr>
            <th className="text-left p-3">Symbol</th>
            <th className="text-left p-3">Display</th>
            <th className="text-left p-3">Kind</th>
            <th className="text-right p-3">Price</th>
            <th className="text-right p-3">Payout</th>
          </tr>
        </thead>
        <tbody>
          {assets.map(a => (
            <tr key={a.symbol} className="border-t border-white/5">
              <td className="p-3 font-mono">{a.symbol}</td>
              <td className="p-3 font-bold">{a.display}</td>
              <td className="p-3">
                <Badge className={a.kind === 'live' ? 'bg-[#ff5555]/20 text-[#ff5555]' : 'bg-[#00b97a]/20 text-[#00b97a]'}>{a.kind?.toUpperCase()}</Badge>
              </td>
              <td className="p-3 text-right font-mono">{a.price ? Number(a.price).toFixed(a.decimals) : '...'}</td>
              <td className="p-3 text-right font-bold text-[#f0b90b]">{Math.round((a.payout || 0) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function shortId(uuid) {
  return (uuid || '').replace(/-/g, '').slice(-6).toUpperCase() || 'ANON';
}

function UsersView({ users, adjustBalance }) {
  const [q, setQ] = useState('');
  const filtered = users.filter(u => {
    if (!q) return true;
    const query = q.toLowerCase();
    return shortId(u.id).toLowerCase().includes(query)
      || (u.email || '').toLowerCase().includes(query)
      || (u.name || '').toLowerCase().includes(query)
      || (u.role || '').toLowerCase().includes(query);
  });
  const fmtDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' }); }
    catch { return '—'; }
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-[#11161e] border border-white/10 rounded-lg px-3 py-2 max-w-md flex-1 min-w-[240px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            placeholder="Search by name, email, user ID, or role..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-transparent flex-1 text-sm outline-none text-white placeholder:text-white/30"
            data-testid="admin-users-search"
          />
          {q && <button onClick={() => setQ('')} className="text-white/40 hover:text-white text-xs">Clear</button>}
        </div>
        <div className="text-xs text-white/40" data-testid="admin-users-count">
          Showing {filtered.length} of {users.length} users
        </div>
      </div>
      <div className="bg-[#11161e] border border-white/5 rounded-xl p-0 overflow-x-auto">
        <table className="w-full text-sm" data-testid="admin-users-table">
          <thead className="bg-[#0a0d12] text-white/50 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">User ID</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3 whitespace-nowrap">Joined</th>
              <th className="text-right p-3">Demo</th>
              <th className="text-right p-3">Live</th>
              <th className="text-right p-3">Active</th>
              <th className="text-right p-3">Adjust</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className="border-t border-white/5 hover:bg-white/[0.02]" data-testid={`admin-user-row-${shortId(u.id)}`}>
                <td className="p-3">
                  <div className="font-semibold text-white truncate max-w-[160px]" title={u.name || '—'}>{u.name || '—'}</div>
                </td>
                <td className="p-3 text-white/80 truncate max-w-[220px]" title={u.email}>{u.email}</td>
                <td className="p-3 font-mono text-xs text-white/60" title={u.id}>#{shortId(u.id)}</td>
                <td className="p-3">
                  <Badge className={u.role === 'admin' ? 'bg-[#ff5555]/20 text-[#ff5555]' : 'bg-white/5 text-white/70'}>{u.role}</Badge>
                </td>
                <td className="p-3 text-xs text-white/60 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                <td className="p-3 text-right font-mono">${u.demoBalance?.toFixed(2)}</td>
                <td className="p-3 text-right font-mono">${u.liveBalance?.toFixed(2)}</td>
                <td className="p-3 text-right text-xs text-white/50">{u.activeAccount}</td>
                <td className="p-3 text-right">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="outline" className="h-7 text-xs border-white/10" onClick={() => adjustBalance(u.id, 'live', 100)}>+$100</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs border-white/10" onClick={() => adjustBalance(u.id, 'live', -100)}>-$100</Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="p-8 text-center text-white/40 text-xs">No users match your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// PaymentsView wraps PaymentTable with a 3-tab status switcher (Pending /
// Approved / Rejected) and fetches the corresponding history slice from the
// admin API. Each row in approved/rejected views replaces the Approve/Reject
// buttons with a status pill + admin note + resolved-at timestamp, so the
// admin gets a complete audit trail per page.
function PaymentsView({ type, pendingCount, onAction }) {
  const [tab, setTab] = useState('pending'); // pending | approved | rejected
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = type === 'deposit'
          ? await api.adminDeposits(tab)
          : await api.adminWithdrawals(tab);
        if (cancelled) return;
        setItems(r.deposits || r.withdrawals || []);
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Failed to load history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [type, tab, refreshKey]);

  // After approve/reject, refresh both the current tab AND the parent's
  // pending counter (which is what the sidebar shows).
  const handleAction = async (id, action) => {
    await onAction(id, action);
    setRefreshKey(k => k + 1);
  };

  const stats = {
    pending: pendingCount ?? 0,
    approved: tab === 'approved' ? items.length : null,
    rejected: tab === 'rejected' ? items.length : null,
  };

  return (
    <div className="space-y-4" data-testid={`admin-${type}-view`}>
      <div className="flex flex-wrap items-center gap-2">
        <TabPill active={tab === 'pending'} onClick={() => setTab('pending')} count={stats.pending} testid={`admin-${type}-tab-pending`}>
          <Clock className="w-3 h-3 mr-1 inline" /> Pending
        </TabPill>
        <TabPill active={tab === 'approved'} onClick={() => setTab('approved')} count={tab === 'approved' ? items.length : undefined} testid={`admin-${type}-tab-approved`}>
          <Check className="w-3 h-3 mr-1 inline" /> Approved
        </TabPill>
        <TabPill active={tab === 'rejected'} onClick={() => setTab('rejected')} count={tab === 'rejected' ? items.length : undefined} testid={`admin-${type}-tab-rejected`}>
          <X className="w-3 h-3 mr-1 inline" /> Rejected
        </TabPill>
        <div className="flex-1" />
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="text-[11px] text-white/50 hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5"
          data-testid={`admin-${type}-refresh`}
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="bg-[#11161e] border border-white/5 rounded-xl p-12 text-center text-white/40 text-sm">Loading…</div>
      ) : (
        <PaymentTable items={items} type={type} onAction={handleAction} mode={tab} />
      )}
    </div>
  );
}

function TabPill({ children, active, onClick, count, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
        active ? 'bg-[#1a8eff] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
      }`}
    >
      {children}
      {typeof count === 'number' && (
        <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[9px] ${active ? 'bg-white/20' : 'bg-white/10'}`}>{count}</span>
      )}
    </button>
  );
}

function PaymentTable({ items, type, onAction, mode = 'pending' }) {
  if (!items?.length) {
    const label = mode === 'pending' ? `pending ${type} requests` : `${mode} ${type}s`;
    return <div className="bg-[#11161e] border border-white/5 rounded-xl p-12 text-center text-white/40 text-sm" data-testid={`admin-${type}-empty`}>No {label}.</div>;
  }
  return (
    <div className="space-y-3" data-testid={`admin-${type}-list`}>
      {items.map(it => {
        const data = it.methodData || {};
        const screenshot = data.screenshot;
        const isPending = it.status === 'pending';
        return (
          <div key={it.id} className="bg-[#11161e] border border-white/5 rounded-xl p-4 flex flex-col md:flex-row gap-4" data-testid={`admin-${type}-row-${it.id}`}>
            {screenshot && (
              <a href={screenshot} target="_blank" rel="noreferrer" className="shrink-0">
                <img src={screenshot} alt="Transaction screenshot" className="w-full md:w-32 h-32 object-cover rounded-lg border border-white/10 hover:border-[#1a8eff] transition" />
              </a>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-sm uppercase">{it.method}</div>
                    {!isPending && <PaymentStatusPill status={it.status} />}
                  </div>
                  <div className="text-[10px] text-white/40 font-mono">User #{shortId(it.userId)} · Requested {new Date(it.createdAt).toLocaleString()}</div>
                  {!isPending && it.resolvedAt && (
                    <div className="text-[10px] text-white/40 font-mono">Resolved {new Date(it.resolvedAt).toLocaleString()}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-lg font-extrabold font-mono ${type === 'deposit' ? 'text-[#00b97a]' : 'text-[#22d3ee]'}`}>
                    {type === 'deposit' ? '+' : '−'}${Number(it.amount).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-white/40">USD</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {Object.entries(data)
                  .filter(([k]) => k !== 'screenshot')
                  .map(([k, v]) => (
                    <div key={k} className="bg-[#0c1015] border border-white/5 rounded-md px-2.5 py-1.5">
                      <div className="text-[9px] uppercase tracking-wider text-white/40">{k.replace(/_/g, ' ')}</div>
                      <div className="text-xs font-mono break-all">{String(v)}</div>
                    </div>
                  ))}
              </div>
              {isPending ? (
                <div className="flex justify-end gap-2">
                  <Button size="sm" data-testid={`admin-${type}-approve-${it.id}`} className="h-8 px-3 text-xs bg-[#00b97a] hover:bg-[#00a86d]" onClick={() => onAction(it.id, 'approve')}>Approve</Button>
                  <Button size="sm" data-testid={`admin-${type}-reject-${it.id}`} className="h-8 px-3 text-xs bg-[#ff5555] hover:bg-[#ee4444]" onClick={() => onAction(it.id, 'reject')}>Reject</Button>
                </div>
              ) : (
                it.adminNote && (
                  <div className="bg-[#0c1015] border border-white/5 rounded-md px-3 py-2">
                    <div className="text-[9px] uppercase tracking-wider text-white/40">Admin note</div>
                    <div className="text-xs text-white/80">{it.adminNote}</div>
                  </div>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PaymentStatusPill({ status }) {
  const cfg = {
    approved: { label: 'Approved', cls: 'bg-[#00b97a]/15 text-[#00b97a]', Icon: Check },
    rejected: { label: 'Rejected', cls: 'bg-[#ff5555]/15 text-[#ff5555]', Icon: X },
    pending:  { label: 'Pending',  cls: 'bg-[#f0b90b]/15 text-[#f0b90b]', Icon: Clock },
  }[status] || { label: status, cls: 'bg-white/10 text-white/60', Icon: Clock };
  const I = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${cfg.cls}`}>
      <I className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

function TradesTable({ trades, onForce, live, closed }) {
  if (!trades?.length) {
    return <div className="bg-[#11161e] border border-white/5 rounded-xl p-12 text-center text-white/40 text-sm">No trades to show.</div>;
  }
  return (
    <div className="bg-[#11161e] border border-white/5 rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#0a0d12] text-white/50 text-xs uppercase">
          <tr>
            <th className="text-left p-3">User</th>
            <th className="text-left p-3">Asset</th>
            <th className="text-left p-3">Direction</th>
            <th className="text-right p-3">Stake</th>
            <th className="text-right p-3">Entry</th>
            {closed && <th className="text-right p-3">Close</th>}
            {live && <th className="text-right p-3">Expires</th>}
            {closed && <th className="text-right p-3">Result</th>}
            {closed && <th className="text-right p-3">P/L</th>}
            {live && <th className="text-right p-3">Override</th>}
            {live && <th className="text-right p-3">Force</th>}
          </tr>
        </thead>
        <tbody>
          {trades.map(t => {
            const remaining = Math.max(0, Math.ceil((new Date(t.expiresAt).getTime() - Date.now()) / 1000));
            return (
              <tr key={t.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="p-3 text-xs">{t.userEmail}</td>
                <td className="p-3 font-bold">{t.asset}</td>
                <td className="p-3">
                  {t.direction === 'up'
                    ? <span className="text-[#00b97a] font-bold flex items-center gap-1"><TrendingUp className="w-3 h-3" /> UP</span>
                    : <span className="text-[#ff5555] font-bold flex items-center gap-1"><TrendingDown className="w-3 h-3" /> DOWN</span>}
                </td>
                <td className="p-3 text-right font-mono">${t.amount}</td>
                <td className="p-3 text-right font-mono">{t.entryPrice?.toFixed?.(5)}</td>
                {closed && <td className="p-3 text-right font-mono">{t.closePrice?.toFixed?.(5)}</td>}
                {live && <td className="p-3 text-right text-[#f0b90b] font-mono">{remaining}s</td>}
                {closed && (
                  <td className="p-3 text-right">
                    <Badge className={t.outcome === 'win' ? 'bg-[#00b97a]/20 text-[#00b97a]' : 'bg-[#ff5555]/20 text-[#ff5555]'}>
                      {t.outcome?.toUpperCase()}
                      {t.wedgeApplied && <Zap className="w-3 h-3 ml-1" />}
                    </Badge>
                  </td>
                )}
                {closed && (
                  <td className={`p-3 text-right font-mono font-bold ${t.pnl >= 0 ? 'text-[#00b97a]' : 'text-[#ff5555]'}`}>
                    {t.pnl >= 0 ? '+' : ''}${t.pnl?.toFixed?.(2)}
                  </td>
                )}
                {live && (
                  <td className="p-3 text-right">
                    {t.forceOutcome ? (
                      <Badge className={t.forceOutcome === 'win' ? 'bg-[#00b97a]/20 text-[#00b97a]' : 'bg-[#ff5555]/20 text-[#ff5555]'}>
                        FORCE {t.forceOutcome.toUpperCase()}
                      </Badge>
                    ) : <span className="text-white/30 text-xs">none</span>}
                  </td>
                )}
                {live && (
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" className="h-7 px-2 text-xs bg-[#00b97a] hover:bg-[#00a86d]" onClick={() => onForce(t.id, 'win')}>WIN</Button>
                      <Button size="sm" className="h-7 px-2 text-xs bg-[#ff5555] hover:bg-[#ee4444]" onClick={() => onForce(t.id, 'loss')}>LOSS</Button>
                      {t.forceOutcome && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-white/10" onClick={() => onForce(t.id, '')}>
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TradesView({ openTrades, closedTrades, onForce }) {
  const [q, setQ] = useState('');
  const [range, setRange] = useState('daily'); // daily | weekly | monthly | yearly | all

  const now = Date.now();
  const cutoff = range === 'daily' ? now - 24 * 3600e3
    : range === 'weekly' ? now - 7 * 24 * 3600e3
    : range === 'monthly' ? now - 30 * 24 * 3600e3
    : range === 'yearly' ? now - 365 * 24 * 3600e3
    : 0;

  // Range-only filter (used for the summary stats so the count reflects the
  // selected window even when the search box is empty / non-empty).
  const inRange = (t) => {
    if (!cutoff) return true;
    const when = new Date(t.openedAt || t.resolvedAt || t.createdAt || 0).getTime();
    return when >= cutoff;
  };

  const filterRow = (t) => {
    if (!inRange(t)) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return shortId(t.userId).toLowerCase().includes(s)
      || (t.userEmail || '').toLowerCase().includes(s)
      || (t.asset || '').toLowerCase().includes(s)
      || (t.direction || '').toLowerCase().includes(s);
  };

  const openFiltered = openTrades.filter(filterRow);
  const closedFiltered = closedTrades.filter(filterRow);

  // Summary stats — always computed against the SELECTED RANGE (search box
  // ignored) so admins always see "X trades today / this week / ..." totals
  // at the top of the page regardless of any text filter.
  const summary = useMemo(() => {
    const openInRange   = openTrades.filter(inRange);
    const closedInRange = closedTrades.filter(inRange);
    const wins   = closedInRange.filter(t => t.outcome === 'win').length;
    const losses = closedInRange.filter(t => t.outcome === 'loss').length;
    const volume = [...openInRange, ...closedInRange]
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const netPnl = closedInRange.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0);
    const winRate = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
    return {
      total:  openInRange.length + closedInRange.length,
      open:   openInRange.length,
      closed: closedInRange.length,
      wins,
      losses,
      volume,
      netPnl,
      winRate,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTrades, closedTrades, range]);

  const rangeLabel = {
    daily: 'Today', weekly: 'This week', monthly: 'This month',
    yearly: 'This year', all: 'All time',
  }[range];

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-2 bg-[#11161e] border border-white/10 rounded-lg px-3 py-2 flex-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            placeholder="Search by user ID, email, asset, direction..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-transparent flex-1 text-sm outline-none text-white placeholder:text-white/30"
          />
          {q && <button onClick={() => setQ('')} className="text-white/40 hover:text-white text-xs">Clear</button>}
        </div>
        <div className="flex items-center gap-1 bg-[#11161e] border border-white/10 rounded-lg p-1" data-testid="admin-trades-range-selector">
          {[
            { v: 'daily',   l: 'Daily' },
            { v: 'weekly',  l: 'Weekly' },
            { v: 'monthly', l: 'Monthly' },
            { v: 'yearly',  l: 'Yearly' },
            { v: 'all',     l: 'All time' },
          ].map(opt => (
            <button
              key={opt.v}
              onClick={() => setRange(opt.v)}
              data-testid={`admin-trades-range-${opt.v}`}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${range === opt.v ? 'bg-[#1a8eff] text-white' : 'text-white/50 hover:text-white'}`}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards — total / open / closed / wins / losses / volume / net P&L
          for the selected time window (search box does NOT affect these). */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2" data-testid="admin-trades-summary">
        <SummaryCard label={`Total · ${rangeLabel}`} value={summary.total}                      accent="text-white"        big testid="admin-trades-summary-total" />
        <SummaryCard label="Open"                    value={summary.open}                       accent="text-[#22d3ee]"    testid="admin-trades-summary-open" />
        <SummaryCard label="Closed"                  value={summary.closed}                     accent="text-white/80"     testid="admin-trades-summary-closed" />
        <SummaryCard label="Wins"                    value={summary.wins}                       accent="text-[#00b97a]"    testid="admin-trades-summary-wins" />
        <SummaryCard label="Losses"                  value={summary.losses}                     accent="text-[#ff5555]"    testid="admin-trades-summary-losses" />
        <SummaryCard label="Win rate"                value={`${summary.winRate}%`}              accent="text-[#f0b90b]"    testid="admin-trades-summary-winrate" />
        <SummaryCard label="Volume"                  value={`$${fmt(summary.volume)}`}          accent="text-white"        testid="admin-trades-summary-volume" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-2 -mt-2">
        <div className="lg:col-span-7">
          <SummaryCard
            label={`House net P&L · ${rangeLabel}`}
            value={`${summary.netPnl <= 0 ? '+' : '-'}$${fmt(Math.abs(summary.netPnl))}`}
            // House gains when traders LOSE → trader pnl is negative → house +.
            accent={summary.netPnl <= 0 ? 'text-[#00b97a]' : 'text-[#ff5555]'}
            big
            testid="admin-trades-summary-house-pnl"
          />
        </div>
      </div>

      <SectionTitle title="Open Trades" count={openFiltered.length} />
      <TradesTable trades={openFiltered} onForce={onForce} live />
      <SectionTitle title="Recent History" count={closedFiltered.length} />
      <TradesTable trades={closedFiltered} closed />
    </div>
  );
}

function SummaryCard({ label, value, accent = 'text-white', big = false, testid }) {
  return (
    <div className="bg-[#11161e] border border-white/5 rounded-lg p-3" data-testid={testid}>
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className={`mt-1 font-bold ${big ? 'text-2xl' : 'text-lg'} ${accent}`}>{value}</div>
    </div>
  );
}

function fmt(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function AnnouncementsView() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try { const r = await api.adminAnnouncements(); setItems(r.announcements || []); } catch {}
  };
  useEffect(() => { refresh(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) { toast.error('Title and message required'); return; }
    setBusy(true);
    try {
      await api.createAnnouncement({
        title: title.trim(),
        message: message.trim(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      toast.success('Announcement posted — visible to all users');
      setTitle(''); setMessage(''); setExpiresAt('');
      refresh();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const toggle = async (it) => {
    try {
      await api.updateAnnouncement(it.id, { active: !it.active });
      toast.success(`Announcement ${it.active ? 'deactivated' : 'reactivated'}`);
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (id) => {
    try { await api.deleteAnnouncement(id); toast.success('Announcement deleted'); refresh(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4 max-w-[1100px]">
      {/* Composer */}
      <div className="bg-[#11161e] border border-white/5 rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#1a8eff]/15 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-[#1a8eff]" />
          </div>
          <div>
            <div className="text-base font-bold">Broadcast Announcement</div>
            <div className="text-xs text-white/50">Pops up for every user the next time they open the app. Stays active until you deactivate or it expires.</div>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Maintenance window — Saturday 02:00 UTC" className="bg-[#0c1015] border-white/10 mt-1" maxLength={120} />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Detailed message visible to all users..."
              rows={4}
              maxLength={2000}
              className="w-full mt-1 bg-[#0c1015] border border-white/10 rounded-md p-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#1a8eff]/60"
            />
            <div className="text-[10px] text-white/40 text-right mt-1">{message.length}/2000</div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Expires at (optional)</label>
            <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="bg-[#0c1015] border-white/10 mt-1" />
            <div className="text-[10px] text-white/40 mt-1">Leave empty to keep active until you manually deactivate.</div>
          </div>
          <Button type="submit" disabled={busy} className="bg-[#1a8eff] hover:bg-[#1278e6] font-bold">
            <Megaphone className="w-4 h-4 mr-2" /> {busy ? 'Posting…' : 'Post Announcement'}
          </Button>
        </form>
      </div>

      {/* Existing list */}
      <div className="bg-[#11161e] border border-white/5 rounded-xl">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold">All Announcements</div>
            <div className="text-xs text-white/50">{items.length} total · {items.filter(i => i.active && (!i.expiresAt || new Date(i.expiresAt) > new Date())).length} live</div>
          </div>
          <Button variant="ghost" size="sm" onClick={refresh}><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {items.length === 0 ? (
            <div className="p-12 text-center text-white/40 text-sm">No announcements yet — broadcast your first one above.</div>
          ) : items.map(it => {
            const expired = it.expiresAt && new Date(it.expiresAt) < new Date();
            const live = it.active && !expired;
            return (
              <div key={it.id} className="p-4 flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${live ? 'bg-[#00b97a] animate-pulse' : 'bg-white/30'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-bold text-sm">{it.title}</div>
                    {live && <Badge className="bg-[#00b97a]/20 text-[#00b97a] text-[10px]">LIVE</Badge>}
                    {expired && <Badge className="bg-white/10 text-white/50 text-[10px]">EXPIRED</Badge>}
                    {!it.active && !expired && <Badge className="bg-[#f0b90b]/20 text-[#f0b90b] text-[10px]">PAUSED</Badge>}
                  </div>
                  <div className="text-xs text-white/60 mt-1 whitespace-pre-wrap">{it.message}</div>
                  <div className="text-[10px] text-white/40 mt-2">
                    Posted {new Date(it.createdAt).toLocaleString()}
                    {it.expiresAt && ` · expires ${new Date(it.expiresAt).toLocaleString()}`}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-xs border-white/10" onClick={() => toggle(it)}>
                    {it.active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button size="sm" className="h-7 text-xs bg-[#ff5555] hover:bg-[#ee4444]" onClick={() => remove(it.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


/* ==================== Admin Support View ==================== */
function SupportView({ onRefreshCount }) {
  const [tickets, setTickets] = useState([]);
  const [active, setActive] = useState(null);
  const [filter, setFilter] = useState('all'); // all | open | closed
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  const load = async () => {
    try {
      const r = await api.adminListTickets(filter);
      setTickets(r.tickets || []);
    } catch (e) { /* silent */ }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [filter]);

  // Poll active ticket for new user messages
  useEffect(() => {
    if (!active?.id) return;
    let stop = false;
    const poll = async () => {
      if (stop) return;
      try {
        const r = await api.getTicket(active.id);
        if (!stop && r.ticket) setActive(r.ticket);
      } catch {}
    };
    const id = setInterval(poll, 3000);
    return () => { stop = true; clearInterval(id); };
  }, [active?.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [active?.messages?.length]);

  const openTicket = async (id) => {
    try {
      const r = await api.getTicket(id);
      setActive(r.ticket);
      load();
      onRefreshCount?.();
    } catch (e) { toast.error(e.message); }
  };

  const sendReply = async () => {
    const t = reply.trim();
    if (!t || !active) return;
    setSending(true);
    try {
      const r = await api.postTicketMessage(active.id, t);
      setActive(r.ticket);
      setReply('');
      load();
    } catch (e) { toast.error(e.message); }
    setSending(false);
  };

  const toggleStatus = async () => {
    if (!active) return;
    const next = active.status === 'open' ? 'closed' : 'open';
    try {
      const r = await api.adminSetTicketStatus(active.id, next);
      setActive(r.ticket);
      load();
      toast.success(`Ticket ${next}`);
    } catch (e) { toast.error(e.message); }
  };

  const fmtTime = (d) => {
    const t = new Date(d); const now = new Date();
    const sameDay = t.toDateString() === now.toDateString();
    return sameDay ? t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : t.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-[1400px] h-[calc(100vh-8rem)] flex flex-col">
      {/* Filters */}
      <div className="flex items-center gap-2 mb-3">
        {['all', 'open', 'closed'].map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setActive(null); }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase ${
              filter === f ? 'bg-[#1a8eff] text-white' : 'bg-[#11161e] border border-white/10 text-white/60 hover:bg-white/5'
            }`}
          >
            {f}
          </button>
        ))}
        <div className="ml-auto text-xs text-white/50">
          <Inbox className="w-3.5 h-3.5 inline mr-1" />
          {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-3">
        {/* List */}
        <div className={`${active ? 'hidden lg:flex' : 'flex'} flex-col bg-[#0a0d12] border border-white/5 rounded-lg overflow-hidden min-h-0`}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-white/40 text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <Inbox className="w-10 h-10 text-white/20 mb-3" />
              <div className="text-sm font-semibold text-white/60">No tickets</div>
              <div className="text-xs text-white/40 mt-1">Try a different filter.</div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {tickets.map(t => (
                <button
                  key={t.id}
                  onClick={() => openTicket(t.id)}
                  className={`w-full text-left px-3 py-3 border-b border-white/[0.04] hover:bg-white/5 transition ${active?.id === t.id ? 'bg-[#1a8eff]/10' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate flex-1">{t.subject}</span>
                        {t.status === 'closed' && <Badge className="bg-white/10 text-white/60 text-[9px]">CLOSED</Badge>}
                      </div>
                      <div className="text-[10px] text-white/40 mt-0.5">
                        {t.userEmail} · #{(t.userId || '').slice(-6).toUpperCase()}
                      </div>
                      <div className="text-xs text-white/50 truncate mt-1">
                        {t.lastSender === 'admin' ? 'You: ' : '👤 User: '}{t.lastMessage}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-white/40">{fmtTime(t.lastMessageAt)}</span>
                      {t.unreadForAdmin > 0 && (
                        <span className="px-1.5 h-4 min-w-[16px] rounded-full bg-[#ff5555] text-white text-[10px] font-bold flex items-center justify-center">{t.unreadForAdmin}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conversation */}
        <div className={`${active ? 'flex' : 'hidden lg:flex'} flex-col bg-[#0a0d12] border border-white/5 rounded-lg overflow-hidden min-h-0`}>
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <MessageSquare className="w-10 h-10 text-[#1a8eff]/60 mb-3" />
              <div className="text-base font-semibold">Select a ticket</div>
              <div className="text-xs text-white/40 mt-1">Pick a ticket from the list to reply.</div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="h-14 border-b border-white/5 flex items-center justify-between px-3 shrink-0 bg-[#0c1015]">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setActive(null)} className="lg:hidden w-8 h-8 rounded-md hover:bg-white/5 flex items-center justify-center">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{active.subject}</div>
                    <div className="flex items-center gap-2 text-[10px] text-white/40 mt-0.5">
                      <span>{active.userEmail}</span>
                      <span>·</span>
                      <Clock className="w-3 h-3" />
                      <span>{fmtTime(active.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={toggleStatus}
                  className={`h-8 text-xs border-white/10 ${active.status === 'open' ? 'text-[#ff5555] hover:bg-[#ff5555]/10' : 'text-[#00b97a] hover:bg-[#00b97a]/10'}`}
                >
                  {active.status === 'open' ? (<><Lock className="w-3.5 h-3.5 mr-1" /> Close</>) : (<><Unlock className="w-3.5 h-3.5 mr-1" /> Reopen</>)}
                </Button>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-3 sm:p-4 space-y-2 min-h-0">
                {(active.messages || []).map(m => {
                  const isAdmin = m.sender === 'admin';
                  return (
                    <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
                        isAdmin ? 'bg-[#1a8eff]/20 border border-[#1a8eff]/30' : 'bg-[#11161e] border border-white/10'
                      }`}>
                        <div className={`text-[10px] uppercase tracking-wider mb-0.5 font-semibold ${isAdmin ? 'text-[#1a8eff]' : 'text-[#00b97a]'}`}>
                          {isAdmin ? 'You (Admin)' : 'User'}
                        </div>
                        <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>
                        <div className="text-[10px] text-white/40 mt-1 text-right">{fmtTime(m.createdAt)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply */}
              <div className="border-t border-white/5 p-2 sm:p-3 bg-[#0c1015] shrink-0">
                {active.status === 'closed' ? (
                  <div className="flex items-center gap-2 text-xs text-white/50 bg-white/5 rounded-md p-3 justify-center">
                    Ticket is closed. Reopen to reply.
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <textarea
                      rows={1}
                      placeholder="Type your reply..."
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                      className="flex-1 resize-none bg-[#11161e] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#1a8eff]/50 max-h-32 min-h-[38px]"
                    />
                    <Button onClick={sendReply} disabled={sending || !reply.trim()} className="bg-[#1a8eff] hover:bg-[#1278e6] h-10 px-4">
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
