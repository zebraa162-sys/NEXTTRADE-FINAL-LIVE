'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, RefreshCw, Loader2, TrendingUp, TrendingDown, Activity,
  CheckCircle2, XCircle, Clock, Filter, BarChart3
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import QuotexLogo from '@/components/QuotexLogo';
import { api, getStoredUser } from '@/lib/api';
import { toast } from 'sonner';

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function StatusBadge({ trade }) {
  if (trade.status === 'open') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#22d3ee]/15 text-[#22d3ee]">
        <Clock className="w-3 h-3" /> Live
      </span>
    );
  }
  if (trade.outcome === 'win') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#00b97a]/15 text-[#00b97a]">
        <CheckCircle2 className="w-3 h-3" /> Win
      </span>
    );
  }
  if (trade.outcome === 'loss') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#ff5555]/15 text-[#ff5555]">
        <XCircle className="w-3 h-3" /> Loss
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white/10 text-white/50">
      Closed
    </span>
  );
}

export default function TradesHistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trades, setTrades] = useState([]);
  const [filter, setFilter] = useState('all'); // all | open | closed | win | loss

  const load = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const r = await api.myTrades('all');
      setTrades(r.trades || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load trades');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) { router.push('/login'); return; }
    setUser(stored);
    load();
    const id = setInterval(() => load(false), 5000); // light auto-refresh for live trades
    return () => clearInterval(id);
  }, [router]);

  const filtered = useMemo(() => {
    let arr = trades;
    if (filter === 'open') arr = arr.filter(t => t.status === 'open');
    else if (filter === 'closed') arr = arr.filter(t => t.status === 'closed');
    else if (filter === 'win') arr = arr.filter(t => t.outcome === 'win');
    else if (filter === 'loss') arr = arr.filter(t => t.outcome === 'loss');
    return arr;
  }, [trades, filter]);

  const stats = useMemo(() => {
    const closed = trades.filter(t => t.status === 'closed');
    const wins = closed.filter(t => t.outcome === 'win').length;
    const losses = closed.filter(t => t.outcome === 'loss').length;
    const totalPnl = closed.reduce((acc, t) => acc + Number(t.pnl || 0), 0);
    const open = trades.filter(t => t.status === 'open').length;
    const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
    return { wins, losses, totalPnl, open, winRate, total: closed.length + open };
  }, [trades]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c1015] flex items-center justify-center text-white/60">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading trades…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c1015] text-white" data-testid="trades-history-page">
      <header className="border-b border-white/5 bg-[#0c1015]/90 sticky top-0 z-10 backdrop-blur">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/trade" data-testid="trades-back-to-trade" className="flex items-center gap-2 text-white/70 hover:text-white text-sm">
              <ArrowLeft className="w-4 h-4" /> Back to trade
            </Link>
            <div className="hidden md:block h-5 w-px bg-white/10" />
            <Link href="/" className="hidden md:block"><QuotexLogo compact /></Link>
          </div>
          <Button onClick={() => load(true)} variant="ghost" size="sm" disabled={refreshing} data-testid="trades-refresh-btn" className="text-white/70 hover:text-white">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#22d3ee]/15 border border-[#22d3ee]/30 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-[#22d3ee]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">My Trades</h1>
            <p className="text-sm text-white/50">Last {trades.length || 0} trades — auto-refreshes every 5s.</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <Stat label="Open" value={stats.open} accent="text-[#22d3ee]" testid="trades-stat-open" />
          <Stat label="Wins" value={stats.wins} accent="text-[#00b97a]" testid="trades-stat-wins" />
          <Stat label="Losses" value={stats.losses} accent="text-[#ff5555]" testid="trades-stat-losses" />
          <Stat label="Win rate" value={`${stats.winRate}%`} accent="text-white" testid="trades-stat-winrate" />
          <Stat
            label="Net P&L"
            value={`${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(2)}`}
            accent={stats.totalPnl >= 0 ? 'text-[#00b97a]' : 'text-[#ff5555]'}
            testid="trades-stat-pnl"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-white/40" />
          <FilterPill label="All" active={filter === 'all'} onClick={() => setFilter('all')} testid="trades-filter-all" />
          <FilterPill label="Open" active={filter === 'open'} onClick={() => setFilter('open')} testid="trades-filter-open" />
          <FilterPill label="Closed" active={filter === 'closed'} onClick={() => setFilter('closed')} testid="trades-filter-closed" />
          <FilterPill label="Wins" active={filter === 'win'} onClick={() => setFilter('win')} testid="trades-filter-win" />
          <FilterPill label="Losses" active={filter === 'loss'} onClick={() => setFilter('loss')} testid="trades-filter-loss" />
        </div>

        {/* Trade list */}
        {filtered.length === 0 ? (
          <Card className="bg-[#11161e] border-white/5 p-10 text-center text-white/50" data-testid="trades-empty">
            <Activity className="w-8 h-8 mx-auto mb-2 text-white/20" />
            <div className="text-sm">No trades match this filter.</div>
            <Link href="/trade" className="text-xs text-[#00b97a] mt-2 inline-block hover:underline">
              Open your first trade →
            </Link>
          </Card>
        ) : (
          <div className="bg-[#11161e] border border-white/5 rounded-lg overflow-hidden" data-testid="trades-list">
            {/* Table header (desktop) */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.2fr] gap-3 px-4 py-2.5 bg-[#0c1015] border-b border-white/5 text-[10px] uppercase font-bold text-white/40 tracking-wider">
              <div>Asset · Direction</div>
              <div className="text-right">Amount</div>
              <div className="text-right">Open Price</div>
              <div className="text-right">Close Price</div>
              <div className="text-right">P&L</div>
              <div>Status</div>
              <div>Opened</div>
            </div>
            {filtered.map(t => <TradeRow key={t.id} t={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent, testid }) {
  return (
    <div className="bg-[#11161e] border border-white/5 rounded-xl p-3" data-testid={testid}>
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className={`mt-0.5 text-lg font-bold ${accent || 'text-white'}`}>{value}</div>
    </div>
  );
}

function FilterPill({ label, active, onClick, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
        active ? 'bg-[#00b97a] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
}

function TradeRow({ t }) {
  const isUp = t.direction === 'up';
  const Dir = isUp ? TrendingUp : TrendingDown;
  const pnl = Number(t.pnl || 0);
  return (
    <div
      className="grid grid-cols-[1fr_1fr_1fr] md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1.2fr] gap-3 px-4 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] text-sm"
      data-testid={`trades-row-${t.id}`}
    >
      <div className="col-span-2 md:col-span-1 flex items-center gap-2">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${isUp ? 'bg-[#00b97a]/15 text-[#00b97a]' : 'bg-[#ff5555]/15 text-[#ff5555]'}`}>
          <Dir className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="font-bold text-sm">{t.asset?.replace('_LIVE', '') || '—'}</div>
          <div className="text-[10px] text-white/40 uppercase">{t.direction} · {t.durationSec}s · {t.account}</div>
        </div>
      </div>
      <div className="text-right md:text-right text-sm font-mono">${Number(t.amount || 0).toFixed(2)}</div>
      <div className="hidden md:block text-right text-xs font-mono text-white/70">{t.openPrice ? Number(t.openPrice).toFixed(5) : '—'}</div>
      <div className="hidden md:block text-right text-xs font-mono text-white/70">{t.closePrice ? Number(t.closePrice).toFixed(5) : '—'}</div>
      <div className={`text-right text-sm font-mono font-bold ${pnl > 0 ? 'text-[#00b97a]' : pnl < 0 ? 'text-[#ff5555]' : 'text-white/40'}`}>
        {t.status === 'open' ? '—' : `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`}
      </div>
      <div><StatusBadge trade={t} /></div>
      <div className="hidden md:block text-[11px] text-white/50">{fmtDate(t.openedAt)}</div>
    </div>
  );
}
