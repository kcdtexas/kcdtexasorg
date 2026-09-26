// Runs the smoke and browser tests against a fresh local server on dist/.
// Build first with scripts/build.sh.
// Usage: node tests/run-local.mjs [--shots <dir>]
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

if (!existsSync('dist/index.html')) {
  console.error('dist/ is missing. Run scripts/build.sh first.');
  process.exit(1);
}

// Test through a real network address, not 127.0.0.1: browsers treat localhost as
// a secure context and skip some behavior (such as HTTPS upgrades), which once hid
// a bug that broke the site for everyone else. Falls back to 127.0.0.1 when the
// machine has no other IPv4 address.
const host = Object.values(networkInterfaces()).flat()
  .find((a) => a && a.family === 'IPv4' && !a.internal)?.address ?? '127.0.0.1';
const port = 8799;
const base = `http://${host}:${port}`;
const server = spawn(process.execPath, ['scripts/serve.mjs', '--host', host, '--port', String(port)], { stdio: 'ignore' });

async function ready() {
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await fetch(base + '/')).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Local server did not start');
}

function run(script, extra = []) {
  return new Promise((resolve) => {
    spawn(process.execPath, [script, base, ...extra], { stdio: 'inherit' }).on('exit', resolve);
  });
}

let code = 1;
try {
  await ready();
  const smoke = await run('tests/smoke.mjs');
  const browser = await run('tests/browser.mjs', process.argv.slice(2));
  code = smoke || browser ? 1 : 0;
} finally {
  server.kill();
}
process.exit(code);
