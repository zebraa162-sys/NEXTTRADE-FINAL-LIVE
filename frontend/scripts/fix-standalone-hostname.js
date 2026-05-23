#!/usr/bin/env node
/**
 * Post-build patch for Next.js standalone server.
 *
 * Problem
 * -------
 * The generated `.next/standalone/server.js` (Next.js 14.2) contains:
 *     const hostname = process.env.HOSTNAME || '0.0.0.0'
 * and passes that to startServer. When the container runs inside Kubernetes,
 * the orchestrator automatically sets the `HOSTNAME` env var to the pod name
 * (e.g. "workspace-stage-6f78c57549-qhll4"). Node resolves that to the pod's
 * interface IP, so Next.js binds ONLY to that IP — requests coming to
 * 127.0.0.1:3000 from the co-located FastAPI proxy and Nginx upstream fail
 * with "Connection refused", producing the frontend 502 we see in the
 * deployment health check.
 *
 * Fix
 * ---
 * After `next build`, we rewrite server.js to hardcode the bind host to
 * '0.0.0.0', so Node listens on every interface (including 127.0.0.1) and
 * the in-pod reverse proxies can reach it.
 *
 * This is a safe, isolated patch — we only touch the one line and verify we
 * actually matched the known pattern.
 */
const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', '.next', 'standalone', 'server.js');

if (!fs.existsSync(serverPath)) {
  console.log('[fix-standalone-hostname] .next/standalone/server.js not found — nothing to patch (skipping).');
  process.exit(0);
}

const original = fs.readFileSync(serverPath, 'utf8');

// Next.js 14.2 pattern: `const hostname = process.env.HOSTNAME || '0.0.0.0'`.
// CRITICAL: do NOT consume trailing whitespace/newline — it terminates the
// statement. Without preserving it the next line (`let keepAliveTimeout = ...`)
// glues onto our replacement and Node parses a SyntaxError at runtime.
const pattern = /const +hostname *= *process\.env\.HOSTNAME *\|\| *['"]0\.0\.0\.0['"];?/;

if (!pattern.test(original)) {
  console.warn(
    '[fix-standalone-hostname] Known HOSTNAME pattern NOT found — Next.js generator may have changed. ' +
    'Server.js left untouched. Deploy will likely fail with 502; update this patch script.'
  );
  process.exit(0);
}

const patched = original.replace(pattern, "const hostname = '0.0.0.0';");
fs.writeFileSync(serverPath, patched, 'utf8');

console.log('[fix-standalone-hostname] Patched .next/standalone/server.js → hostname = 0.0.0.0');
