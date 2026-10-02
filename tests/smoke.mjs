// HTTP smoke tests against a running site (local server or a deploy).
// Usage: node tests/smoke.mjs [baseUrl]   (default http://127.0.0.1:8090)
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const base = (process.argv[2] ?? process.env.BASE_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
const failures = [];
let checks = 0;

function expect(ok, message) {
  checks += 1;
  if (!ok) failures.push(message);
}

async function get(path, init = {}) {
  return fetch(base + path, { redirect: 'manual', ...init });
}

// 1. Home page: status, security headers, no cookies.
const home = await get('/');
expect(home.status === 200, `/ returned ${home.status}`);
const REQUIRED_HEADERS = {
  'content-security-policy': /default-src 'self'/,
  'strict-transport-security': /max-age=31536000/,
  'x-content-type-options': /nosniff/,
  'x-frame-options': /DENY/,
  'referrer-policy': /strict-origin-when-cross-origin/,
  'permissions-policy': /camera=\(\)/,
};
for (const [name, pattern] of Object.entries(REQUIRED_HEADERS)) {
  expect(pattern.test(home.headers.get(name) ?? ''), `/ header ${name} missing or wrong: ${home.headers.get(name)}`);
}
expect(!home.headers.get('set-cookie'), '/ sets a cookie');
// upgrade-insecure-requests breaks any plain-HTTP preview (see write-host-files.mjs).
expect(!/upgrade-insecure-requests/.test(home.headers.get('content-security-policy') ?? ''), 'CSP contains upgrade-insecure-requests');
const homeHtml = await home.text();

// 2. Unknown paths get the real 404 page.
const missing = await get('/this-page-does-not-exist');
expect(missing.status === 404, `unknown path returned ${missing.status}`);
expect((await missing.text()).includes("This page doesn't exist"), 'unknown path did not serve 404.html');

// 3. Every Short Link redirects with the right code and target.
const links = parse(readFileSync('src/data/short-links.yaml', 'utf8'));
for (const { from, to, code } of links) {
  const res = await get(from);
  expect(res.status === code, `${from} returned ${res.status}, expected ${code}`);
  // Compare resolved URLs: hosts write the same address differently (Cloudflare adds the
  // "/" after a bare domain, and may send an absolute URL for a relative target).
  const location = res.headers.get('location');
  const sameTarget = location !== null && new URL(location, `${base}/`).href === new URL(to, `${base}/`).href;
  expect(sameTarget, `${from} points to ${location}, expected ${to}`);
  expect(!res.headers.get('set-cookie'), `${from} sets a cookie`);
  if (to.startsWith('/')) {
    const target = await get(to);
    expect(target.status === 200, `${from} target ${to} returned ${target.status}`);
  }
}

// 4. Every same-site asset the home page references loads, with the right type and caching.
const assets = [...homeHtml.matchAll(/(?:href|src|srcset)="(\/[^"#?]*)"/g)]
  .map((m) => m[1])
  .filter((p) => /\.(css|js|woff2|svg|png|jpg|webp|avif|ico)$/.test(p));
for (const path of new Set(assets)) {
  const res = await get(path);
  expect(res.status === 200, `${path} returned ${res.status}`);
  if (path.startsWith('/_astro/') || path.startsWith('/fonts/')) {
    expect(/immutable/.test(res.headers.get('cache-control') ?? ''), `${path} is not cached as immutable`);
  }
}

// 5. Basics.
expect((await get('/robots.txt')).status === 200, 'robots.txt missing');
expect((await get('/favicon.svg')).status === 200, 'favicon.svg missing');

if (failures.length) {
  console.error(`Smoke tests failed (${failures.length} of ${checks} checks) against ${base}:\n  ` + failures.join('\n  '));
  process.exit(1);
}
console.log(`Smoke tests passed: ${checks} checks against ${base}.`);
