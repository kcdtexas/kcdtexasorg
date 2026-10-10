// Tap targets: every link and button in the header and in main is at least 44 px tall (the project's bar; WCAG
// 2.2's minimum is 24), and an icon-only one (no words on screen) is 44 px wide too. Checked at 390 and 1280 px on
// every page, with the phone menu open at 390.
//
// The exception, as in WCAG's: a link inside running text. It is display: inline and its block has words outside
// it, so its height is the line's. Links that stand alone (a "more" link, a key date's link, a lone mail address)
// are checked like buttons.
//
// tests/browser.mjs runs it on the build under test; tests/states-browser.mjs runs it on every time-machine build.
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const MIN = 44;
export const WIDTHS = [390, 1280];

/** Every page in dist/: each index.html, plus the 404 page at a missing path. */
export function distPages(dist = 'dist') {
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  return [
    ...walk(dist)
      .filter((f) => f.endsWith(`${sep}index.html`))
      .map((f) => '/' + relative(dist, f).split(sep).slice(0, -1).map((p) => p + '/').join(''))
      .sort(),
    ...(existsSync(join(dist, '404.html')) ? ['/this-page-does-not-exist'] : []),
  ];
}

/** Measures the open tab: the targets that are too small, and the links in running text that are exempt. */
export function measureTargets(tab, min = MIN) {
  return tab.evaluate((min) => {
    const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden'; };
    const words = (s) => s.replace(/[\s→↗↓·,.:;()–—-]+/g, '');
    const blockOf = (el) => { let b = el.parentElement; while (b && getComputedStyle(b).display.startsWith('inline')) b = b.parentElement; return b; };
    // In running text: inline, and its block has words outside every link in it.
    const inText = (el) => {
      if (getComputedStyle(el).display !== 'inline') return false;
      const block = blockOf(el);
      const copy = block.cloneNode(true);
      copy.querySelectorAll('a, button, .sr-only, [aria-hidden="true"]').forEach((n) => n.remove());
      return words(copy.textContent).length > 0;
    };
    const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} "${(el.textContent.replace(/\s+/g, ' ').trim() || el.getAttribute('aria-label') || '').slice(0, 50)}"`;
    const small = [];
    const exempt = [];
    for (const el of document.querySelectorAll('.site-header a, .site-header button, .site-header summary, main a, main button, main summary')) {
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      const iconOnly = !words([...el.childNodes].map((n) => (n.nodeType === 3 || (n.nodeType === 1 && shown(n) && !n.matches('.sr-only')) ? n.textContent : '')).join(''));
      if (r.height >= min - 0.01 && (!iconOnly || r.width >= min - 0.01)) continue;
      if (inText(el)) exempt.push(label(el));
      else small.push(`${label(el)} ${r.width.toFixed(1)}×${r.height.toFixed(1)}`);
    }
    return { small, exempt };
  }, min);
}

/** Runs the check on `paths` at both widths, with the clock at noon Central on `day` if given. */
export async function targetChecks(browser, base, paths, day) {
  const failures = new Set();
  const exempt = new Set();
  let checks = 0;
  const context = await browser.newContext({ colorScheme: 'light' });
  const tab = await context.newPage();
  if (day) await tab.clock.setFixedTime(new Date(`${day}T18:00:00Z`));
  for (const width of WIDTHS) {
    await tab.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await tab.goto(base + path, { waitUntil: 'load' });
      const runs = [await measureTargets(tab)];
      // The phone menu, open.
      if (await tab.locator('.menu summary').isVisible()) {
        await tab.locator('.menu summary').click();
        runs.push(await measureTargets(tab));
      }
      for (const { small, exempt: ex } of runs) {
        checks += 1;
        for (const s of small) failures.add(`${path} at ${width}: target under ${MIN} px: ${s}`);
        for (const e of ex) exempt.add(`${path} ${e}`);
      }
    }
  }
  await context.close();
  return { failures: [...failures], checks, exempt: [...exempt] };
}
