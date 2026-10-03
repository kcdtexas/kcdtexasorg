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

// 1. Pages: status, security headers, no cookies.
const REQUIRED_HEADERS = {
  'content-security-policy': /default-src 'self'/,
  'strict-transport-security': /max-age=31536000/,
  'x-content-type-options': /nosniff/,
  'x-frame-options': /DENY/,
  'referrer-policy': /strict-origin-when-cross-origin/,
  'permissions-policy': /camera=\(\)/,
};
const PAGES = ['/', '/2027/cfp/'];
const pageHtml = {};
for (const path of PAGES) {
  const res = await get(path);
  expect(res.status === 200, `${path} returned ${res.status}`);
  for (const [name, pattern] of Object.entries(REQUIRED_HEADERS)) {
    expect(pattern.test(res.headers.get(name) ?? ''), `${path} header ${name} missing or wrong: ${res.headers.get(name)}`);
  }
  expect(!res.headers.get('set-cookie'), `${path} sets a cookie`);
  // upgrade-insecure-requests breaks any plain-HTTP preview (see write-host-files.mjs).
  expect(!/upgrade-insecure-requests/.test(res.headers.get('content-security-policy') ?? ''), `${path} CSP contains upgrade-insecure-requests`);
  pageHtml[path] = await res.text();
}

// The theme script blocks rendering in <head> on every page, so it must stay tiny.
const theme = await get('/theme.js');
expect(theme.status === 200, `/theme.js returned ${theme.status}`);
expect(/javascript/.test(theme.headers.get('content-type') ?? ''), `/theme.js content type is ${theme.headers.get('content-type')}`);
const themeBytes = (await theme.arrayBuffer()).byteLength;
expect(themeBytes < 1024, `/theme.js is ${themeBytes} bytes, budget is under 1024`);

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

// 4. Every same-site asset the pages reference loads, with the right type and caching.
const assets = Object.values(pageHtml)
  .flatMap((html) => [...html.matchAll(/(?:href|src|srcset)="(\/[^"#?]*)"/g)].map((m) => m[1]))
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
