// Branded NEXT-TRADX email templates.
//
// Rules followed (per Resend / general email-client compatibility):
//   • Inline CSS only — no <style> tag, no external sheets
//   • Table-based layout — Outlook still uses an IE6 rendering engine
//   • System font stack — no @import of webfonts (breaks deliverability + slow)
//   • Single dark theme — solid backgrounds, no gradients (gradients turn into
//     ugly bands in many clients)
//   • Width clamped at 560px so it reads cleanly on mobile + desktop
//
// Palette (matches the app):
//   BG     #0b0f14   panel #11161d   border #1f2630
//   text   #ffffff   muted #8b96a3
//   green  #00b97a   red   #ff5555   accent #1ee0a0

const BRAND = 'NEXT-TRADX';
const COLOR = {
  bg: '#0b0f14',
  panel: '#11161d',
  panelAlt: '#0d1218',
  border: '#1f2630',
  text: '#ffffff',
  muted: '#8b96a3',
  mutedDim: '#6b7480',
  green: '#00b97a',
  red: '#ff5555',
  accent: '#1ee0a0',
  buttonFg: '#00120a',
};
const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif";

function appUrl() {
  return (process.env.APP_BRAND_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://nexttradx.com').replace(/\/$/, '');
}

// Inline-SVG logo (hexagon with a bullish arrow) — works in Gmail, Outlook,
// Apple Mail. data: URI is base64-encoded to be embedded safely in <img src>.
function logoImg() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><path d='M32 4 L56 18 L56 46 L32 60 L8 46 L8 18 Z' fill='#11161d' stroke='${COLOR.accent}' stroke-width='2.5'/><path d='M22 40 L30 32 L36 36 L44 24' stroke='${COLOR.accent}' stroke-width='3.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/><path d='M40 22 L46 22 L46 28' stroke='${COLOR.accent}' stroke-width='3.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
  const b64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}

// ─── shared chrome ────────────────────────────────────────────────────────
function shell({ preview, body, ctaLabel, ctaUrl, footerNote }) {
  const url = appUrl();
  const pre = (preview || '').replace(/[<>]/g, '');
  const cta = ctaLabel && ctaUrl
    ? `<tr><td align="center" style="padding:8px 32px 28px 32px;">
         <a href="${ctaUrl}" style="display:inline-block;background:${COLOR.green};color:${COLOR.buttonFg};text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.4px;padding:14px 30px;border-radius:10px;font-family:${FONT};">${ctaLabel}</a>
       </td></tr>`
    : '';
  const fn = footerNote
    ? `<tr><td style="padding:0 32px 24px 32px;color:${COLOR.mutedDim};font-size:12px;line-height:1.6;font-family:${FONT};">${footerNote}</td></tr>`
    : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${BRAND}</title></head>
<body style="margin:0;padding:0;background:${COLOR.bg};font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLOR.bg};">${pre}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLOR.bg};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:${COLOR.panel};border:1px solid ${COLOR.border};border-radius:14px;overflow:hidden;">
      <!-- Header -->
      <tr><td style="padding:24px 32px 12px 32px;border-bottom:1px solid ${COLOR.border};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="left">
              <img src="${logoImg()}" width="28" height="28" alt="" style="vertical-align:middle;display:inline-block;margin-right:10px;">
              <span style="color:${COLOR.text};font-weight:800;font-size:17px;letter-spacing:1.2px;font-family:${FONT};vertical-align:middle;">NEXT<span style="color:${COLOR.accent};">TRADX</span></span>
            </td>
            <td align="right" style="color:${COLOR.mutedDim};font-size:11px;letter-spacing:1px;font-family:${FONT};">TRADE SMARTER</td>
          </tr>
        </table>
      </td></tr>
      <!-- Body -->
      ${body}
      ${cta}
      ${fn}
      <!-- Footer -->
      <tr><td style="padding:18px 32px;background:${COLOR.panelAlt};border-top:1px solid ${COLOR.border};color:${COLOR.muted};font-size:11px;line-height:1.6;font-family:${FONT};" align="center">
        © ${new Date().getFullYear()} ${BRAND}. All rights reserved.<br>
        Need help? Reply to this email or visit <a href="${url}/support" style="color:${COLOR.accent};text-decoration:none;">${url.replace(/^https?:\/\//, '')}/support</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function heading(title, subtitle) {
  return `<tr><td style="padding:28px 32px 4px 32px;">
    <div style="color:${COLOR.text};font-size:22px;font-weight:700;line-height:1.3;font-family:${FONT};">${title}</div>
    ${subtitle ? `<div style="color:${COLOR.muted};font-size:14px;line-height:1.55;margin-top:6px;font-family:${FONT};">${subtitle}</div>` : ''}
  </td></tr>`;
}

function paragraph(text) {
  return `<tr><td style="padding:12px 32px 4px 32px;color:${COLOR.text};font-size:14px;line-height:1.65;font-family:${FONT};">${text}</td></tr>`;
}

function otpBlock(code) {
  const spans = String(code).split('').map(d =>
    `<span style="display:inline-block;width:42px;height:54px;line-height:54px;background:${COLOR.panelAlt};border:1px solid ${COLOR.border};border-radius:8px;font-size:26px;font-weight:800;color:${COLOR.accent};font-family:${FONT};margin:0 3px;">${d}</span>`
  ).join('');
  return `<tr><td align="center" style="padding:22px 32px 12px 32px;">${spans}</td></tr>`;
}

function infoCard(rows) {
  // rows: [{label, value, color?}]
  const trs = rows.map(r => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid ${COLOR.border};color:${COLOR.muted};font-size:12px;text-transform:uppercase;letter-spacing:0.6px;font-family:${FONT};">${r.label}</td>
      <td style="padding:10px 14px;border-bottom:1px solid ${COLOR.border};color:${r.color || COLOR.text};font-size:14px;font-weight:600;font-family:${FONT};text-align:right;">${r.value}</td>
    </tr>
  `).join('');
  return `<tr><td style="padding:8px 32px 12px 32px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLOR.panelAlt};border:1px solid ${COLOR.border};border-radius:10px;overflow:hidden;">${trs}</table>
  </td></tr>`;
}

function statusPill(status) {
  const map = {
    approved: { bg: 'rgba(0,185,122,0.15)', fg: COLOR.green, label: 'APPROVED' },
    rejected: { bg: 'rgba(255,85,85,0.15)', fg: COLOR.red, label: 'REJECTED' },
    pending:  { bg: 'rgba(30,224,160,0.12)', fg: COLOR.accent, label: 'PENDING REVIEW' },
  };
  const s = map[status] || map.pending;
  return `<span style="display:inline-block;background:${s.bg};color:${s.fg};font-size:11px;font-weight:700;letter-spacing:1px;padding:6px 12px;border-radius:6px;font-family:${FONT};">${s.label}</span>`;
}

// ─── individual templates ─────────────────────────────────────────────────

export function tplSignupOtp({ name, code }) {
  const subject = `Your ${BRAND} verification code: ${code}`;
  const html = shell({
    preview: `Your ${BRAND} verification code is ${code}. Expires in 10 minutes.`,
    body: heading(`Hi ${name || 'trader'} 👋`,
      `Welcome aboard. Enter the code below in the signup screen to verify your email — it expires in <strong style="color:${COLOR.text}">10 minutes</strong>.`)
      + otpBlock(code)
      + paragraph(`If you didn't request this, you can safely ignore this email — no account is created until the code is entered.`),
    footerNote: `For your security, never share this code with anyone. ${BRAND} staff will never ask for it.`,
  });
  return { subject, html };
}

export function tplWelcome({ name }) {
  const url = appUrl();
  const subject = `Welcome to ${BRAND} — your $10,000 demo is ready`;
  const html = shell({
    preview: `Your trading account is live. Practice on a $10,000 demo, then go live whenever you're ready.`,
    body: heading(`You're in, ${name || 'trader'}.`,
      `Your account is verified and ready. We loaded <strong style="color:${COLOR.accent}">$10,000 of demo funds</strong> so you can practice on 40+ OTC and live forex/metals assets risk-free.`)
      + paragraph(`When you're ready to go live, you can deposit from $10 — no monthly fees, fast withdrawals.`),
    ctaLabel: 'Open Trading Dashboard',
    ctaUrl: `${url}/trade`,
    footerNote: `Tip: start on the 5-second timeframe with $1 trades — the muscle memory carries over to longer durations.`,
  });
  return { subject, html };
}

export function tplPasswordReset({ name, code, link }) {
  const subject = `${BRAND} password reset code: ${code}`;
  const html = shell({
    preview: `Use code ${code} to reset your password. Expires in 30 minutes.`,
    body: heading(`Password reset request`,
      `Hi ${name || 'trader'}, we got a request to reset the password on your account. Use the code below — it expires in <strong style="color:${COLOR.text}">30 minutes</strong>.`)
      + otpBlock(code)
      + paragraph(`Or click the secure link to open the reset page directly.`),
    ctaLabel: 'Reset Password',
    ctaUrl: link,
    footerNote: `If you didn't request a reset, you can ignore this email — your password stays unchanged. For your security, never share this code.`,
  });
  return { subject, html };
}

export function tplLoginAlert({ name, ip, userAgent, when }) {
  const subject = `New sign-in to your ${BRAND} account`;
  const html = shell({
    preview: `A new device signed in to your account.`,
    body: heading(`New sign-in detected`,
      `Hi ${name || 'trader'}, we noticed a sign-in to your account. If this was you, you can safely ignore this message.`)
      + infoCard([
        { label: 'When',       value: when || new Date().toUTCString() },
        { label: 'IP address', value: ip || 'unknown' },
        { label: 'Device',     value: (userAgent || 'unknown').slice(0, 60) },
      ])
      + paragraph(`If this <strong style="color:${COLOR.red}">wasn't you</strong>, change your password immediately from <a href="${appUrl()}/account" style="color:${COLOR.accent};text-decoration:none;">My Account → Security</a>.`),
    ctaLabel: 'Review Account',
    ctaUrl: `${appUrl()}/account`,
  });
  return { subject, html };
}

export function tplDepositRequested({ name, amount, method, ref }) {
  const subject = `Deposit received — under review`;
  const html = shell({
    preview: `Your deposit of $${amount} is pending review.`,
    body: heading(`Deposit received`,
      `Hi ${name || 'trader'}, we've logged your deposit request. Our team typically reviews requests within a few hours — we'll email you the moment it's approved.`)
      + `<tr><td align="center" style="padding:10px 32px 6px 32px;">${statusPill('pending')}</td></tr>`
      + infoCard([
        { label: 'Amount', value: `$${Number(amount).toFixed(2)}`, color: COLOR.accent },
        { label: 'Method', value: String(method || '—') },
        { label: 'Reference', value: ref || '—' },
      ]),
    footerNote: `Funds will appear in your Live account as soon as the deposit clears.`,
  });
  return { subject, html };
}

export function tplDepositApproved({ name, amount, method, ref }) {
  const subject = `Your deposit of $${Number(amount).toFixed(2)} is live`;
  const html = shell({
    preview: `Your deposit was approved and credited to your live balance.`,
    body: heading(`Deposit approved 🚀`,
      `Hi ${name || 'trader'}, your deposit cleared. The funds are now in your <strong style="color:${COLOR.accent}">Live</strong> account and ready to trade.`)
      + `<tr><td align="center" style="padding:10px 32px 6px 32px;">${statusPill('approved')}</td></tr>`
      + infoCard([
        { label: 'Amount', value: `+ $${Number(amount).toFixed(2)}`, color: COLOR.green },
        { label: 'Method', value: String(method || '—') },
        { label: 'Reference', value: ref || '—' },
      ]),
    ctaLabel: 'Start Trading',
    ctaUrl: `${appUrl()}/trade`,
  });
  return { subject, html };
}

export function tplDepositRejected({ name, amount, method, ref, note }) {
  const subject = `Deposit declined`;
  const html = shell({
    preview: `Your deposit could not be processed.`,
    body: heading(`Deposit declined`,
      `Hi ${name || 'trader'}, unfortunately we couldn't process your most recent deposit. No funds were taken.`)
      + `<tr><td align="center" style="padding:10px 32px 6px 32px;">${statusPill('rejected')}</td></tr>`
      + infoCard([
        { label: 'Amount', value: `$${Number(amount).toFixed(2)}` },
        { label: 'Method', value: String(method || '—') },
        { label: 'Reference', value: ref || '—' },
        ...(note ? [{ label: 'Reason', value: String(note).slice(0, 120) }] : []),
      ])
      + paragraph(`You're welcome to try again or reach out to support and we'll help you sort it out.`),
    ctaLabel: 'Contact Support',
    ctaUrl: `${appUrl()}/support`,
  });
  return { subject, html };
}

export function tplWithdrawalRequested({ name, amount, method, ref }) {
  const subject = `Withdrawal request received`;
  const html = shell({
    preview: `Your withdrawal request of $${amount} is pending.`,
    body: heading(`Withdrawal requested`,
      `Hi ${name || 'trader'}, we received your withdrawal request. Funds have been moved to escrow and we'll process the payout shortly.`)
      + `<tr><td align="center" style="padding:10px 32px 6px 32px;">${statusPill('pending')}</td></tr>`
      + infoCard([
        { label: 'Amount', value: `- $${Number(amount).toFixed(2)}`, color: COLOR.red },
        { label: 'Method', value: String(method || '—') },
        { label: 'Reference', value: ref || '—' },
      ]),
    footerNote: `If you reject a withdrawal before it's processed, the full amount is automatically refunded to your live balance.`,
  });
  return { subject, html };
}

export function tplWithdrawalApproved({ name, amount, method, ref }) {
  const subject = `Withdrawal of $${Number(amount).toFixed(2)} approved`;
  const html = shell({
    preview: `Your withdrawal has been approved and dispatched.`,
    body: heading(`Withdrawal sent ✅`,
      `Hi ${name || 'trader'}, your withdrawal has been approved and dispatched. Depending on the payment method, settlement typically takes anywhere from minutes to a few business days.`)
      + `<tr><td align="center" style="padding:10px 32px 6px 32px;">${statusPill('approved')}</td></tr>`
      + infoCard([
        { label: 'Amount', value: `- $${Number(amount).toFixed(2)}`, color: COLOR.red },
        { label: 'Method', value: String(method || '—') },
        { label: 'Reference', value: ref || '—' },
      ]),
  });
  return { subject, html };
}

export function tplWithdrawalRejected({ name, amount, method, ref, note }) {
  const subject = `Withdrawal declined — funds refunded`;
  const html = shell({
    preview: `Your withdrawal was declined. Funds have been refunded.`,
    body: heading(`Withdrawal declined`,
      `Hi ${name || 'trader'}, we couldn't process your withdrawal. The full amount has been refunded to your live balance.`)
      + `<tr><td align="center" style="padding:10px 32px 6px 32px;">${statusPill('rejected')}</td></tr>`
      + infoCard([
        { label: 'Amount refunded', value: `+ $${Number(amount).toFixed(2)}`, color: COLOR.green },
        { label: 'Method', value: String(method || '—') },
        { label: 'Reference', value: ref || '—' },
        ...(note ? [{ label: 'Reason', value: String(note).slice(0, 120) }] : []),
      ]),
    ctaLabel: 'Contact Support',
    ctaUrl: `${appUrl()}/support`,
  });
  return { subject, html };
}
