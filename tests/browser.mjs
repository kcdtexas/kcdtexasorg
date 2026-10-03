// Browser tests against a running site, on every page built in dist/ (each
// index.html, plus the 404 page at a missing path): zero data (no cookies, no
// storage, no third-party requests), no CSP violations or script errors, no
// horizontal scrolling on phones 360 and 390 px wide, and no WCAG 2.2 AA
// violations (axe-core), in light and dark mode on desktop and mobile, with
// and without a stored theme. Saves full-page screenshots with --shots.
// Then the theme switch on the home page: the visitor's stored choice wins over
// the device scheme, is applied before first paint, and works by keyboard and
// without JS.
//
// Usage: node tests/browser.mjs [baseUrl] [--shots <dir>]
// Pages run in parallel, $BROWSER_JOBS at a time (default 4).
// Browser: $CDP_URL if set, else Playwright's Chromium, else the snap Chromium.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';

const argv = process.argv.slice(2);
const shotsIndex = argv.indexOf('--shots');
const shotsDir = shotsIndex >= 0 ? argv[shotsIndex + 1] : null;
const base = (argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--shots') ?? process.env.BASE_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
const origin = new URL(base).origin;
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

// The pages: every index.html in dist/, plus the 404 page at a path that doesn't exist.
const DIST = process.env.DIST ?? 'dist';
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/ is missing. Run scripts/build.sh first.');
const PAGES = [
  ...walk(DIST)
    .filter((f) => f.endsWith(`${sep}index.html`) || f === join(DIST, 'index.html'))
    .map((f) => '/' + relative(DIST, f).split(sep).slice(0, -1).map((p) => p + '/').join(''))
    .sort()
    .map((path) => ({ name: path === '/' ? 'home' : path.slice(1, -1).replaceAll('/', '-'), path })),
  ...(existsSync(join(DIST, '404.html')) ? [{ name: '404', path: '/this-page-does-not-exist' }] : []),
];
const JOBS = Math.max(1, Number(process.env.BROWSER_JOBS) || 4);
const LIGHT_BG = 'rgb(255, 255, 255)';
const DARK_BG = 'rgb(18, 20, 18)'; // #121412
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
const expect = (ok, message) => { checks += 1; if (!ok) fail(message); };

// Starts the browser with a theme already stored, the way a returning visitor
// arrives. The init script runs before every navigation, so use it only for
// visits where a reload must not change the stored value.
const storeTheme = (theme) => { try { localStorage.setItem('theme', theme); } catch {} };

// Runs axe-core on the open tab. It is evaluated through DevTools, which the
// page's CSP doesn't block, so the audit runs on the page as visitors get it.
async function axe(tab) {
  await tab.evaluate(axeSource);
  return tab.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    });
    return result.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length}x): ${v.help}`);
  });
}

// The color the visitor sees behind the page: body's background, or html's when
// body is transparent.
function pageBackground(tab) {
  return tab.evaluate(() => {
    const body = getComputedStyle(document.body).backgroundColor;
    return body === 'rgba(0, 0, 0, 0)' ? getComputedStyle(document.documentElement).backgroundColor : body;
  });
}

// Records CSP violations, console errors and script errors on a tab.
async function watch(tab) {
  const problems = [];
  tab.on('console', (msg) => { if (msg.type() === 'error') problems.push(msg.text()); });
  tab.on('pageerror', (err) => problems.push(err.message));
  await tab.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  return async () => [...problems, ...(await tab.evaluate(() => window.__csp)).map((v) => `CSP ${v}`)];
}

// What the switch currently shows and what the page stores.
function switchState(tab) {
  return tab.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    stored: localStorage.getItem('theme'),
    word: document.querySelector('.theme-word').textContent.trim(),
    now: document.querySelector('[data-theme-toggle]').dataset.now,
    themeColor: [...document.querySelectorAll('meta[name=theme-color]')].map((m) => m.content),
  }));
}

const { browser, stop } = await getBrowser();
try {
  if (shotsDir) mkdirSync(shotsDir, { recursive: true });

  // Every page, $BROWSER_JOBS pages at a time. Each page's checks run in order.
  async function checkPage(page) {
    for (const mode of MODES) {
      const label = `${page.name} ${mode.name}`;
      const context = await browser.newContext({ viewport: mode.viewport, colorScheme: mode.colorScheme, isMobile: mode.isMobile ?? false });
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
      if (state.overflow > 1) fail(`${label}: page scrolls sideways by ${state.overflow}px at ${mode.viewport.width}px`);

      if (shotsDir) writeFileSync(join(shotsDir, `${page.name}-${mode.name}.png`), await tab.screenshot({ fullPage: true }));

      const violations = await axe(tab);
      expect(!violations.length, `${label}: accessibility: ${violations.join(' | ')}`);

      // Phones as narrow as 360 px (the modes above use 390 px).
      if (mode.isMobile) {
        await tab.setViewportSize({ width: 360, height: mode.viewport.height });
        const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow <= 1, `${label}: page scrolls sideways by ${overflow}px at 360px`);
      }
      await context.close();
    }

    // Axe and contrast with the visitor's choice overriding the device: a stored
    // theme puts data-theme on <html>, a different CSS path from the media query.
    for (const [device, stored] of [['light', 'dark'], ['dark', 'light']]) {
      for (const mode of MODES.filter((m) => m.colorScheme === device)) {
        const label = `${page.name} ${mode.name}, stored ${stored}`;
        const context = await browser.newContext({ viewport: mode.viewport, colorScheme: device, isMobile: mode.isMobile ?? false });
        await context.addInitScript(storeTheme, stored);
        const tab = await context.newPage();
        await tab.goto(base + page.path, { waitUntil: 'networkidle' });
        expect(await pageBackground(tab) === (stored === 'dark' ? DARK_BG : LIGHT_BG), `${label}: stored theme not applied`);
        const violations = await axe(tab);
        expect(!violations.length, `${label}: accessibility: ${violations.join(' | ')}`);
        await context.close();
      }
    }
  }
  const queue = [...PAGES];
  await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
    while (queue.length) await checkPage(queue.shift());
  }));

  // The theme switch, on the home page at both widths.
  for (const mode of MODES.filter((m) => m.colorScheme === 'light')) {
    const width = mode.name.split('-')[0];
    const options = { viewport: mode.viewport, isMobile: mode.isMobile ?? false };
    const home = base + '/';

    // a, b, g, h. It toggles, remembers the choice, and stays clean.
    {
      const label = `switch ${width}`;
      const context = await browser.newContext({ ...options, colorScheme: 'light' });
      const tab = await context.newPage();
      const problems = await watch(tab);
      await tab.goto(home, { waitUntil: 'networkidle' });
      const button = tab.locator('[data-theme-toggle]');

      await button.click();
      let state = await switchState(tab);
      expect(state.attr === 'dark' && state.stored === 'dark', `${label}: choosing dark gave data-theme=${state.attr}, stored=${state.stored}`);
      expect(await pageBackground(tab) === DARK_BG, `${label}: background not dark after choosing dark`);
      expect(state.word === 'Light' && state.now === 'dark', `${label}: switch says "${state.word}" (now=${state.now}) after choosing dark`);
      expect(state.themeColor.every((c) => c === '#121412'), `${label}: theme-color not dark: ${state.themeColor}`);
      expect(await tab.locator('.theme-status').textContent() === 'Dark theme on', `${label}: status not announced`);

      await tab.reload({ waitUntil: 'networkidle' });
      state = await switchState(tab);
      expect(state.attr === 'dark' && await pageBackground(tab) === DARK_BG, `${label}: dark not remembered after reload`);

      // Back to light, which is the device's own scheme: nothing should stay stored.
      await button.click();
      state = await switchState(tab);
      expect(state.attr === null && state.stored === null, `${label}: choosing the device scheme left data-theme=${state.attr}, stored=${state.stored}`);
      expect(await pageBackground(tab) === LIGHT_BG, `${label}: background not light after switching back`);
      expect(state.word === 'Dark', `${label}: switch says "${state.word}" after switching back`);

      const footer = await tab.locator('footer').innerText();
      expect(/sets no cookies/.test(footer), `${label}: footer no longer says it sets no cookies`);
      expect(!(await context.cookies()).length, `${label}: cookies set after toggling`);
      const seen = await problems();
      expect(!seen.length, `${label}: errors or CSP violations: ${seen.join(' | ')}`);
      await context.close();
    }

    // c. With nothing stored it follows the device, live.
    {
      const label = `switch ${width} follows device`;
      const context = await browser.newContext({ ...options, colorScheme: 'dark' });
      const tab = await context.newPage();
      await tab.goto(home, { waitUntil: 'networkidle' });
      let state = await switchState(tab);
      expect(await pageBackground(tab) === DARK_BG && state.attr === null, `${label}: dark device gave data-theme=${state.attr}, background ${await pageBackground(tab)}`);
      expect(state.word === 'Light', `${label}: switch says "${state.word}" on a dark device`);
      await tab.emulateMedia({ colorScheme: 'light' });
      // CSS follows at once, but the media "change" event that updates the label
      // fires in the next rendering step, so give it a moment.
      await tab.waitForFunction(() => document.querySelector('.theme-word').textContent.trim() === 'Dark', null, { timeout: 2000 }).catch(() => {});
      state = await switchState(tab);
      expect(await pageBackground(tab) === LIGHT_BG, `${label}: background did not follow the device to light`);
      expect(state.word === 'Dark' && state.now === 'light', `${label}: switch says "${state.word}" after the device turned light`);
      await context.close();
    }

    // d. No flash of the wrong theme. Two checks, because the stylesheet may not
    // have loaded when the first nodes are parsed:
    //   - data-theme must already be on <html> when <body> is inserted, so no
    //     body content can ever render without it. Mutation records arrive in
    //     order, so we watch both the attribute and the insertion and compare.
    //   - the background at the first animation frame (just before first paint;
    //     Chromium holds frames until render-blocking CSS has loaded) is already
    //     the stored theme's, and data-theme is set at DOMContentLoaded. (Over a
    //     real network DOMContentLoaded can fire before the stylesheet arrives, so
    //     the background there may still be unstyled; nothing paints until then.)
    for (const [device, stored, expected] of [['light', 'dark', DARK_BG], ['dark', 'light', LIGHT_BG]]) {
      const label = `switch ${width} first paint, ${device} device, stored ${stored}`;
      const context = await browser.newContext({ ...options, colorScheme: device });
      await context.addInitScript(storeTheme, stored);
      const tab = await context.newPage();
      await tab.addInitScript(() => {
        const paint = (window.__paint = {});
        const background = () => getComputedStyle(document.body ?? document.documentElement).backgroundColor;
        let themed = false;
        new MutationObserver((records, observer) => {
          for (const r of records) {
            if (r.type === 'attributes' && r.target === document.documentElement && r.target.hasAttribute('data-theme')) themed = true;
            if (r.type === 'childList' && [...r.addedNodes].some((n) => n.nodeName === 'BODY')) {
              paint.themedBeforeBody = themed;
              observer.disconnect();
              return;
            }
          }
        }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-theme'] });
        requestAnimationFrame(() => { paint.firstFrame = background(); });
        document.addEventListener('DOMContentLoaded', () => { paint.domReady = document.documentElement.dataset.theme; });
      });
      await tab.goto(base + '/', { waitUntil: 'networkidle' });
      const paint = await tab.evaluate(() => window.__paint);
      expect(paint.themedBeforeBody === true, `${label}: <body> was parsed before data-theme was set`);
      expect(paint.firstFrame === expected, `${label}: first frame background ${paint.firstFrame}, expected ${expected}`);
      expect(paint.domReady === stored, `${label}: data-theme at DOMContentLoaded is ${paint.domReady}, expected ${stored}`);
      await context.close();
    }

    // e. Keyboard: reachable with Tab, toggles with Enter and Space, named by its
    // visible word, and a 44x44 px target (WCAG 2.5.5 / 2.5.8).
    {
      const label = `switch ${width} keyboard`;
      const context = await browser.newContext({ ...options, colorScheme: 'light' });
      const tab = await context.newPage();
      await tab.goto(home, { waitUntil: 'networkidle' });
      let reached = false;
      for (let i = 0; i < 40 && !reached; i += 1) {
        await tab.keyboard.press('Tab');
        reached = await tab.evaluate(() => document.activeElement?.matches('[data-theme-toggle]') ?? false);
      }
      expect(reached, `${label}: not reachable with Tab`);
      if (reached) {
        await tab.keyboard.press('Enter');
        expect((await switchState(tab)).attr === 'dark', `${label}: Enter did not switch to dark`);
        await tab.keyboard.press('Space');
        expect((await switchState(tab)).attr === null, `${label}: Space did not switch back`);
      }
      const button = tab.locator('[data-theme-toggle]');
      const word = (await tab.locator('.theme-word').textContent()).trim();
      const name = (await button.ariaSnapshot()).match(/button "(.*)"/)?.[1] ?? '';
      expect(name.includes(word), `${label}: accessible name "${name}" lacks the visible word "${word}"`);
      const box = await button.boundingBox();
      expect(box && box.width >= 44 && box.height >= 44, `${label}: target is ${box?.width}x${box?.height} px`);
      await context.close();
    }

    // f. Without JavaScript the switch can't work, so it stays hidden, and the
    // CSS alone still follows the device.
    {
      const label = `switch ${width} without JavaScript`;
      const context = await browser.newContext({ ...options, colorScheme: 'dark', javaScriptEnabled: false });
      const tab = await context.newPage();
      await tab.goto(home, { waitUntil: 'networkidle' });
      expect(!(await tab.locator('[data-theme-toggle]').isVisible()), `${label}: switch is visible`);
      expect(await pageBackground(tab) === DARK_BG, `${label}: dark device got background ${await pageBackground(tab)}`);
      await context.close();
    }
  }
} finally {
  await browser.close().catch(() => {});
  stop();
}

if (failures.length) {
  console.error(`Browser tests failed (${failures.length} of ${checks} checks) against ${base}:\n  ` + failures.sort().join('\n  '));
  process.exit(1);
}
console.log(`Browser tests passed: ${checks} checks on ${PAGES.length} pages (${PAGES.map((p) => p.path).join(' ')}) against ${base}` + (shotsDir ? `, screenshots in ${shotsDir}` : '') + '.');
