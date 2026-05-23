'use client';

// Tiny client-side helper around the API. Always sends JWT from localStorage.

const BASE = '/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('qx_token');
}
export function setToken(t) {
  if (t) {
    localStorage.setItem('qx_token', t);
    // Fresh login: clear any previously-seen announcement flags so the active
    // announcement is shown again for this new session.
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const keys = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const k = window.sessionStorage.key(i);
          if (k && k.startsWith('hasSeenAnnouncement_')) keys.push(k);
        }
        keys.forEach(k => window.sessionStorage.removeItem(k));
      }
    } catch {}
  } else {
    localStorage.removeItem('qx_token');
    // Logout: clear announcement flags
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const keys = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const k = window.sessionStorage.key(i);
          if (k && k.startsWith('hasSeenAnnouncement_')) keys.push(k);
        }
        keys.forEach(k => window.sessionStorage.removeItem(k));
      }
    } catch {}
  }
}
export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem('qx_user') || 'null'); } catch { return null; }
}
export function setStoredUser(u) {
  if (u) localStorage.setItem('qx_user', JSON.stringify(u));
  else localStorage.removeItem('qx_user');
}

async function request(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { ...opts, headers, cache: 'no-store' });
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
  return data;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signup: (email, password, name) => request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  me: () => request('/auth/me'),
  switchAccount: (account) => request('/auth/switch', { method: 'POST', body: JSON.stringify({ account }) }),
  resetDemo: () => request('/auth/reset-demo', { method: 'POST' }),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  updateProfile: (name) =>
    request('/auth/profile', { method: 'PUT', body: JSON.stringify({ name }) }),
  savePrefs: (prefs) =>
    request('/auth/prefs', { method: 'PUT', body: JSON.stringify(prefs) }),
  assets: () => request('/assets'),
  price: (sym) => request(`/price/${sym}`),
  candles: (sym, interval = 5) => request(`/candles/${sym}?interval=${interval}`),
  placeTrade: (payload) => request('/trades', { method: 'POST', body: JSON.stringify(payload) }),
  myTrades: (status = 'all') => request(`/trades?status=${status}`),
  // admin
  adminUsers: () => request('/admin/users'),
  adminTrades: (status = 'open') => request(`/admin/trades?status=${status}`),
  forceTrade: (id, outcome) => request(`/admin/trades/${id}/force`, { method: 'POST', body: JSON.stringify({ outcome }) }),
  getSettings: () => request('/admin/settings'),
  setSettings: (body) => request('/admin/settings', { method: 'PUT', body: JSON.stringify(body) }),
  publicSettings: () => request('/settings/public'),
  adminStats: () => request('/admin/stats'),
  adminBalance: (id, account, delta) => request(`/admin/users/${id}/balance`, { method: 'POST', body: JSON.stringify({ account, delta }) }),
  // deposits / withdrawals
  createDeposit: (body) => request('/deposits', { method: 'POST', body: JSON.stringify(body) }),
  myDeposits: () => request('/deposits'),
  createWithdrawal: (body) => request('/withdrawals', { method: 'POST', body: JSON.stringify(body) }),
  myWithdrawals: () => request('/withdrawals'),
  adminDeposits: (status = 'pending') => request(`/admin/deposits?status=${status}`),
  adminWithdrawals: (status = 'pending') => request(`/admin/withdrawals?status=${status}`),
  approveDeposit: (id, note) => request(`/admin/deposits/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) }),
  rejectDeposit: (id, note) => request(`/admin/deposits/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
  approveWithdrawal: (id, note) => request(`/admin/withdrawals/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) }),
  rejectWithdrawal: (id, note) => request(`/admin/withdrawals/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
  // announcements (admin)
  adminAnnouncements: () => request('/admin/announcements'),
  createAnnouncement: (body) => request('/admin/announcements', { method: 'POST', body: JSON.stringify(body) }),
  updateAnnouncement: (id, body) => request(`/admin/announcements/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAnnouncement: (id) => request(`/admin/announcements/${id}`, { method: 'DELETE' }),
  // public
  activeAnnouncement: () => request('/announcements/active'),
  leaderboard: () => request('/leaderboard'),
  // support (user)
  listMyTickets: () => request('/support/tickets'),
  createTicket: (subject, message) => request('/support/tickets', { method: 'POST', body: JSON.stringify({ subject, message }) }),
  getTicket: (id) => request(`/support/tickets/${id}`),
  postTicketMessage: (id, text) => request(`/support/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ text }) }),
  unreadSupport: () => request('/support/unread'),
  // support (admin)
  adminListTickets: (status = 'all') => request(`/admin/support/tickets?status=${status}`),
  adminUnreadSupport: () => request('/admin/support/unread'),
  adminSetTicketStatus: (id, status) => request(`/admin/support/tickets/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};
