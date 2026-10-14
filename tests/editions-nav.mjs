// The header's "Past Editions" menu and the "More Editions" row at the end of each past page, on a running copy:
// - Contents: the panel's rows are the Past Editions the Editions page lists, newest first, each with its year, a
//   one-line note and a link that answers; then "All Editions" to /editions/. The phone menu has the same years and
//   "All Editions". No header link or phone menu entry says "2026 talks" (the header button may, in the Recap).
// - Using it: a click opens and closes it, and so do Enter and Space from the keyboard; once open, Tab moves
//   through its links in order.
// - Fit: at 900, 980, 1024 and 1280 px with a 17 px scrollbar, nothing scrolls sideways, the header's parts don't
//   overlap, the open panel is fully on screen and each of its rows takes one line. The theme switch keeps its
//   name at every width (tests/states-browser.mjs repeats the fit in every phase of the time machine).
// - Accessibility: axe with the panel open in light and dark at 1280 and 900 px, and with the phone menu open at
//   390 px; every phone menu link is 44 px or taller.
// - Where you are: on /2026/, /2025/ and /2024/ the panel's and the phone menu's link to that year has
//   aria-current="page", and "Past Editions" is underlined; on /editions/, "All Editions" is the current one.
// - The past pages each end with "More Editions": the other Past Editions, then "All Editions", in a labeled nav.
// Usage: node tests/editions-nav.mjs <baseUrl>
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
import { distPages } from './targets.mjs';

const base = (process.argv[2] ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const failures = [];
let checks = 0;
const expect = (ok, message) => { checks += 1; if (!ok) failures.push(message); };

// The Past Editions as the Editions page lists them (from src/data/editions.ts): year and link, in page order.
const editionsHtml = readFileSync('dist/editions/index.html', 'utf8');
const past = [...editionsHtml.matchAll(/<li class="ed">\s*<p class="ed-year"[^>]*>(\d{4})<\/p>[\s\S]*?<p class="ed-link"><a href="([^"]+)"/g)].map(([, year, href]) => ({ year, href }));
expect(past.length >= 3, `the Editions page lists ${past.length} Past Editions`);
expect(past.every((p, i) => i === 0 || Number(p.year) < Number(past[i - 1].year)), 'the Editions page lists the Past Editions out of order');
const pastPaths = past.map((p) => p.href);

// A browser that shows classic scrollbars, so a 17 px one takes its room as on Windows.
const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
const scrollbar = '::-webkit-scrollbar { width: 17px; height: 17px; } ::-webkit-scrollbar-thumb { background: #888; }';

async function open(path, { width = 1280, height = 900, scheme = 'light', bar = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, reducedMotion: 'reduce', bypassCSP: bar });
  const tab = await context.newPage();
  await tab.goto(base + path, { waitUntil: 'networkidle' });
  if (bar) await tab.addStyleTag({ content: scrollbar });
  return { context, tab };
}
async function axe(tab) {
  await tab.evaluate(axeSource);
  return tab.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return r.violations.map((v) => `${v.id} (${v.nodes.length}x): ${v.help} [${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')}]`);
  });
}
const isOpen = (tab) => tab.evaluate(() => document.querySelector('.pe').open);

try {
  // Contents, on every built page: the panel's rows, the phone menu's years, and no "2026 talks" in either list.
  for (const path of distPages()) {
    const html = await (await fetch(base + path)).text();
    const nav = html.match(/<nav class="nav" aria-label="Main">([\s\S]*?)<\/nav>/)?.[1] ?? '';
    const menu = html.match(/<nav class="menu-panel" aria-label="Main, phone">([\s\S]*?)<\/nav>/)?.[1] ?? '';
    const rows = [...nav.matchAll(/<li><a href="([^"]+)"[^>]*><b class="pe-year">(\d{4})<\/b> <span class="pe-line">([^<]+)<\/span><\/a><\/li>/g)].map(([, href, year, line]) => ({ href, year, line }));
    expect(rows.map((r) => `${r.year} ${r.href}`).join() === past.map((p) => `${p.year} ${p.href}`).join(), `${path}: the panel's rows are ${rows.map((r) => `${r.year} ${r.href}`).join(', ')}, not the Past Editions ${past.map((p) => p.year).join(', ')}`);
    expect(rows.every((r) => r.line.trim().length > 0), `${path}: a panel row has no line`);
    expect(/<a class="pe-all" href="\/editions\/"[^>]*>All Editions</.test(nav), `${path}: the panel has no "All Editions" link to /editions/`);
    const years = [...(menu.match(/<ul class="menu-years"[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? '').matchAll(/<a href="([^"]+)"[^>]*>(\d{4})<\/a>/g)].map(([, href, year]) => `${year} ${href}`);
    expect(years.join() === past.map((p) => `${p.year} ${p.href}`).join(), `${path}: the phone menu's years are ${years.join(', ')}`);
    expect(/<a class="menu-pe-all" href="\/editions\/"[^>]*>All Editions</.test(menu), `${path}: the phone menu has no "All Editions" link to /editions/`);
    const words = [...(nav + menu).matchAll(/>([^<]*)</g)].map((m) => m[1].trim());
    expect(!words.includes('2026 talks'), `${path}: the header's links or the phone menu still say "2026 talks"`);
  }
  // Every row's link answers.
  for (const href of [...pastPaths, '/editions/']) expect((await fetch(base + href)).ok, `${href}: doesn't answer`);

  // Using it: by click, then by keyboard (Enter and Space), and Tab through its links in order.
  {
    const { context, tab } = await open('/');
    const summary = tab.locator('.pe summary');
    await summary.click();
    expect(await isOpen(tab), 'a click doesn\'t open "Past Editions"');
    const shown = await tab.evaluate(() => [...document.querySelectorAll('.pe-panel a')].every((a) => a.getBoundingClientRect().height > 0));
    expect(shown, 'the open panel hides a link');
    await summary.click();
    expect(!(await isOpen(tab)), 'a second click doesn\'t close "Past Editions"');
    await summary.focus();
    for (const key of ['Enter', 'Space']) {
      await tab.keyboard.press(key);
      expect(await isOpen(tab), `${key} doesn't open "Past Editions"`);
      await tab.keyboard.press(key);
      expect(!(await isOpen(tab)), `${key} doesn't close "Past Editions"`);
    }
    // From the page's top: Tab reaches the summary after the lockup and the links before it.
    await tab.goto(base + '/', { waitUntil: 'networkidle' });
    let steps = 0;
    while (steps < 20 && !(await tab.evaluate(() => document.activeElement?.matches('.pe summary')))) { await tab.keyboard.press('Tab'); steps += 1; }
    expect(steps < 20, 'Tab never reaches "Past Editions"');
    if (steps < 20) await tab.keyboard.press('Enter');
    const want = await tab.evaluate(() => [...document.querySelectorAll('.pe-panel a')].map((a) => a.getAttribute('href')));
    const reached = [];
    for (const _ of want) { await tab.keyboard.press('Tab'); reached.push(await tab.evaluate(() => document.activeElement.getAttribute('href'))); }
    expect(reached.join() === want.join(), `Tab in the open panel reaches ${reached.join(', ')}, not ${want.join(', ')}`);
    await tab.keyboard.press('Tab');
    expect(await tab.evaluate(() => !document.activeElement.closest('.pe-panel')), 'Tab after the last panel link stays in the panel');
    // Picking a year opens its page, with the menu closed.
    if (!(await isOpen(tab))) await tab.locator('.pe summary').click();
    await Promise.all([tab.waitForURL(`**${pastPaths[1]}`), tab.locator(`.pe-panel a[href="${pastPaths[1]}"]`).click()]);
    expect(!(await isOpen(tab)), `${pastPaths[1]}: opens with "Past Editions" open`);
    await context.close();
  }

  // Fit, with a 17 px scrollbar: no sideways scroll, no overlap, the open panel on screen, rows on one line.
  for (const width of [900, 980, 1024, 1280]) {
    for (const path of ['/', pastPaths[0]]) {
      const { context, tab } = await open(path, { width, bar: true });
      const fit = () => tab.evaluate(() => {
        const cw = document.documentElement.clientWidth;
        const box = (s) => document.querySelector(s).getBoundingClientRect();
        const items = ['.lockup', '.nav', '.head-end'].map(box);
        const panel = document.querySelector('.pe[open] .pe-panel')?.getBoundingClientRect();
        const lines = (el) => { const r = document.createRange(); r.selectNodeContents(el); return new Set([...r.getClientRects()].filter((b) => b.width > 0).map((b) => Math.round(b.top))).size; };
        const theme = document.querySelector('.theme');
        return {
          cw,
          over: document.documentElement.scrollWidth - cw,
          overlap: items.some((a, i) => i > 0 && a.left < items[i - 1].right),
          end: items[2].right,
          panel: panel && { left: panel.left, right: panel.right, bottom: panel.bottom },
          // Each row's line on one line, inside the panel's border.
          wrapped: [...document.querySelectorAll('.pe[open] .pe-line')].filter((l) => lines(l) > 1 || l.getBoundingClientRect().right > panel.right - 2).map((l) => l.textContent.trim()),
          theme: theme.hidden ? 'hidden' : theme.textContent.replace(/\s+/g, ' ').trim(),
          word: getComputedStyle(theme.querySelector('.theme-word')).clipPath,
        };
      });
      const where = `${path} at ${width} px with a 17 px scrollbar`;
      const closed = await fit();
      expect(closed.cw === width - 17, `${where}: the page is ${closed.cw} px wide, not ${width - 17}`);
      expect(closed.over <= 0, `${where}: scrolls sideways by ${closed.over}px`);
      expect(!closed.overlap && closed.end <= closed.cw, `${where}: the header's parts overlap or end at ${closed.end}px`);
      expect(/theme\. Switch to (Dark|Light)$/.test(closed.theme), `${where}: the theme switch's name is "${closed.theme}"`);
      expect((width < 1024) === (closed.word !== 'none'), `${where}: the theme switch's word is ${closed.word === 'none' ? 'shown' : 'hidden'}`);
      await tab.locator('.pe summary').click();
      const opened = await fit();
      expect(opened.panel && opened.panel.left >= 0 && opened.panel.right <= opened.cw && opened.panel.bottom <= 900, `${where}: the open panel runs off screen (${JSON.stringify(opened.panel)})`);
      expect(!opened.wrapped.length, `${where}: panel rows wrap: ${opened.wrapped.join('; ')}`);
      expect(opened.over <= 0, `${where}: scrolls sideways by ${opened.over}px with the panel open`);
      await context.close();
    }
  }

  // axe with the panel open (1280 and 900 px) and with the phone menu open (390 px), light and dark; 44 px targets.
  for (const scheme of ['light', 'dark']) {
    for (const width of [1280, 900]) {
      const { context, tab } = await open('/', { width, scheme });
      await tab.locator('.pe summary').click();
      const v = await axe(tab);
      expect(!v.length, `/ at ${width} px ${scheme}, the panel open: axe: ${v.join('; ')}`);
      await context.close();
    }
    const { context, tab } = await open(pastPaths[1], { width: 390, height: 844, scheme });
    await tab.locator('.menu summary').click();
    const v = await axe(tab);
    expect(!v.length, `${pastPaths[1]} at 390 px ${scheme}, the menu open: axe: ${v.join('; ')}`);
    const small = await tab.evaluate(() => [...document.querySelectorAll('.menu-panel a')].filter((a) => a.getBoundingClientRect().height < 44).map((a) => `${a.textContent.trim()} (${a.getBoundingClientRect().height}px)`));
    expect(!small.length, `${pastPaths[1]} at 390 px: phone menu links under 44 px: ${small.join(', ')}`);
    const seen = await tab.evaluate(() => [...document.querySelectorAll('.menu-panel a')].every((a) => { const r = a.getBoundingClientRect(); return r.right <= innerWidth && r.left >= 0; }));
    expect(seen, `${pastPaths[1]} at 390 px: the open menu runs off screen`);
    await context.close();
  }

  // Where you are, in the header and the phone menu, and the "More Editions" row on each past page.
  for (const path of [...pastPaths, '/editions/', '/', '/about/']) {
    const { context, tab } = await open(path);
    const m = await tab.evaluate(() => {
      const underlined = (el) => getComputedStyle(el).textDecorationLine.includes('underline');
      const more = document.querySelector('nav.more-eds');
      return {
        panel: [...document.querySelectorAll('.pe-panel [aria-current="page"]')].map((a) => a.getAttribute('href')),
        menu: [...document.querySelectorAll('.menu-pe [aria-current="page"]')].map((a) => a.getAttribute('href')),
        summary: underlined(document.querySelector('.pe summary')),
        label: underlined(document.querySelector('.menu-pe-label')),
        other: [...document.querySelectorAll('.nav > ul > li > a[aria-current], .menu-panel > ul > li > a[aria-current]:not(.menu-pe-all)')].map((a) => a.textContent.trim()),
        more: more && {
          name: document.getElementById(more.getAttribute('aria-labelledby'))?.textContent.trim(),
          links: [...more.querySelectorAll('a')].map((a) => a.getAttribute('href')),
          last: !more.nextElementSibling && more.parentElement.matches('article'),
        },
      };
    });
    const here = path === '/editions/' || pastPaths.includes(path) ? [path] : [];
    expect(m.panel.join() === here.join(), `${path}: the panel marks ${m.panel.join(', ') || 'nothing'} as the current page`);
    expect(m.menu.join() === here.join(), `${path}: the phone menu marks ${m.menu.join(', ') || 'nothing'} as the current page`);
    expect(m.summary === (here.length > 0), `${path}: "Past Editions" is ${m.summary ? '' : 'not '}underlined`);
    expect(m.label === (here.length > 0), `${path}: the phone menu's "Past Editions" is ${m.label ? '' : 'not '}underlined`);
    expect(!m.other.length || path === '/about/', `${path}: other header links are marked current: ${m.other.join(', ')}`);
    if (pastPaths.includes(path)) {
      const want = [...pastPaths.filter((p) => p !== path), '/editions/'];
      expect(m.more && m.more.name === 'More Editions' && m.more.links.join() === want.join() && m.more.last, `${path}: the "More Editions" row is ${JSON.stringify(m.more)}, not ${want.join(', ')} at the page's end`);
    } else {
      expect(!m.more, `${path}: has a "More Editions" row`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`Past Editions menu check failed (${failures.length} of ${checks}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`Past Editions menu check passed: ${checks} checks against ${base}.`);
