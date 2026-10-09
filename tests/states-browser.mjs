// The home page in the browser, for one build of the time machine (tests/run-time-machine.mjs), whatever state
// it shows: the hero keeps one filled button; the header stays on one line with the nav shown from 900 px and
// the phone button on one line; nothing scrolls sideways from 320 to 1100 px; the hero bill stays inside its
// measure from 320 to 1600 px; the wall is third through Apr 22; nothing invites proposals after Jan 31; and
// nothing asks for sponsors from Event Day (Apr 23) on.
const range = (from, to, step) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

/** Runs the checks on `base` (a server on dist/) for a build of `day`. Returns the failures and the count. */
export async function stateChecks(browser, base, day) {
  const failures = [];
  let checks = 0;
  const expect = (ok, message) => { checks += 1; if (!ok) failures.push(message); };
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
  const tab = await context.newPage();
  await tab.clock.setFixedTime(new Date(`${day}T18:00:00Z`));
  await tab.goto(base + '/', { waitUntil: 'networkidle' });

  const measure = (width) => tab.setViewportSize({ width, height: 900 }).then(() => tab.evaluate(() => {
    const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden'; };
    // How many lines a box's text takes.
    const lines = (el) => { const r = document.createRange(); r.selectNodeContents(el); return new Set([...r.getClientRects()].filter((b) => b.width > 0).map((b) => Math.round(b.top))).size; };
    const box = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height }; };
    const slots = document.querySelector('.slots');
    const used = (() => { const r = document.createRange(); r.selectNodeContents(slots); return [...r.getClientRects()]; })();
    const cta = document.querySelector('.head-cta');
    const nav = document.querySelector('.site-header .nav');
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      bill: Math.max(slots.getBoundingClientRect().left - Math.min(...used.map((r) => r.left)), Math.max(...used.map((r) => r.right)) - slots.getBoundingClientRect().right),
      cta: { ...box(cta), lines: lines(cta), label: cta.textContent.trim() },
      navShown: shown(nav) && [...nav.querySelectorAll('a')].every(shown),
      navWrapped: [...nav.querySelectorAll('a')].filter((a) => shown(a) && lines(a) > 1).map((a) => a.textContent.trim()),
      // The lockup, the nav and the button share one row: each one's middle lies inside the others' height.
      row: [document.querySelector('.lockup'), nav, document.querySelector('.head-end')].filter(shown).map(box),
      filled: [...document.querySelectorAll('.hero .btn')].filter(shown).filter((b) => !/rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(b).backgroundColor)).map((b) => b.textContent.trim()),
    };
  }));
  const oneRow = (row) => row.every((a) => row.every((b) => (a.top + a.bottom) / 2 > b.top && (a.top + a.bottom) / 2 < b.bottom));

  // The header from 900 to 1440 px, every 10 px: the nav shown, every link and the button on one line, one row.
  for (const width of range(900, 1440, 10)) {
    const m = await measure(width);
    expect(m.navShown, `${day} at ${width}: the nav is hidden`);
    expect(!m.navWrapped.length, `${day} at ${width}: nav links wrap: ${m.navWrapped.join(', ')}`);
    expect(m.cta.lines === 1 && m.cta.right <= width, `${day} at ${width}: the header button "${m.cta.label}" takes ${m.cta.lines} lines and ends at ${m.cta.right.toFixed(1)}px`);
    expect(oneRow(m.row), `${day} at ${width}: the header is not one row`);
  }
  // Phones: the button on one line, on screen, tall enough to tap.
  for (const width of [320, 360, 390]) {
    const m = await measure(width);
    expect(m.cta.lines === 1 && m.cta.right <= width && m.cta.height >= 44, `${day} at ${width}: the header button "${m.cta.label}" takes ${m.cta.lines} lines, ends at ${m.cta.right.toFixed(1)}px, ${m.cta.height}px tall`);
    expect(oneRow(m.row), `${day} at ${width}: the header is not one row`);
  }
  // No sideways scroll from 320 to 1100 px; the bill inside its measure from 320 to 1600 px; one filled button.
  for (const width of range(320, 1600, 10)) {
    const m = await measure(width);
    if (width <= 1100) expect(m.overflow <= 1, `${day} at ${width}: the page scrolls sideways by ${m.overflow}px`);
    expect(m.bill <= 1, `${day} at ${width}: the hero bill runs ${m.bill.toFixed(1)}px past its measure`);
    if (width % 160 === 0) expect(m.filled.length === 1, `${day} at ${width}: ${m.filled.length} filled hero buttons (${m.filled.join(', ')})`);
  }

  // What the page says, as a visitor sees it.
  const seen = await tab.evaluate(() => {
    const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden'; };
    const words = [...document.querySelectorAll('a')].map((a) => a.textContent.replace(/\s+/g, ' ').trim());
    return {
      words,
      menu: [...document.querySelectorAll('.menu-panel a')].map((a) => a.textContent.trim()),
      sections: [...document.querySelectorAll('main section, body > section, section')].filter((s) => s.parentElement.closest('section') === null).map((s) => s.className.split(' ').at(-1)),
      slot: [...document.querySelectorAll('.wall-next')].some(shown) || Boolean(document.querySelector('.wall-next')),
      pitch: Boolean(document.querySelector('#sponsor')),
    };
  });
  if (day > '2027-01-31') {
    const talk = seen.words.filter((w) => w === 'Submit a talk' || w === 'Speak');
    expect(!talk.length, `${day}: still invites proposals: ${talk.join(', ')}`);
  }
  if (day >= '2027-04-23') {
    const asks = [...seen.words.filter((w) => /^Sponsor(?!s\b)/.test(w)), ...(seen.slot ? ['the open wall slot'] : []), ...(seen.pitch ? ['the pitch'] : [])];
    expect(!asks.length, `${day}: still asks for sponsors: ${asks.join(', ')}`);
  }
  if (day <= '2027-04-22') expect(seen.sections[2] === 'wall', `${day}: the wall is not third (${seen.sections.join(', ')})`);
  await context.close();
  return { failures, checks };
}
