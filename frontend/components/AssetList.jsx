'use client';
import { useMemo } from 'react';
import { Search, Zap, Globe } from 'lucide-react';

/**
 * AssetList — top-level component (do NOT nest inside render, that unmounts
 * it on every state change and forces users to click twice).
 *
 * Props:
 *  - assets:        full list from /api/assets
 *  - assetTab:      'otc' | 'live'
 *  - setAssetTab:   setter for tab
 *  - search:        search string
 *  - setSearch:     setter
 *  - onPick:        (asset) => void  — invoked when user picks an asset
 *  - mobileFull:    boolean — use full-height panel on mobile sheet
 */
export default function AssetList({
  assets,
  assetTab,
  setAssetTab,
  search,
  setSearch,
  onPick,
  mobileFull = false,
}) {
  const filteredOTC = useMemo(
    () => (assets || []).filter(a => a.kind === 'otc').filter(a =>
      !search ||
      a.display.toLowerCase().includes(search.toLowerCase()) ||
      a.symbol.toLowerCase().includes(search.toLowerCase())
    ),
    [assets, search]
  );
  const filteredLive = useMemo(
    () => (assets || []).filter(a => a.kind === 'live').filter(a =>
      !search ||
      a.display.toLowerCase().includes(search.toLowerCase()) ||
      a.name.toLowerCase().includes(search.toLowerCase())
    ),
    [assets, search]
  );

  const list = assetTab === 'otc' ? filteredOTC : filteredLive;

  return (
    <div className="flex flex-col h-full" data-testid="asset-list">
      <div className="flex border-b border-white/5 shrink-0">
        <button
          type="button"
          data-testid="asset-tab-otc"
          onClick={() => setAssetTab('otc')}
          className={`flex-1 px-4 py-2.5 text-xs font-bold uppercase ${
            assetTab === 'otc'
              ? 'text-[#00b97a] border-b-2 border-[#00b97a]'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          <Zap className="w-3 h-3 inline mr-1" /> OTC
        </button>
        <button
          type="button"
          data-testid="asset-tab-live"
          onClick={() => setAssetTab('live')}
          className={`flex-1 px-4 py-2.5 text-xs font-bold uppercase ${
            assetTab === 'live'
              ? 'text-[#ff5555] border-b-2 border-[#ff5555]'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          <Globe className="w-3 h-3 inline mr-1" /> LIVE MARKET
        </button>
      </div>

      <div className="p-2 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 bg-[#0c1015] border border-white/5 rounded px-2 py-1.5">
          <Search className="w-3.5 h-3.5 text-white/30" />
          <input
            data-testid="asset-search-input"
            placeholder="Search asset..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent flex-1 text-xs outline-none text-white/80"
          />
        </div>
      </div>

      <div
        className={`${mobileFull ? 'flex-1 min-h-0' : 'max-h-[480px]'} overflow-y-auto scrollbar-thin overscroll-contain`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {list.length === 0 && (
          <div className="text-center text-xs text-white/40 py-6" data-testid="asset-empty">
            No assets match "{search}"
          </div>
        )}
        {list.map(a => (
          <button
            type="button"
            key={a.symbol}
            data-testid={`asset-row-${a.symbol}`}
            onClick={() => onPick(a)}
            className="w-full flex justify-between items-center px-3 py-2.5 hover:bg-white/5 border-b border-white/[0.03] text-left"
          >
            <div>
              <div className="text-sm font-semibold">{a.display}</div>
              <div className="text-[10px] text-white/40">{a.name}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono">
                {a.price ? Number(a.price).toFixed(a.decimals) : '...'}
              </div>
              <div className="text-[10px] text-[#f0b90b] font-bold">
                {Math.round(a.payout * 100)}%
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
