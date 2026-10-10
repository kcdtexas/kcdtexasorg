// The keyboard and screen-reader check, on every page built in dist/: what a keyboard user and a screen reader get.
// - Keyboard, at 1280 and 390 px: the first Tab reaches the skip link, which is visible and moves focus into main.
//   Tab then visits every focusable element once, in DOM order (no positive tabindex). Each focused element shows an
//   outline of 2 px or more and isn't hidden under the sticky header (WCAG 2.4.7, 2.4.11). Shift+Tab walks back.
// - The accessibility tree (Chromium's, the one screen readers read): one banner, one main, one contentinfo; navs
//   with distinct names; one h1 and no skipped heading levels; every link, button and image with a name.
// - The theme switch by keyboard: Enter and Space flip the theme, the name follows, the status line says it, focus
//   stays. The phone menu by keyboard: it opens and closes with Enter, says expanded or collapsed, and its links
//   come next in the Tab order.
// - axe (WCAG 2.2 A and AA, and best practices) in light and dark at 320 px and at 200% zoom (1280 px at 200%:
//   640 CSS px), with no sideways scroll.
// - While the WCAG claim is on: no embedded media (iframe, video, audio, object, embed or a YouTube player address)
//   in any built page or script.
// Run it on a build of today and on a build of another day (scripts/build.sh --now 2027-02-01).
//
// Usage: node tests/a11y.mjs <baseUrl> [--label <state>]
import { chromium } from 'playwright-core';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { distPages } from './targets.mjs';

const argv = process.argv.slice(2);
const base = (argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--label') ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
const label = argv.includes('--label') ? argv[argv.indexOf('--label') + 1] : 'build';
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const PAGES = distPages();

const failures = [];
const notes = new Set();
let checks = 0;
const expect = (ok, message) => { checks += 1; if (!ok) failures.push(message); };

// The focusable elements a Tab should reach, in DOM order, and a short name for each.
const FOCUSABLES = () => {
  const visible = (el) => {
    if (el.closest('[inert], [hidden]')) return false;
    const d = el.closest('details:not([open])');
    if (d && !(el.tagName === 'SUMMARY' && el.parentElement === d)) return false;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none') return false;
    return el.getClientRects().length > 0;
  };
  const all = [...document.querySelectorAll('a[href], button:not([disabled]), summary, input:not([disabled]), select, textarea, iframe, [tabindex]')]
    .filter((el) => el.tabIndex >= 0 && !(el.tagName === 'SUMMARY' && el.parentElement.tagName !== 'DETAILS') && visible(el));
  return all.map((el) => { el.dataset.a11yId ||= Math.random().toString(36).slice(2); return el.dataset.a11yId; });
};

// What has focus now: its id, whether its outline shows, and whether the sticky header covers it.
const FOCUSED = () => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  // Seen: some part of it is on screen and on top (not under the sticky header or anything else).
  const seen = [...el.getClientRects()].some((b) => {
    const x = Math.min(Math.max(b.left + b.width / 2, 0), innerWidth - 1);
    const y = Math.min(Math.max(b.top + b.height / 2, 0), innerHeight - 1);
    const hit = document.elementFromPoint(x, y);
    return b.bottom > 0 && b.top < innerHeight && hit && (el.contains(hit) || hit.contains(el));
  });
  return {
    id: el.dataset.a11yId ?? '',
    name: `${el.tagName.toLowerCase()} "${(el.textContent.replace(/\s+/g, ' ').trim() || el.getAttribute('aria-label') || '').slice(0, 40)}"`,
    outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2,
    seen,
    skip: el.classList.contains('skip'),
    skipShown: el.classList.contains('skip') && r.top >= 0 && r.bottom <= innerHeight && s.clipPath === 'none',
  };
};

async function axe(tab) {
  await tab.evaluate(axeSource);
  return tab.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return r.violations.map((v) => `${v.id} (${v.nodes.length}x): ${v.help} [${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')}]`);
  });
}

async function headingOrder(tab, cdp, hs) {
  await cdp.send('DOM.getDocument', { depth: 0 });
  const marked = [];
  for (const [i, h] of hs.entries()) {
    const { object } = await cdp.send('DOM.resolveNode', { backendNodeId: h.node });
    await cdp.send('Runtime.callFunctionOn', { objectId: object.objectId, functionDeclaration: `function () { this.dataset.a11yH = '${i}'; }` });
    marked.push(h);
  }
  const order = await tab.evaluate(() => [...document.querySelectorAll('[data-a11y-h]')].map((el) => Number(el.dataset.a11yH)));
  return order.map((i) => marked[i]);
}

/** Chromium's accessibility tree: the landmarks, the headings and the unnamed controls. */
async function tree(tab, cdp) {
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const live = nodes.filter((n) => !n.ignored);
  const role = (n) => n.role?.value;
  const name = (n) => (n.name?.value ?? '').trim();
  const prop = (n, p) => n.properties?.find((x) => x.name === p)?.value?.value;
  return {
    landmarks: live.filter((n) => ['banner', 'main', 'contentinfo', 'navigation', 'complementary', 'region', 'search', 'form'].includes(role(n))).map((n) => ({ role: role(n), name: name(n) })),
    // In page order: the tree's node list isn't, so they're sorted by their DOM elements.
    headings: await headingOrder(tab, cdp, live.filter((n) => role(n) === 'heading').map((n) => ({ level: Number(prop(n, 'level')), name: name(n), node: n.backendDOMNodeId })))
      .then((hs) => hs.map(({ level, name: nm }) => ({ level, name: nm }))),
    unnamed: live.filter((n) => ['link', 'button', 'image', 'img', 'checkbox', 'textbox', 'combobox', 'DisclosureTriangle'].includes(role(n)) && !name(n)).map((n) => role(n)),
    links: live.filter((n) => role(n) === 'link').map((n) => name(n)),
  };
}

// No embedded media while the WCAG claim is on. A player on our pages makes its captions and audio description
// part of the claim (1.2.2, 1.2.5), and YouTube's auto-generated captions don't meet it. Before adding one, name
// the exception in the claim or add accurate captions, then update this check.
const claimOn = /wcagClaim:\s*true\b/.test(readFileSync('src/data/accessibility.ts', 'utf8'));
if (claimOn) {
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  for (const file of walk('dist').filter((f) => /\.(html|m?js)$/.test(f))) {
    const text = readFileSync(file, 'utf8');
    const found = [
      ...(file.endsWith('.html') ? [...text.matchAll(/<(iframe|video|audio|object|embed)\b/gi)].map((m) => `<${m[1].toLowerCase()}>`) : []),
      ...[...text.matchAll(/youtube-nocookie\.com|youtube\.com\\?\/embed/gi)].map((m) => m[0].replace('\\', '')),
    ];
    expect(!found.length, `${label} ${file}: embeds media (${[...new Set(found)].join(', ')}) while wcagClaim is true. Name the exception in the claim (src/data/accessibility.ts) or add accurate captions, then update this check in tests/a11y.mjs`);
  }
}

const browser = await chromium.launch();
try {
  for (const path of PAGES) {
    for (const width of [1280, 390]) {
      const where = `${label} ${path} at ${width}`;
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'light', reducedMotion: 'reduce', isMobile: width < 600, hasTouch: false });
      const tab = await context.newPage();
      await tab.goto(base + path, { waitUntil: 'networkidle' });

      // The tab order, forward.
      const want = await tab.evaluate(FOCUSABLES);
      const got = [];
      for (let i = 0; i < want.length + 3; i += 1) {
        await tab.keyboard.press('Tab');
        const f = await tab.evaluate(FOCUSED);
        if (!f || (got.length && f.id === got[0].id)) break;
        got.push(f);
      }
      expect(got[0]?.skip && got[0]?.skipShown, `${where}: the first Tab doesn't show the skip link (${got[0]?.name})`);
      expect(got.map((f) => f.id).join() === want.join(), `${where}: Tab visits ${got.length} elements, not the ${want.length} focusable ones in DOM order${(() => { const i = got.findIndex((f, k) => f.id !== want[k]); return i >= 0 ? `; first difference at #${i + 1}, ${got[i].name}` : ''; })()}`);
      for (const f of got) {
        expect(f.outline, `${where}: no visible focus outline on ${f.name}`);
        expect(f.seen, `${where}: ${f.name} has focus but is off screen or under the header`);
      }
      // Backward: from past the end, Shift+Tab walks the same order in reverse.
      const back = [];
      for (let i = 0; i < got.length; i += 1) { await tab.keyboard.press('Shift+Tab'); back.push((await tab.evaluate(FOCUSED))?.id); }
      expect(back.join() === got.map((f) => f.id).reverse().join(), `${where}: Shift+Tab doesn't walk the order back`);

      // The skip link moves focus into main: Enter on it, then Tab lands on main's first focusable element.
      await tab.goto(base + path, { waitUntil: 'networkidle' });
      await tab.evaluate(FOCUSABLES);
      await tab.keyboard.press('Tab');
      await tab.keyboard.press('Enter');
      await tab.keyboard.press('Tab');
      // (With nothing to focus in main, Tab goes on to the first element after it.)
      const afterSkip = await tab.evaluate(() => {
        const main = document.querySelector('main');
        const el = document.activeElement;
        const ids = [...document.querySelectorAll('[data-a11y-id]')];
        const firstAfter = ids.find((x) => main.compareDocumentPosition(x) & (Node.DOCUMENT_POSITION_CONTAINED_BY | Node.DOCUMENT_POSITION_FOLLOWING));
        return { name: `${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 40)}"`, ok: el === firstAfter, hash: location.hash };
      });
      expect(afterSkip.ok && afterSkip.hash === '#main', `${where}: after the skip link, Tab goes to ${afterSkip.name}, not main's first focusable element`);

      // The accessibility tree, once per page (it is the same at both widths but for the phone menu).
      const cdp = await context.newCDPSession(tab);
      const t = await tree(tab, cdp);
      const count = (r) => t.landmarks.filter((l) => l.role === r).length;
      expect(count('banner') === 1 && count('main') === 1 && count('contentinfo') === 1, `${where}: landmarks ${t.landmarks.map((l) => l.role).join(', ')}`);
      const navs = t.landmarks.filter((l) => l.role === 'navigation').map((l) => l.name);
      expect(navs.every(Boolean) && new Set(navs).size === navs.length, `${where}: nav names not distinct: ${navs.join(' | ')}`);
      const h = t.headings;
      expect(h.filter((x) => x.level === 1).length === 1 && h[0]?.level === 1, `${where}: headings start ${h.slice(0, 3).map((x) => `h${x.level}`).join(', ')}, with ${h.filter((x) => x.level === 1).length} h1`);
      const jumps = h.filter((x, i) => i > 0 && x.level > h[i - 1].level + 1).map((x) => `h${x.level} "${x.name.slice(0, 30)}"`);
      expect(!jumps.length, `${where}: heading levels skip at ${jumps.join(', ')}`);
      expect(h.every((x) => x.name), `${where}: an empty heading`);
      expect(!t.unnamed.length, `${where}: controls or images with no name: ${t.unnamed.join(', ')}`);
      if (width === 1280) {
        const generic = t.links.filter((n) => /^(here|click here|more|read more|link|learn more)$/i.test(n));
        expect(!generic.length, `${where}: links named only "${generic.join('", "')}"`);
        notes.add(`${path}: ${h.length} headings (${h.map((x) => `h${x.level}`).join(' ')}), landmarks ${t.landmarks.map((l) => l.role + (l.name ? ` "${l.name}"` : '')).join(', ')}`);
      }

      // The theme switch by keyboard (on the home page), and the phone menu (at 390, on every page).
      if (path === '/' && width === 1280) {
        await tab.focus('[data-theme-toggle]');
        const state = () => tab.evaluate(() => ({ theme: document.documentElement.dataset.theme ?? '', name: document.querySelector('[data-theme-toggle]').textContent.replace(/\s+/g, ' ').trim(), status: document.querySelector('.theme-status')?.textContent.trim(), focus: document.activeElement?.hasAttribute('data-theme-toggle') }));
        let prev = await state();
        for (const [key, said] of [['Enter', 'Enter'], [' ', 'Space']]) {
          await tab.keyboard.press(key);
          const now = await state();
          expect(now.name !== prev.name && now.status !== prev.status, `${where}: ${said} on the theme switch: theme "${prev.theme}" -> "${now.theme}", name "${prev.name}" -> "${now.name}"`);
          expect(now.focus, `${where}: focus leaves the theme switch after ${said}`);
          expect(now.status, `${where}: the status line says nothing after ${said}`);
          notes.add(`theme switch: ${said}: "${prev.name}" -> "${now.name}", status "${now.status}"`);
          prev = now;
        }
      }
      if (width === 390) {
        const summary = tab.locator('.menu summary');
        const expanded = async () => {
          const { nodes } = await cdp.send('Accessibility.getFullAXTree');
          const n = nodes.find((x) => !x.ignored && x.role?.value === 'DisclosureTriangle');
          return n?.properties?.find((p) => p.name === 'expanded')?.value?.value;
        };
        await summary.focus();
        expect((await expanded()) === false, `${where}: the closed menu isn't announced as collapsed`);
        await tab.keyboard.press('Enter');
        const open = await tab.evaluate(() => document.querySelector('.menu').open);
        expect(open && (await expanded()) === true, `${where}: Enter doesn't open the menu, or it isn't announced as expanded`);
        const menuLinks = await tab.evaluate(() => [...document.querySelectorAll('.menu-panel a')].map((a) => a.textContent.trim()));
        const reached = [];
        for (const _ of menuLinks) { await tab.keyboard.press('Tab'); reached.push(await tab.evaluate(() => (document.activeElement.closest('.menu-panel') ? document.activeElement.textContent.trim() : ''))); }
        expect(reached.join() === menuLinks.join(), `${where}: Tab after the open menu reaches ${reached.join(', ')}, not ${menuLinks.join(', ')}`);
        const seen = await tab.evaluate(() => [...document.querySelectorAll('.menu-panel a')].every((a) => { const r = a.getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth && r.left >= 0; }));
        expect(seen, `${where}: the open menu runs off screen`);
        await summary.focus();
        await tab.keyboard.press('Enter');
        expect(!(await tab.evaluate(() => document.querySelector('.menu').open)) && (await expanded()) === false, `${where}: Enter doesn't close the menu`);
        if (path === '/') {
          await tab.keyboard.press('Enter');
          await tab.keyboard.press('Escape');
          notes.add(`phone menu: Escape ${(await tab.evaluate(() => document.querySelector('.menu').open)) ? 'leaves it open (native details; Enter closes it)' : 'closes it'}`);
        }
      }
      await context.close();
    }

    // axe at 320 px and at 200% zoom, light and dark, with no sideways scroll.
    for (const [mode, viewport, scale] of [['320 px', { width: 320, height: 640 }, 1], ['200% zoom', { width: 640, height: 450 }, 2]]) {
      for (const scheme of ['light', 'dark']) {
        const where = `${label} ${path} ${mode} ${scheme}`;
        const context = await browser.newContext({ viewport, deviceScaleFactor: scale, colorScheme: scheme, reducedMotion: 'reduce' });
        const tab = await context.newPage();
        await tab.goto(base + path, { waitUntil: 'networkidle' });
        const v = await axe(tab);
        expect(!v.length, `${where}: axe: ${v.join('; ')}`);
        const over = await tab.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(over <= 1, `${where}: scrolls sideways by ${over}px`);
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

if (process.argv.includes('--notes')) console.log([...notes].join('\n'));
if (failures.length) {
  console.error(`Keyboard and screen-reader check failed (${failures.length} of ${checks}) on ${label}:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`Keyboard and screen-reader check passed: ${checks} checks on ${PAGES.length} pages (${label}) against ${base}.`);
