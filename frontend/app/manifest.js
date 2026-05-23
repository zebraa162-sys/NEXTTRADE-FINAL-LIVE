// Explicit Web App Manifest that DISABLES PWA install on Android Chrome.
//
// `display: "browser"` tells Chrome that even if the user taps
// "Add to home screen" from the menu, the home-screen icon should
// open in a regular browser tab (with the URL bar visible) — NOT as
// a standalone PWA / WebAPK.
//
// This is the documented and reliable way to opt out of WebAPK
// auto-generation on older Chrome / Samsung Internet builds where
// the `mobile-web-app-capable=no` meta tag alone isn't enough.
//
// To re-enable PWA install in the future, simply change `display`
// back to `"standalone"` (or delete this file). All app code,
// routes, and APIs remain untouched.
export default function manifest() {
  return {
    name: 'NEXTTRADX',
    short_name: 'NEXTTRADX',
    start_url: '/',
    scope: '/',
    display: 'browser',
    display_override: ['browser'],
    background_color: '#0c1015',
    theme_color: '#0c1015',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    prefer_related_applications: false,
  };
}
