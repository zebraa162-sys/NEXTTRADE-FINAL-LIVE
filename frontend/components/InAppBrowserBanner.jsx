'use client';

import { useEffect, useState } from 'react';

/**
 * InAppBrowserBanner
 * -------------------------------------------------------------
 * Shows a tiny banner telling the visitor to open the site in a
 * real browser (Chrome / Safari) when they arrive from an in-app
 * webview (Instagram, Facebook, TikTok, Twitter/X, LinkedIn, etc.).
 *
 * In-app webviews block PWA install, often break charts/login,
 * and limit cookies — bouncing those users via this banner
 * recovers meaningful traffic.
 *
 * --- ACTIVATION ---
 * The banner is INACTIVE by default. Two ways to turn it on:
 *   1. Flip the constant `BANNER_ENABLED` below to `true`, OR
 *   2. Set env var `NEXT_PUBLIC_INAPP_BANNER_ENABLED=true`
 *
 * Either toggle activates it on the next deploy.
 * -------------------------------------------------------------
 */

const BANNER_ENABLED = false;

const detectInAppBrowser = () => {
  if (typeof navigator === 'undefined') return null;
  const ua = (navigator.userAgent || '').toLowerCase();

  if (/instagram/.test(ua)) return 'Instagram';
  if (/fb_iab|fbav|fban/.test(ua)) return 'Facebook';
  if (/musical_ly|bytedance|tiktok/.test(ua)) return 'TikTok';
  if (/twitter|twitterandroid/.test(ua)) return 'Twitter / X';
  if (/linkedinapp/.test(ua)) return 'LinkedIn';
  if (/snapchat/.test(ua)) return 'Snapchat';
  if (/pinterest/.test(ua)) return 'Pinterest';
  if (/micromessenger/.test(ua)) return 'WeChat';
  if (/line\//.test(ua)) return 'LINE';
  if (/kakaotalk/.test(ua)) return 'KakaoTalk';
  // Generic Android webview heuristic (no Chrome/Safari, has wv)
  if (/android.*; wv\)/.test(ua)) return 'in-app browser';
  return null;
};

const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
};

const InAppBrowserBanner = () => {
  const envEnabled =
    typeof process !== 'undefined' &&
    process.env &&
    process.env.NEXT_PUBLIC_INAPP_BANNER_ENABLED === 'true';
  const enabled = BANNER_ENABLED || envEnabled;

  const [app, setApp] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setApp(detectInAppBrowser());
    try {
      if (sessionStorage.getItem('ntx_inapp_dismissed') === '1') setDismissed(true);
    } catch (_) {}
  }, [enabled]);

  if (!enabled || !app || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('ntx_inapp_dismissed', '1');
    } catch (_) {}
  };

  const handleOpen = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url) return;
    if (isIOS()) {
      // Best-effort copy; iOS in-app webviews can't programmatically launch Safari
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(url);
      } catch (_) {}
      // x-safari URL scheme is jailbreak-only; fall back to instructing user
      return;
    }
    // Android: intent:// fallback launches Chrome with the URL
    try {
      const cleaned = url.replace(/^https?:\/\//, '');
      window.location.href =
        'intent://' + cleaned + '#Intent;scheme=https;package=com.android.chrome;end';
    } catch (_) {}
  };

  const ios = isIOS();

  return (
    <div
      data-testid="inapp-browser-banner"
      className="fixed top-0 inset-x-0 z-[100] bg-[#00b97a] text-white text-xs sm:text-sm shadow-md"
    >
      <div className="container mx-auto px-3 py-2 flex items-center gap-3">
        <div className="flex-1 leading-snug">
          <span className="font-semibold">Open in Chrome / Safari</span>
          <span className="text-white/80">
            {' '}— You're viewing this in {app}. For full features
            {ios ? ', tap the ⋯ menu and choose "Open in Safari".' : ', tap the ⋮ menu and choose "Open in Chrome".'}
          </span>
        </div>
        {!ios && (
          <button
            data-testid="inapp-banner-open-btn"
            onClick={handleOpen}
            className="shrink-0 bg-white text-[#00b97a] font-bold px-3 py-1 rounded-md text-xs hover:bg-white/90"
          >
            Open
          </button>
        )}
        <button
          data-testid="inapp-banner-dismiss-btn"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-white/90 hover:text-white text-base leading-none px-1"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default InAppBrowserBanner;
