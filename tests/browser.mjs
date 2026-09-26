// Browser tests against a running site: zero data (no cookies, no storage,
// no third-party requests), no CSP violations or script errors, no
// horizontal scrolling on phones, and no WCAG 2.2 AA violations (axe-core),
// in light and dark mode on desktop and mobile. Saves full-page screenshots.
//
// Usage: node tests/browser.mjs [baseUrl] [--shots <dir>]
// Browser: $CDP_URL if set, else Playwright's Chromium, else the snap Chromium.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const shotsIndex = argv.indexOf('--shots');
const shotsDir = shotsIndex >= 0 ? argv[shotsIndex + 1] : null;
const base = (argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--shots') ?? process.env.BASE_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
const origin = new URL(base).origin;
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const PAGES = [
  { name: 'home', path: '/' },
  { name: '404', path: '/this-page-does-not-exist' },
];
const MODES = [
  { name: 'desktop-light', viewport: { width: 1280, height: 900 }, colorScheme: 'light' },
  { name: 'desktop-dark', viewport: { width: 1280, height: 900 }, colorScheme: 'dark' },
  { name: 'mobile-light', viewport: { width: 390, height: 844 }, colorScheme: 'light', isMobile: true },
  { name: 'mobile-dark', viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true },
];

async function waitFor(url, attempts = 50) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function getBrowser() {
  if (process.env.CDP_URL) return { browser: await chromium.connectOverCDP(process.env.CDP_URL), stop: () => {} };
  try {
    return { browser: await chromium.launch(), stop: () => {} };
  } catch {
    // Fall back to the system (snap) Chromium, driven over the DevTools protocol.
  }
  const snap = '/snap/bin/chromium';
  if (!existsSync(snap)) throw new Error('No Chromium found. Set CDP_URL or install Playwright browsers.');
  // Port 0 lets Chromium pick a free port and write it to DevToolsActivePort in its
  // own profile. Reading it from there guarantees we drive the browser we started,
  // never something else that happens to listen on a fixed port (an SSH tunnel, say).
  const profile = join(homedir(), 'snap/chromium/common/kcd-test-profile');
  const portFile = join(profile, 'DevToolsActivePort');
  rmSync(portFile, { force: true });
  const child = spawn(snap, [
    '--headless=new', '--remote-debugging-port=0', '--no-sandbox', '--disable-gpu',
    '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore', detached: true });
  const stop = () => { try { process.kill(-child.pid); } catch {} };
  let port = null;
  for (let i = 0; i < 100 && !port; i += 1) {
    if (existsSync(portFile)) port = readFileSync(portFile, 'utf8').split('\n')[0].trim() || null;
    if (!port) await new Promise((r) => setTimeout(r, 100));
  }
  if (!port) {
    stop();
    throw new Error('Chromium did not report a DevTools port');
  }
  await waitFor(`http://127.0.0.1:${port}/json/version`);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  return { browser, stop };
}

const failures = [];
let checks = 0;
const fail = (message) => failures.push(message);

const { browser, stop } = await getBrowser();
try {
  if (shotsDir) mkdirSync(shotsDir, { recursive: true });

  for (const page of PAGES) {
    for (const mode of MODES) {
      const label = `${page.name} ${mode.name}`;
      const contextOptions = { viewport: mode.viewport, colorScheme: mode.colorScheme, isMobile: mode.isMobile ?? false };

      // Strict pass: the page as visitors get it, with the CSP enforced.
      const context = await browser.newContext(contextOptions);
      const tab = await context.newPage();
      const problems = [];
      const foreign = new Set();
      tab.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        // The 404 page itself is served with status 404, and Chrome logs that. Expected.
        const selfNotFound = page.name === '404' && msg.text().includes('status of 404') && msg.location().url === base + page.path;
        if (!selfNotFound) problems.push(msg.text());
      });
      tab.on('pageerror', (err) => problems.push(err.message));
      tab.on('request', (req) => { if (new URL(req.url()).origin !== origin && !req.url().startsWith('data:')) foreign.add(req.url()); });
      await tab.addInitScript(() => {
        window.__csp = [];
        document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
      });
      await tab.goto(base + page.path, { waitUntil: 'networkidle' });

      const state = await tab.evaluate(() => ({
        cookie: document.cookie,
        localStorage: localStorage.length,
        sessionStorage: sessionStorage.length,
        csp: window.__csp,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      }));
      checks += 6;
      const cookies = await context.cookies();
      if (cookies.length || state.cookie) fail(`${label}: cookies set: ${cookies.map((c) => c.name).join(', ') || state.cookie}`);
      if (state.localStorage || state.sessionStorage) fail(`${label}: browser storage used`);
      if (state.csp.length) fail(`${label}: CSP violations: ${state.csp.join('; ')}`);
      if (problems.length) fail(`${label}: console errors: ${problems.join(' | ')}`);
      if (foreign.size) fail(`${label}: requests to other hosts: ${[...foreign].join(', ')}`);
      if (state.overflow > 1) fail(`${label}: page scrolls sideways by ${state.overflow}px`);

      if (shotsDir) writeFileSync(join(shotsDir, `${page.name}-${mode.name}.png`), await tab.screenshot({ fullPage: true }));
      await context.close();

      // Audit pass: axe-core needs to inject a script, so this context bypasses the CSP.
      const auditContext = await browser.newContext({ ...contextOptions, bypassCSP: true });
      const audit = await auditContext.newPage();
      await audit.goto(base + page.path, { waitUntil: 'networkidle' });
      await audit.addScriptTag({ content: axeSource });
      const violations = await audit.evaluate(async () => {
        const result = await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
        });
        return result.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length}x): ${v.help}`);
      });
      checks += 1;
      if (violations.length) fail(`${label}: accessibility: ${violations.join(' | ')}`);
      await auditContext.close();
    }
  }
} finally {
  await browser.close().catch(() => {});
  stop();
}

if (failures.length) {
  console.error(`Browser tests failed (${failures.length} of ${checks} checks) against ${base}:\n  ` + failures.join('\n  '));
  process.exit(1);
}
console.log(`Browser tests passed: ${checks} checks against ${base}` + (shotsDir ? `, screenshots in ${shotsDir}` : '') + '.');
