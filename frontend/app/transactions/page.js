'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Wallet, ArrowDownToLine, RefreshCw, Loader2, CheckCircle2,
  XCircle, Clock, Receipt, ChevronDown, ChevronUp, Filter
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import QuotexLogo from '@/components/QuotexLogo';
import { api, getStoredUser, setStoredUser, setToken } from '@/lib/api';
import { toast } from 'sonner';

const STATUS_STYLES = {
  approved: { label: 'Approved', cls: 'bg-[#00b97a]/15 text-[#00b97a]', icon: CheckCircle2 },
  pending:  { label: 'Pending',  cls: 'bg-[#f0b90b]/15 text-[#f0b90b]', icon: Clock },
  rejected: { label: 'Rejected', cls: 'bg-[#ff5555]/15 text-[#ff5555]', icon: XCircle },
};

function StatusPill({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${s.cls}`} data-testid={`tx-status-${status}`}>
      <Icon className="w-3 h-3" /> {s.label}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TransactionsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [filter, setFilter] = useState('all'); // all | deposits | withdrawals
  const [statusFilter, setStatusFilter] = useState('all'); // all | approved | pending | rejected

  const load = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [d, w] = await Promise.all([api.myDeposits(), api.myWithdrawals()]);
      setDeposits(d.deposits || []);
      setWithdrawals(w.withdrawals || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load transactions');
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
  }, [router]);

  // Combined timeline (newest first)
  const items = useMemo(() => {
    const dep = (deposits || []).map(d => ({
      kind: 'deposit',
      id: d.id,
      amount: d.amount,
      method: d.method,
      methodData: d.methodData,
      status: d.status,
      createdAt: d.createdAt,
      resolvedAt: d.resolvedAt,
      adminNote: d.adminNote,
    }));
    const wd = (withdrawals || []).map(w => ({
      kind: 'withdrawal',
      id: w.id,
      amount: w.amount,
      method: w.method,
      methodData: w.methodData,
      status: w.status,
      createdAt: w.createdAt,
      resolvedAt: w.resolvedAt,
      adminNote: w.adminNote,
    }));
    let merged = [...dep, ...wd];
    if (filter === 'deposits') merged = dep;
    if (filter === 'withdrawals') merged = wd;
    if (statusFilter !== 'all') merged = merged.filter(x => x.status === statusFilter);
    return merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [deposits, withdrawals, filter, statusFilter]);

  // Aggregate stats
  const totals = useMemo(() => {
    const acc = { depApproved: 0, wdApproved: 0, depPending: 0, wdPending: 0 };
    for (const d of deposits) {
      if (d.status === 'approved') acc.depApproved += Number(d.amount || 0);
      if (d.status === 'pending') acc.depPending += Number(d.amount || 0);
    }
    for (const w of withdrawals) {
      if (w.status === 'approved') acc.wdApproved += Number(w.amount || 0);
      if (w.status === 'pending') acc.wdPending += Number(w.amount || 0);
    }
    return acc;
  }, [deposits, withdrawals]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c1015] flex items-center justify-center text-white/60">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading transactions…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c1015] text-white" data-testid="transactions-page">
      <header className="border-b border-white/5 bg-[#0c1015]/90 sticky top-0 z-10 backdrop-blur">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/trade" data-testid="tx-back-to-trade" className="flex items-center gap-2 text-white/70 hover:text-white text-sm">
              <ArrowLeft className="w-4 h-4" /> Back to trade
            </Link>
            <div className="hidden md:block h-5 w-px bg-white/10" />
            <Link href="/" className="hidden md:block"><QuotexLogo compact /></Link>
          </div>
          <Button onClick={() => load(true)} variant="ghost" size="sm" disabled={refreshing} data-testid="tx-refresh-btn" className="text-white/70 hover:text-white">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#00b97a]/15 border border-[#00b97a]/30 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-[#00b97a]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Transactions</h1>
            <p className="text-sm text-white/50">All your deposits and withdrawals.</p>
          </div>
        </div>

        {/* Aggregate cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Stat icon={Wallet} label="Total deposited" value={`$${totals.depApproved.toFixed(2)}`} accent="text-[#00b97a]" testid="tx-total-deposited" />
          <Stat icon={ArrowDownToLine} label="Total withdrawn" value={`$${totals.wdApproved.toFixed(2)}`} accent="text-white" testid="tx-total-withdrawn" />
          <Stat icon={Clock} label="Deposits pending" value={`$${totals.depPending.toFixed(2)}`} accent="text-[#f0b90b]" testid="tx-deposits-pending" />
          <Stat icon={Clock} label="Withdrawals pending" value={`$${totals.wdPending.toFixed(2)}`} accent="text-[#f0b90b]" testid="tx-withdrawals-pending" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-white/40" />
          <FilterPill label="All" active={filter === 'all'} onClick={() => setFilter('all')} testid="tx-filter-all" />
          <FilterPill label="Deposits" active={filter === 'deposits'} onClick={() => setFilter('deposits')} testid="tx-filter-deposits" />
          <FilterPill label="Withdrawals" active={filter === 'withdrawals'} onClick={() => setFilter('withdrawals')} testid="tx-filter-withdrawals" />
          <div className="hidden sm:block h-5 w-px bg-white/10 mx-1" />
          <FilterPill label="Any status" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} testid="tx-status-all" />
          <FilterPill label="Approved" active={statusFilter === 'approved'} onClick={() => setStatusFilter('approved')} testid="tx-status-approved-filter" />
          <FilterPill label="Pending" active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} testid="tx-status-pending-filter" />
          <FilterPill label="Rejected" active={statusFilter === 'rejected'} onClick={() => setStatusFilter('rejected')} testid="tx-status-rejected-filter" />
        </div>

        {/* List */}
        {items.length === 0 ? (
          <Card className="bg-[#11161e] border-white/5 p-10 text-center text-white/50" data-testid="tx-empty">
            <Receipt className="w-8 h-8 mx-auto mb-2 text-white/20" />
            <div className="text-sm">No transactions yet.</div>
            <Link href="/trade" className="text-xs text-[#00b97a] mt-2 inline-block hover:underline">
              Make your first deposit →
            </Link>
          </Card>
        ) : (
          <div className="space-y-2" data-testid="tx-list">
            {items.map(t => <TxRow key={`${t.kind}-${t.id}`} t={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent = 'text-white', testid }) {
  return (
    <div className="bg-[#11161e] border border-white/5 rounded-xl p-4" data-testid={testid}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/40">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className={`mt-1 text-lg font-bold ${accent}`}>{value}</div>
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

function TxRow({ t }) {
  const [expanded, setExpanded] = useState(false);
  const isDeposit = t.kind === 'deposit';
  return (
    <div
      className={`bg-[#11161e] border border-white/5 rounded-lg overflow-hidden ${expanded ? 'ring-1 ring-[#00b97a]/30' : ''}`}
      data-testid={`tx-row-${t.id}`}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] text-left"
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDeposit ? 'bg-[#00b97a]/15 text-[#00b97a]' : 'bg-[#22d3ee]/15 text-[#22d3ee]'}`}>
          {isDeposit ? <Wallet className="w-4 h-4" /> : <ArrowDownToLine className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold capitalize">{t.kind}</span>
            <StatusPill status={t.status} />
            <span className="text-[11px] text-white/40">via {String(t.method || '—').toUpperCase()}</span>
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">{fmtDate(t.createdAt)}</div>
        </div>
        <div className={`text-base font-mono font-bold ${isDeposit ? 'text-[#00b97a]' : 'text-white'}`}>
          {isDeposit ? '+' : '-'}${Number(t.amount || 0).toFixed(2)}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>
      {expanded && (
        <div className="border-t border-white/5 bg-[#0c1015] px-4 py-3 text-xs space-y-3" data-testid={`tx-row-detail-${t.id}`}>
          <Detail label="Reference" value={t.id} mono />
          <MethodDetailsBlock data={t.methodData} />
          <Detail label="Resolved at" value={fmtDate(t.resolvedAt)} />
          {t.adminNote && <Detail label="Admin note" value={<span className="text-white/80">{t.adminNote}</span>} />}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono = false }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-32 shrink-0 text-white/40 uppercase tracking-wide text-[10px] pt-0.5">{label}</div>
      <div className={`flex-1 ${mono ? 'font-mono text-[11px] text-white/70 break-all' : 'text-white/80'}`}>{value}</div>
    </div>
  );
}

// Pretty-renders the per-transaction `methodData` blob.
//   - data:image/* values are shown as a small image thumbnail with a
//     "View full size" link instead of dumping a 200KB base64 string.
//   - All other values are shown as readable label/value rows.
//   - Recognises common keys from the deposit modal (binance_id, tx_hash,
//     recipient, screenshot, etc.) and prints nicely cased labels.
function MethodDetailsBlock({ data }) {
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    return <Detail label="Method details" value="—" />;
  }

  const labelFor = (key) => {
    const map = {
      binance_id: 'Binance ID',
      tx_hash: 'Tx Hash',
      recipient: 'Recipient',
      screenshot: 'Proof Screenshot',
      address: 'Wallet Address',
      network: 'Network',
      memo: 'Memo / Tag',
      account: 'Account #',
      ifsc: 'IFSC',
      upi: 'UPI ID',
      email: 'Email',
      note: 'Note',
    };
    return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="space-y-2" data-testid="tx-method-details">
      <div className="text-white/40 uppercase tracking-wide text-[10px]">Method details</div>
      <div className="space-y-2 pl-1">
        {Object.entries(data).map(([k, v]) => (
          <MethodRow key={k} label={labelFor(k)} fieldKey={k} value={v} />
        ))}
      </div>
    </div>
  );
}

function MethodRow({ label, fieldKey, value }) {
  // Image-as-data-url: don't blast the base64 onto the screen.
  const isDataUrl = typeof value === 'string' && /^data:image\//i.test(value);
  if (isDataUrl) {
    return (
      <div className="flex items-start gap-3" data-testid={`tx-method-row-${fieldKey}`}>
        <div className="w-32 shrink-0 text-white/40 uppercase tracking-wide text-[10px] pt-1">{label}</div>
        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <a href={value} target="_blank" rel="noopener noreferrer" className="block" data-testid={`tx-method-image-${fieldKey}`}>
            <img
              src={value}
              alt={label}
              className="max-h-32 rounded border border-white/10 hover:border-[#00b97a]/60 transition cursor-zoom-in object-contain bg-[#11161e]"
            />
          </a>
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#00b97a] hover:underline"
          >
            View full size →
          </a>
        </div>
      </div>
    );
  }

  // Plain http(s) URL → render as a link.
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
    return (
      <div className="flex items-start gap-3" data-testid={`tx-method-row-${fieldKey}`}>
        <div className="w-32 shrink-0 text-white/40 uppercase tracking-wide text-[10px] pt-0.5">{label}</div>
        <a href={value} target="_blank" rel="noopener noreferrer" className="flex-1 text-[#00b97a] hover:underline break-all text-[11px]">{value}</a>
      </div>
    );
  }

  // Nested object — fall back to a compact JSON pre.
  if (value && typeof value === 'object') {
    return (
      <div className="flex items-start gap-3" data-testid={`tx-method-row-${fieldKey}`}>
        <div className="w-32 shrink-0 text-white/40 uppercase tracking-wide text-[10px] pt-0.5">{label}</div>
        <pre className="flex-1 text-[11px] font-mono whitespace-pre-wrap break-all text-white/70 m-0">{JSON.stringify(value, null, 2)}</pre>
      </div>
    );
  }

  // Anything else — string / number / bool.
  return (
    <div className="flex items-start gap-3" data-testid={`tx-method-row-${fieldKey}`}>
      <div className="w-32 shrink-0 text-white/40 uppercase tracking-wide text-[10px] pt-0.5">{label}</div>
      <div className="flex-1 font-mono text-[11px] text-white/80 break-all">{String(value ?? '—')}</div>
    </div>
  );
}
