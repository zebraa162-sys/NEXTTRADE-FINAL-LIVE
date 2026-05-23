import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import InAppBrowserBanner from '@/components/InAppBrowserBanner';

export const metadata = {
  title: 'NEXTTRADX — Online Trading Platform',
  description: 'Trade 400+ assets with low minimums. Real-time forex, gold and OTC markets. Demo & Live accounts.',
  keywords: ['trading', 'forex', 'binary options', 'gold', 'OTC', 'XAU/USD', 'online trading', 'nexttradx'],
  authors: [{ name: 'NEXTTRADX' }],
  // NOTE: Intentionally NOT setting `manifest`, `applicationName`, or `apple` icons
  // to ensure the site is treated as a regular website (not installable as a PWA).
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
  },
  openGraph: {
    title: 'NEXTTRADX — Online Trading Platform',
    description: 'Trade 400+ assets with low minimums. Real-time forex & gold markets.',
    siteName: 'NEXTTRADX',
    type: 'website',
    images: [{ url: '/icon.svg', width: 512, height: 512, alt: 'NEXTTRADX' }],
  },
  twitter: {
    card: 'summary',
    title: 'NEXTTRADX — Online Trading Platform',
    description: 'Trade 400+ assets with low minimums. Real-time forex & gold markets.',
    images: ['/icon.svg'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0c1015',
};

// Inline script (runs ASAP) that:
// 1. Suppresses the Chromium/Edge `beforeinstallprompt` install banner
// 2. Aggressively unregisters any pre-existing service workers
// 3. Clears CacheStorage left over from a prior PWA install
// This guarantees the site cannot be installed on any mobile/desktop browser.
const blockPwaInstallScript = `
(function () {
  try {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
    }, true);
    window.addEventListener('appinstalled', function (e) {
      try { e.preventDefault(); } catch (_) {}
    }, true);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (r) { try { r.unregister(); } catch (_) {} });
      }).catch(function () {});
    }
    if (typeof caches !== 'undefined' && caches.keys) {
      caches.keys().then(function (keys) {
        keys.forEach(function (k) { try { caches.delete(k); } catch (_) {} });
      }).catch(function () {});
    }
  } catch (_) {}
})();
`;

const App = ({ children }) => {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Explicitly disable iOS "Add to Home Screen" web-app capability */}
        <meta name="apple-mobile-web-app-capable" content="no" />
        <meta name="mobile-web-app-capable" content="no" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: blockPwaInstallScript }}
        />
      </head>
      <body className="bg-[#0c1015] text-foreground antialiased min-h-screen overscroll-none">
        <InAppBrowserBanner />
        {children}
        <Toaster richColors position="top-right" theme="dark" />
      </body>
    </html>
  );
};

export default App;
