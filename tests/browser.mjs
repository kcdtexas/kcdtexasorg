// Browser tests against a running site, on every page built in dist/ (each
// index.html, plus the 404 page at a missing path): zero data (no cookies, no
// storage, no third-party requests), no CSP violations or script errors, no
// horizontal scrolling on phones 360 and 390 px wide, and no WCAG 2.2 AA
// violations (axe-core), in light and dark mode on desktop and mobile, with
// and without a stored theme. Saves full-page screenshots with --shots.
// Then the theme switch on the home page: the visitor's stored choice wins over
// the device scheme, is applied before first paint, and works by keyboard and
// without JS. Last, the key dates: NOW and the fills on ten days (clock fixed), and the
// phase rail's layout from 1440 down to 360 px.
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

      // Phones as narrow as 360 px (the modes above use 390 px), and 320 px for reflow (WCAG 1.4.10).
      if (mode.isMobile) {
        for (const narrow of [360, 320]) {
          await tab.setViewportSize({ width: narrow, height: mode.viewport.height });
          const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(overflow <= 1, `${label}: page scrolls sideways by ${overflow}px at ${narrow}px`);
        }
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

  // The key dates' phase rail follows today between builds (/now.js, the owner's A50): NOW sits on today, the
  // running phases fill up to it and a finished fill turns grey, Event Day keeps only the tag, and from Apr 24
  // there is no NOW. The clock is fixed at noon Central.
  const at = (day) => Date.parse(`${day}T12:00:00Z`);
  for (const day of ['2026-10-10', '2026-11-10', '2026-12-10', '2027-01-10', '2027-02-10', '2027-03-10', '2027-04-10', '2027-04-23', '2027-04-24', '2027-05-02']) {
    const label = `key dates on ${day}`;
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
    const tab = await context.newPage();
    const problems = await watch(tab);
    await tab.clock.setFixedTime(new Date(`${day}T18:00:00Z`));
    await tab.goto(base + '/', { waitUntil: 'networkidle' });
    const state = await tab.evaluate(() => {
      const pr = document.querySelector('[data-pr]');
      const now = document.querySelector('.pr-over .pr-now');
      const cfp = document.querySelector('.pr-lane--cfp rect.pr-done');
      return {
        start: pr?.dataset.start, end: pr?.dataset.end, nows: document.querySelectorAll('.pr-now').length,
        x: now?.getAttribute('x') ?? null, atEvent: now?.classList.contains('at-event') ?? null,
        from: cfp?.dataset.from, to: cfp?.dataset.to, width: cfp?.getAttribute('width'), past: cfp?.classList.contains('is-past'),
      };
    });
    const pct = (d) => Math.min(100, Math.max(0, ((at(d) - at(state.start)) / (at(state.end) - at(state.start))) * 100));
    const today = pct(day);
    if (day <= '2027-04-23') {
      expect(state.x !== null && Math.abs(parseFloat(state.x) - today) <= 0.1, `${label}: NOW at ${state.x}, expected ${today.toFixed(2)}%`);
      expect(state.atEvent === (day === '2027-04-23'), `${label}: at-event is ${state.atEvent}`);
    } else {
      expect(state.nows === 0, `${label}: ${state.nows} NOW marks still in the page`);
    }
    const width = Math.max(0, Math.min(today, pct(state.to)) - pct(state.from));
    expect(state.width && Math.abs(parseFloat(state.width) - width) <= 0.1, `${label}: the CFP fill is ${state.width} wide, expected ${width.toFixed(2)}%`);
    expect(state.past === (day >= '2027-02-01'), `${label}: the CFP fill's is-past is ${state.past}`);
    const seen = await problems();
    expect(!seen.length, `${label}: errors or CSP violations: ${seen.join(' | ')}`);
    await context.close();
  }

  // The phase rail's layout on today's build: the NOW line never crosses text (month names may sit over it), no
  // two text boxes overlap, phones swap the shared calendar for a NOW tick on each row, and nothing scrolls
  // sideways. In the CFP Phase the hero has exactly one filled button (Sponsor). "Key dates" uses the section title
  // size, the hero bill's notes and link never overlap or overflow, and the header's button stays on screen with
  // every nav link on one line.
  // While it says "Sponsor", "Sponsor" shows once in the header, and the phone menu lists every link.
  for (const width of [1440, 1280, 1100, 900, 768, 600, 390, 360, 320]) {
    const label = `key dates at ${width}`;
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'light', isMobile: width <= 390 });
    const tab = await context.newPage();
    await tab.goto(base + '/', { waitUntil: 'networkidle' });
    const layout = await tab.evaluate(() => {
      const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden'; };
      const boxes = [...document.querySelectorAll('.dates .it-name, .dates .pr-when, .dates .it-st, .dates .it-dt, .dates .pr-tix-line')].filter(shown);
      const meet = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      const name = (el) => `${el.className} "${el.textContent.trim().slice(0, 24)}"`;
      const line = document.querySelector('.pr-over .pr-now-line');
      // An SVG line's box has no width; give it the 3 px of its stroke.
      const lineRect = line && getComputedStyle(line.closest('.pr-over')).display !== 'none' ? line.getBoundingClientRect() : null;
      const lineBox = lineRect && lineRect.height > 0 ? { left: lineRect.left - 1.5, right: lineRect.right + 1.5, top: lineRect.top, bottom: lineRect.bottom } : null;
      const overlaps = [];
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          if (boxes[i].contains(boxes[j]) || boxes[j].contains(boxes[i])) continue;
          if (meet(boxes[i].getBoundingClientRect(), boxes[j].getBoundingClientRect())) overlaps.push(`${name(boxes[i])} / ${name(boxes[j])}`);
        }
      }
      const hero = [...document.querySelectorAll('.hero .btn')].filter(shown);
      const bill = [...document.querySelectorAll('.slots .note, .slots .eu-label')].filter(shown);
      const billOverlaps = [];
      for (let i = 0; i < bill.length; i += 1) {
        for (let j = i + 1; j < bill.length; j += 1) {
          for (const a of bill[i].getClientRects()) for (const b of bill[j].getClientRects()) if (meet(a, b)) billOverlaps.push(`${name(bill[i])} / ${name(bill[j])}`);
        }
      }
      const slots = document.querySelector('.slots');
      const range = document.createRange();
      range.selectNodeContents(slots);
      const used = [...range.getClientRects()];
      const cta = document.querySelector('.head-cta').getBoundingClientRect();
      return {
        titleSize: [getComputedStyle(document.querySelector('#dates-title')).fontSize, getComputedStyle(document.querySelector('#stage-title')).fontSize],
        billOverlaps: [...new Set(billOverlaps)],
        billOverflow: Math.max(slots.getBoundingClientRect().left - Math.min(...used.map((r) => r.left)), Math.max(...used.map((r) => r.right)) - slots.getBoundingClientRect().right),
        cta: { right: cta.right, height: cta.height },
        // A nav link on two lines (one line is about 48 px with its padding).
        navWrapped: [...document.querySelectorAll('.nav a')].filter((a) => shown(a) && a.getBoundingClientRect().height > 60).map((a) => a.textContent),
        // While the button says "Sponsor", the wide nav drops its own Sponsor link; the phone menu keeps every link.
        ctaLabel: document.querySelector('.head-cta').textContent.trim(),
        navShown: [...document.querySelectorAll('.nav a')].some(shown),
        sponsorShown: [...document.querySelectorAll('.site-header .nav a, .site-header .head-cta')].filter((a) => shown(a) && a.textContent.trim() === 'Sponsor').length,
        menuLinks: [...document.querySelectorAll('.menu-panel a')].map((a) => a.textContent.trim()),
        // The hero shows its talk door only in the CFP Phase.
        cfp: Boolean(document.querySelector('.hero .btn[href="/2027/cfp/"]')),
        overlaps,
        crossed: lineBox ? boxes.filter((b) => meet(b.getBoundingClientRect(), lineBox)).map(name) : [],
        line: Boolean(lineBox),
        overlay: getComputedStyle(document.querySelector('.pr-over')).display,
        lanes: document.querySelectorAll('.pr-lane').length,
        ticks: [...document.querySelectorAll('.pr-now--tick')].filter((t) => getComputedStyle(t).display !== 'none' && t.getBoundingClientRect().height > 0).length,
        filled: hero.filter((b) => !/rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(b).backgroundColor)).map((b) => b.textContent.trim()),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    if (width >= 768) {
      expect(layout.line, `${label}: no NOW line on the shared calendar`);
      expect(!layout.crossed.length, `${label}: the NOW line crosses ${layout.crossed.join(', ')}`);
    }
    if (width === 390) {
      expect(layout.overlay === 'none', `${label}: the shared calendar shows on a phone (display ${layout.overlay})`);
      expect(layout.ticks === layout.lanes, `${label}: ${layout.ticks} NOW ticks show for ${layout.lanes} rows`);
    }
    if (width > 360) expect(!layout.overlaps.length, `${label}: text overlaps: ${layout.overlaps.join('; ')}`);
    expect(layout.titleSize[0] === layout.titleSize[1], `${label}: "Key dates" is ${layout.titleSize[0]}, the section titles ${layout.titleSize[1]}`);
    expect(!layout.billOverlaps.length, `${label}: the hero bill overlaps: ${layout.billOverlaps.join('; ')}`);
    expect(layout.billOverflow <= 1, `${label}: the hero bill runs ${layout.billOverflow.toFixed(1)}px past its measure`);
    expect(layout.cta.right <= width && layout.cta.height >= 44, `${label}: the header button ends at ${layout.cta.right}px, ${layout.cta.height}px tall`);
    expect(!layout.navWrapped.length, `${label}: header links wrap: ${layout.navWrapped.join(', ')}`);
    if (layout.navShown && layout.ctaLabel === 'Sponsor') expect(layout.sponsorShown === 1, `${label}: "Sponsor" shows ${layout.sponsorShown} times in the header`);
    expect(layout.menuLinks.join() === 'Speak,Sponsor,Attend,2026 talks,About', `${label}: the phone menu lists ${layout.menuLinks.join(', ')}`);
    if (layout.cfp) expect(layout.filled.length === 1, `${label}: ${layout.filled.length} filled buttons in the hero (${layout.filled.join(', ')})`);
    if (width <= 1100) expect(layout.overflow <= 1, `${label}: page scrolls sideways by ${layout.overflow}px`);
    await context.close();
  }

  // The speak band in dark: a raised dark surface whose text and buttons pass axe's contrast check.
  {
    const label = 'speak band in dark';
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
    const tab = await context.newPage();
    await tab.goto(base + '/', { waitUntil: 'networkidle' });
    await tab.evaluate(axeSource);
    const result = await tab.evaluate(async () => {
      const r = await window.axe.run({ include: [['.speak']] }, { runOnly: { type: 'rule', values: ['color-contrast'] } });
      return { violations: r.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' '))), passes: r.passes.reduce((n, v) => n + v.nodes.length, 0), band: getComputedStyle(document.querySelector('.speak')).backgroundColor };
    });
    expect(!result.violations.length, `${label}: contrast fails on ${result.violations.join(', ')}`);
    expect(result.passes > 10, `${label}: axe checked only ${result.passes} nodes`);
    expect(result.band === 'rgb(34, 38, 34)', `${label}: the band is ${result.band}, not the raised dark surface`);
    await context.close();
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
