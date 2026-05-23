// Centralised email-sending helper for NEXT-TRADX.
//
// Uses Resend's HTTP API so it works on any VPS (port 25 SMTP is blocked by
// most providers, including Flokinet). All sends are fire-and-forget: the
// caller does NOT await a network round-trip — the send is dispatched on the
// event loop and any failure is logged to MongoDB (`email_log` collection)
// for the admin to inspect. This keeps API responses fast even if Resend is
// slow or rate-limited.
//
// Configuration (env):
//   RESEND_API_KEY   — `re_...` key from https://resend.com/api-keys
//   EMAIL_FROM       — e.g. "NEXT-TRADX <noreply@nexttradx.com>"
//   EMAIL_REPLY_TO   — optional, e.g. "support@nexttradx.com"
//   APP_BRAND_URL    — full https URL to the production site (used in CTAs)
//
// When RESEND_API_KEY is unset we DON'T crash — we log to mongo with
// status='unsent_no_key' so devs can iterate on templates without burning a key.

import { Resend } from 'resend';
import { getDb } from './db';

let _client = null;
function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_client || _client.__key !== key) {
    _client = new Resend(key);
    _client.__key = key;
  }
  return _client;
}

function from() {
  return process.env.EMAIL_FROM || 'NEXT-TRADX <onboarding@resend.dev>';
}

async function recordLog(entry) {
  try {
    const db = await getDb();
    await db.collection('email_log').insertOne({
      ...entry,
      createdAt: new Date(),
    });
  } catch (e) {
    // last-resort fallback — don't crash the request just because Mongo isn't ready
    console.error('email_log write failed:', e?.message);
  }
}

/**
 * Send an email. Non-blocking: returns immediately while the network call runs
 * in the background. Result is recorded in `email_log` for admin inspection.
 *
 * @param {object} opts
 * @param {string|string[]} opts.to    Recipient(s)
 * @param {string} opts.subject        Subject line
 * @param {string} opts.html           HTML body (already templated)
 * @param {string} [opts.text]         Optional plain-text fallback
 * @param {string} [opts.kind]         Category tag for the log (e.g. 'signup_otp')
 */
export function sendEmail({ to, subject, html, text, kind }) {
  const baseLog = {
    to: Array.isArray(to) ? to.join(',') : to,
    subject,
    kind: kind || 'transactional',
  };

  const c = client();
  if (!c) {
    // Surface the email content into the log so dev / staging can still verify
    // templates without a Resend key. Truncate the HTML so the log isn't huge.
    recordLog({
      ...baseLog,
      status: 'unsent_no_key',
      htmlPreview: String(html || '').slice(0, 600),
    });
    return;
  }

  // Dispatch in the background. Promise errors are caught & logged.
  (async () => {
    try {
      const payload = {
        from: from(),
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      };
      if (text) payload.text = text;
      if (process.env.EMAIL_REPLY_TO) payload.reply_to = process.env.EMAIL_REPLY_TO;
      const { data, error } = await c.emails.send(payload);
      if (error) {
        await recordLog({
          ...baseLog,
          status: 'failed',
          error: String(error?.message || error?.name || error),
        });
      } else {
        await recordLog({
          ...baseLog,
          status: 'sent',
          providerId: data?.id || null,
        });
      }
    } catch (e) {
      await recordLog({
        ...baseLog,
        status: 'failed',
        error: String(e?.message || e),
      });
    }
  })();
}

/** Six-digit numeric OTP code as a zero-padded string. */
export function generateOtp() {
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(6, '0');
}
