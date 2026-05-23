'use client';
import { useEffect, useState } from 'react';
import { Trophy, Medal, Crown, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

// Returns the time remaining (string) until the next UTC midnight.
function nextResetCountdown() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  const ms = next - now;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

// Top 10 traders by today's P&L on LIVE-account closed trades.
// The list resets at 00:00 UTC (server enforces the cutoff).
// Auto-refreshes every 10 s.
export default function Leaderboard({ compact = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetIn, setResetIn] = useState(nextResetCountdown());

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await api.leaderboard();
        if (!stop) { setRows(r.leaderboard || []); setLoading(false); }
      } catch { if (!stop) setLoading(false); }
    };
    tick();
    const id = setInterval(tick, 10_000);
    const cd = setInterval(() => setResetIn(nextResetCountdown()), 60_000);
    return () => { stop = true; clearInterval(id); clearInterval(cd); };
  }, []);

  return (
    <div className="bg-[#11161e] border border-white/5 rounded-xl overflow-hidden" data-testid="leaderboard">
      <div className={`flex items-center gap-2 px-3 ${compact ? 'py-2' : 'py-3'} border-b border-white/5 bg-gradient-to-r from-[#f0b90b]/10 via-transparent to-transparent`}>
        <Trophy className="w-4 h-4 text-[#f0b90b]" />
        <div className="flex-1">
          <div className="text-xs font-bold uppercase tracking-wider">Top Traders</div>
          {!compact && (
            <div className="text-[10px] text-white/40 flex items-center gap-1.5" data-testid="leaderboard-subtitle">
              <span>Today · Live · top 10</span>
              <span className="text-white/20">•</span>
              <span title="Resets daily at 00:00 UTC">resets in {resetIn}</span>
            </div>
          )}
        </div>
        {loading && <RefreshCw className="w-3 h-3 text-white/30 animate-spin" />}
      </div>
      <div className={compact ? 'max-h-[260px] overflow-y-auto scrollbar-thin' : 'max-h-[420px] overflow-y-auto scrollbar-thin'}>
        {rows.length === 0 ? (
          <div className="p-6 text-center text-xs text-white/40" data-testid="leaderboard-empty">
            {loading
              ? 'Loading…'
              : 'No live-account trades closed today yet. Switch to Live, place a trade, and lead the board!'}
          </div>
        ) : rows.map((r) => (
          <div key={r.rank} className={`flex items-center gap-2 px-3 py-2 border-b border-white/[0.03] last:border-b-0 ${r.isMe ? 'bg-[#00b97a]/10' : 'hover:bg-white/[0.02]'}`}>
            <RankBadge rank={r.rank} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate flex items-center gap-1.5">
                <span className="truncate" title={r.name}>{r.name}</span>
                {r.userId && (
                  <span className="text-[9px] font-mono text-white/40 shrink-0" data-testid="leaderboard-user-id">{r.userId}</span>
                )}
                {r.isMe && <span className="text-[8px] px-1 py-0.5 bg-[#00b97a] text-white rounded uppercase shrink-0">You</span>}
              </div>
              <div className="text-[10px] text-white/40">
                {r.wins}W · {r.losses}L · {r.trades} trades
              </div>
            </div>
            <div className={`text-xs font-bold font-mono ${r.totalPnl >= 0 ? 'text-[#00b97a]' : 'text-[#ff5555]'}`}>
              {r.totalPnl >= 0 ? '+' : ''}${r.totalPnl.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankBadge({ rank }) {
  if (rank === 1) return <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#f0b90b] to-[#a87a04] flex items-center justify-center shrink-0"><Crown className="w-3.5 h-3.5 text-white" /></div>;
  if (rank === 2) return <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#c0c0c0] to-[#7f7f7f] flex items-center justify-center shrink-0"><Medal className="w-3 h-3 text-white" /></div>;
  if (rank === 3) return <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#cd7f32] to-[#8b5a2b] flex items-center justify-center shrink-0"><Medal className="w-3 h-3 text-white" /></div>;
  return <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0 text-[10px] font-bold text-white/60">{rank}</div>;
}
