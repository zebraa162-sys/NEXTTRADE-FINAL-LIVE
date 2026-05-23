'use client';

// Professional brand mark for NEXTTRADX.
//   Icon : Geometric hexagonal tile with a stylised "N + arrow" mark
//          composed of two rising candlestick pillars and an upward slash
//          that reads as both an "N" and a bullish trend.
//   Word : "NEXT" in soft white, "TRADX" in brand-green. Inter ExtraBold,
//          tight tracking, small caps feel — clean fintech typography.
export default function NextTradxLogo({ className = '', compact = false, iconOnly = false }) {
  const tileSize = compact ? 28 : 36;
  const txtSize = compact ? 'text-sm' : 'text-xl';

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <BrandMark size={tileSize} />
      {!iconOnly && (
        <div className={`font-extrabold tracking-tight ${txtSize} flex items-baseline leading-none`}>
          <span className="text-white">NEXT</span>
          <span className="ml-0.5 text-[#00b97a]">TRADX</span>
        </div>
      )}
    </div>
  );
}

export function BrandMark({ size = 36 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-label="NEXTTRADX"
    >
      <defs>
        <linearGradient id="ntx-tile" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f1a24" />
          <stop offset="100%" stopColor="#060a0f" />
        </linearGradient>
        <linearGradient id="ntx-green" x1="0" y1="40" x2="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00855a" />
          <stop offset="100%" stopColor="#00e692" />
        </linearGradient>
        <linearGradient id="ntx-slash" x1="8" y1="30" x2="32" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#00e692" />
        </linearGradient>
        <filter id="ntx-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.9" />
        </filter>
      </defs>

      {/* Hexagonal tile (rounded) — fintech signature shape */}
      <path
        d="M20 2 L35.5 10 L35.5 30 L20 38 L4.5 30 L4.5 10 Z"
        fill="url(#ntx-tile)"
        stroke="#00b97a"
        strokeOpacity="0.45"
        strokeWidth="0.8"
      />

      {/* Left vertical pillar (N left stroke) + small wick */}
      <line x1="12" y1="6" x2="12" y2="34" stroke="#2b3a4c" strokeWidth="0.8" strokeLinecap="round" />
      <rect x="10.8" y="13" width="2.4" height="14" rx="0.6" fill="url(#ntx-green)" />

      {/* Right vertical pillar (N right stroke) — taller = progression */}
      <line x1="28" y1="4" x2="28" y2="36" stroke="#2b3a4c" strokeWidth="0.8" strokeLinecap="round" />
      <rect x="26.8" y="9" width="2.4" height="18" rx="0.6" fill="url(#ntx-green)" />

      {/* Diagonal — forms the "N" bar AND an upward arrow (bullish) */}
      <path
        d="M10 28 L30 12"
        stroke="url(#ntx-slash)"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
        filter="url(#ntx-glow)"
      />
      <path
        d="M10 28 L30 12"
        stroke="#22d3ee"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
      {/* Arrowhead top-right */}
      <path
        d="M30 12 L30 17 M30 12 L25 12"
        stroke="#22d3ee"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Entry dot (bottom-left anchor) */}
      <circle cx="10" cy="28" r="1.6" fill="#00e692" />
    </svg>
  );
}
