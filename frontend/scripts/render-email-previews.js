// One-off renderer for visual inspection of email templates.
// Writes a single HTML page that shows every template stacked in an iframe-
// like preview so we can screenshot the whole catalogue at once.

const path = require('path');
process.env.APP_BRAND_URL = process.env.APP_BRAND_URL || 'https://emergent-options.preview.emergentagent.com';
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BRAND_URL;

// Templates use ESM import syntax; require via a tiny shim.
async function main() {
  const t = await import(path.join(__dirname, '../lib/emailTemplates.js'));
  const samples = [
    ['Signup OTP', t.tplSignupOtp({ name: 'Alex', code: '482917' })],
    ['Welcome', t.tplWelcome({ name: 'Alex' })],
    ['Password reset', t.tplPasswordReset({ name: 'Alex', code: '309574', link: 'https://nexttradx.com/reset-password?email=alex@example.com' })],
    ['Login alert', t.tplLoginAlert({ name: 'Alex', ip: '203.0.113.42', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15', when: new Date().toUTCString() })],
    ['Deposit requested', t.tplDepositRequested({ name: 'Alex', amount: 250, method: 'USDT (TRC20)', ref: 'A1B2C3D4' })],
    ['Deposit approved', t.tplDepositApproved({ name: 'Alex', amount: 250, method: 'USDT (TRC20)', ref: 'A1B2C3D4' })],
    ['Deposit rejected', t.tplDepositRejected({ name: 'Alex', amount: 250, method: 'USDT (TRC20)', ref: 'A1B2C3D4', note: 'Transfer not visible on blockchain' })],
    ['Withdrawal requested', t.tplWithdrawalRequested({ name: 'Alex', amount: 180, method: 'USDT (TRC20)', ref: 'W7X8Y9Z0' })],
    ['Withdrawal approved', t.tplWithdrawalApproved({ name: 'Alex', amount: 180, method: 'USDT (TRC20)', ref: 'W7X8Y9Z0' })],
    ['Withdrawal rejected', t.tplWithdrawalRejected({ name: 'Alex', amount: 180, method: 'USDT (TRC20)', ref: 'W7X8Y9Z0', note: 'Receiving address looks invalid' })],
  ];

  const blocks = samples.map(([title, s]) => `
    <section style="margin:32px auto;max-width:900px;">
      <div style="font:600 13px/1.4 system-ui;color:#1ee0a0;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;padding-left:6px;">${title}</div>
      <div style="font:500 14px/1.4 system-ui;color:#fff;margin-bottom:8px;padding-left:6px;">Subject: ${s.subject}</div>
      <iframe srcdoc='${s.html.replace(/'/g, "&apos;")}' style="width:100%;height:760px;border:1px solid #1f2630;border-radius:14px;background:#0b0f14;"></iframe>
    </section>`).join('\n');

  const page = `<!doctype html><html><head><meta charset="utf-8"><title>NEXT-TRADX email previews</title><style>body{margin:0;background:#06090d;font-family:system-ui;color:#fff}h1{padding:24px 32px 0 32px;font-weight:800;letter-spacing:.6px}</style></head><body><h1>NEXT-TRADX Email Templates</h1>${blocks}</body></html>`;

  const fs = require('fs');
  fs.writeFileSync(path.join(__dirname, '../public/email-previews.html'), page);
  console.log('Wrote /app/frontend/public/email-previews.html (' + page.length + ' bytes)');
}
main().catch(e => { console.error(e); process.exit(1); });
