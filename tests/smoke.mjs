// HTTP smoke tests against a running site (local server or a deploy).
// Finds the pages by crawling internal links from / (plus the v1 paths that exist), so it works
// against any base URL. On every page: status, security headers, no cookies, exactly one h1, the
// link-preview tags, no draft markers, and every internal link resolves.
// Usage: node tests/smoke.mjs [baseUrl]   (default http://127.0.0.1:8090)
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { REQUIRED_PAGES, findDraftMarkers } from '../scripts/check-dist.mjs';

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
// The v1 pages. Each one that exists is tested even if no link reaches it. A link to one that
// isn't built yet is pending (a notice) until it is listed in REQUIRED_PAGES in
// scripts/check-dist.mjs; from then on a broken link to it fails.
const V1_PAGES = [
  '/', '/2027/cfp/', '/2027/sponsors/', '/2027/tickets/', '/2027/travel/', '/2027/schedule/',
  '/2026/', '/editions/', '/about/', '/code-of-conduct/', '/privacy/', '/accessibility/',
];
const pending = (path) => V1_PAGES.includes(path) && !REQUIRED_PAGES.includes(path);
const shortLinks = parse(readFileSync('src/data/short-links.yaml', 'utf8'));
const isShortLink = (path) => shortLinks.some(({ from }) => from === path.replace(/(.)\/$/, '$1'));

// Same-site URLs referenced by href (links and <link>), as paths with query, without fragments.
// mailto:, tel: and fragment-only links are skipped, and so are other hosts.
const origin = new URL(base).origin;
function internalLinks(html, pagePath) {
  const found = new Set();
  for (const [, raw] of html.matchAll(/\shref="([^"]*)"/g)) {
    const href = raw.replace(/&amp;/g, '&');
    if (!href || href.startsWith('#') || /^(?:mailto|tel):/i.test(href)) continue;
    const url = new URL(href, base + pagePath);
    if (url.origin === origin) found.add(url.pathname + url.search);
  }
  return found;
}

// Fetches every URL once.
const responses = new Map();
function fetchOnce(path) {
  if (!responses.has(path)) {
    responses.set(path, get(path).then(async (res) => ({
      status: res.status,
      headers: res.headers,
      html: /text\/html/.test(res.headers.get('content-type') ?? '') ? await res.text() : (await res.arrayBuffer(), null),
    })));
  }
  return responses.get(path);
}

// Crawl from / and the v1 paths. A page is any 200 HTML response; its links are crawled too.
const pageHtml = {};
const linksFrom = {};
const v1Present = [];
const queue = ['/'];
for (const path of V1_PAGES) if ((await fetchOnce(path)).status === 200) { queue.push(path); v1Present.push(path); }
const seen = new Set();
while (queue.length) {
  const batch = queue.splice(0).filter((p) => !seen.has(p));
  batch.forEach((p) => seen.add(p));
  await Promise.all(batch.map(async (path) => {
    const res = await fetchOnce(path);
    if (res.status !== 200 || res.html === null) return;
    pageHtml[path] = res.html;
    linksFrom[path] = internalLinks(res.html, path);
    for (const link of linksFrom[path]) if (!seen.has(link)) queue.push(link);
  }));
}
const PAGES = Object.keys(pageHtml).sort();
for (const path of REQUIRED_PAGES.filter((p) => p.endsWith('/'))) {
  expect(PAGES.includes(path), `required page ${path} returned ${(await fetchOnce(path)).status}`);
}
for (const path of PAGES) {
  const res = await fetchOnce(path);
  for (const [name, pattern] of Object.entries(REQUIRED_HEADERS)) {
    expect(pattern.test(res.headers.get(name) ?? ''), `${path} header ${name} missing or wrong: ${res.headers.get(name)}`);
  }
  expect(!res.headers.get('set-cookie'), `${path} sets a cookie`);
  // upgrade-insecure-requests breaks any plain-HTTP preview (see write-host-files.mjs).
  expect(!/upgrade-insecure-requests/.test(res.headers.get('content-security-policy') ?? ''), `${path} CSP contains upgrade-insecure-requests`);
}

// The theme script blocks rendering in <head> on every page, so it must stay tiny.
const theme = await get('/theme.js');
expect(theme.status === 200, `/theme.js returned ${theme.status}`);
expect(/javascript/.test(theme.headers.get('content-type') ?? ''), `/theme.js content type is ${theme.headers.get('content-type')}`);
const themeBytes = (await theme.arrayBuffer()).byteLength;
expect(themeBytes < 1024, `/theme.js is ${themeBytes} bytes, budget is under 1024`);

// 2. Unknown paths get the real 404 page.
const MISSING = '/this-page-does-not-exist';
const missing = await get(MISSING);
expect(missing.status === 404, `unknown path returned ${missing.status}`);
const missingHtml = await missing.text();
expect(missingHtml.includes("This page doesn't exist"), 'unknown path did not serve 404.html');
// From here on the 404 page counts as a page too (h1, link-preview tags, draft markers, links).
pageHtml[MISSING] = missingHtml;
linksFrom[MISSING] = internalLinks(missingHtml, MISSING);

// 3. Every Short Link redirects with the right code and target.
for (const { from, to, code, mode } of shortLinks) {
  const res = await get(from);
  // A replaced-by-page link stops redirecting once its page exists (write-host-files.mjs).
  if (mode === 'replaced-by-page' && (res.status === 200 || (await fetchOnce(`${from}/`)).status === 200)) {
    checks += 1;
    continue;
  }
  expect(res.status === code, `${from} returned ${res.status}, expected ${code}`);
  // Compare resolved URLs: hosts write the same address differently (Cloudflare adds the
  // "/" after a bare domain, and may send an absolute URL for a relative target).
  const location = res.headers.get('location');
  const sameTarget = location !== null && new URL(location, `${base}/`).href === new URL(to, `${base}/`).href;
  expect(sameTarget, `${from} points to ${location}, expected ${to}`);
  expect(!res.headers.get('set-cookie'), `${from} sets a cookie`);
  if (to.startsWith('/')) {
    // The target may itself be a Short Link until its page exists (/coc -> /code-of-conduct/).
    const target = await get(to);
    expect(target.status === 200 || ([301, 302].includes(target.status) && isShortLink(to)), `${from} target ${to} returned ${target.status}`);
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

// 5. Link previews: every page has the tags, and its card loads from our domain.
// The social cards (src/lib/cards/cards.ts), each 1200 x 630 and under 300 KB.
const CARDS = ['/cards/default.png', '/cards/sponsorships.png', '/cards/cfp.png'];
// Preview builds point og:image at their own address (CARD_ORIGIN).
const OUR_HOSTS = new Set(['kcdtexas.org', new URL(base).host, ...(process.env.CARD_ORIGIN ? [new URL(process.env.CARD_ORIGIN).host] : [])]);
const meta = (html, key) =>
  html.match(new RegExp(`<meta (?:property|name)="${key.replace(/[:.]/g, '\\$&')}" content="([^"]*)"`))?.[1];
const cardPaths = new Set(CARDS);
for (const [path, html] of Object.entries(pageHtml)) {
  for (const key of ['og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'og:image:alt', 'og:image:width', 'og:image:height']) {
    expect(meta(html, key), `${path} has no ${key}`);
  }
  expect(meta(html, 'og:site_name') === 'KCD Texas', `${path} og:site_name is ${meta(html, 'og:site_name')}`);
  expect(meta(html, 'twitter:card') === 'summary_large_image', `${path} twitter:card is ${meta(html, 'twitter:card')}`);
  expect(meta(html, 'og:image:width') === '1200' && meta(html, 'og:image:height') === '630', `${path} og:image size is not 1200 x 630`);
  const image = meta(html, 'og:image') ?? '';
  expect(/^https?:\/\//.test(image), `${path} og:image is not absolute: ${image}`);
  expect(/^https?:\/\//.test(meta(html, 'og:url') ?? ''), `${path} og:url is not absolute: ${meta(html, 'og:url')}`);
  if (/^https?:\/\//.test(image)) {
    const url = new URL(image);
    expect(OUR_HOSTS.has(url.host), `${path} og:image is not on our domain: ${image}`);
    expect(/^\/cards\/[a-z0-9-]+\.png$/.test(url.pathname), `${path} og:image is not a /cards/*.png card: ${image}`);
    cardPaths.add(url.pathname);
  }
}
for (const path of cardPaths) {
  const res = await get(path);
  expect(res.status === 200, `${path} returned ${res.status}`);
  expect(res.headers.get('content-type') === 'image/png', `${path} content type is ${res.headers.get('content-type')}`);
  const png = Buffer.from(await res.arrayBuffer());
  expect(png.length < 300 * 1024, `${path} is ${Math.round(png.length / 1024)} KB, budget is under 300 KB`);
  // The PNG header's IHDR chunk holds the width and height.
  const size = png.length > 24 && png.toString('latin1', 12, 16) === 'IHDR' ? `${png.readUInt32BE(16)} x ${png.readUInt32BE(20)}` : 'not a PNG';
  expect(size === '1200 x 630', `${path} is ${size}, expected 1200 x 630`);
}

// 6. Every page has exactly one h1 and no draft markers.
for (const [path, html] of Object.entries(pageHtml)) {
  const h1s = html.match(/<h1\b/gi)?.length ?? 0;
  expect(h1s === 1, `${path} has ${h1s} h1 elements, expected 1`);
  const markers = findDraftMarkers(html);
  expect(!markers.length, `${path} has draft markers: ${markers.join('; ')}`);
}

// 7. Every internal link resolves to a 200 page or file, or is a Short Link (301/302).
const notices = [];
const allLinks = new Map();
for (const [page, links] of Object.entries(linksFrom)) for (const link of links) allLinks.set(link, [...(allLinks.get(link) ?? []), page]);
await Promise.all([...allLinks.keys()].map((link) => fetchOnce(link)));
for (const [link, pages] of allLinks) {
  const { status } = await fetchOnce(link);
  const path = link.split('?')[0];
  if (status === 200 || ([301, 302].includes(status) && isShortLink(path))) { checks += 1; continue; }
  if (status === 404 && pending(path)) { notices.push(link); continue; }
  expect(false, `${link} (linked from ${pages.join(', ')}) returned ${status}`);
}

// 8. Basics.
expect((await get('/robots.txt')).status === 200, 'robots.txt missing');
expect((await get('/favicon.svg')).status === 200, 'favicon.svg missing');

console.log(`Smoke pages: ${Object.keys(pageHtml).sort().join(' ')}`);
if (notices.length) console.log(`Smoke notice: links to v1 pages not built yet (pending until listed in REQUIRED_PAGES): ${notices.sort().join(' ')}`);
if (failures.length) {
  console.error(`Smoke tests failed (${failures.length} of ${checks} checks) against ${base}:\n  ` + failures.join('\n  '));
  process.exit(1);
}
console.log(`Smoke tests passed: ${checks} checks on ${Object.keys(pageHtml).length} pages against ${base}.`);
