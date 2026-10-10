// The program's tests (ADR 0009, plan-release-6): builds the site with the program sample and the sample sponsors
// (scripts/build.sh --program-sample --sponsors-sample), checks what it builds (the Share Cards' "Sample" stamp,
// the test-build marker, the credits from the test history), runs the smoke and browser tests on it (axe on every
// new page, in both themes, on a desktop and a phone), then drives the program pages in a browser: the filters, My
// Schedule across reloads, the keyboard, the calendar files, the credits' boxes and Event Day's now and next. It
// checks the announcements file (a bad entry stops the build; only entries posted by the build's time show) and
// offline use (the Event Day page and a Session page reload offline; from the day after Event Day the worker removes
// itself). It adds a history file to src/data/history/ (a good one, then a bad one) and removes it again. Then it builds with
// the gates closed and checks that no program page, card, calendar file, script reference or credit is built, and
// that the planted marker reaches no served file and no build log in either build. At the end dist/ is rebuilt as
// a normal build. Between them it builds the gate matrix's middle case, only `speakersPublic` open
// (--program-sample=speakers), and checks it has no times, rooms, calendar files or Event Day page.
// Usage: node tests/run-program.mjs [--keep-dist]
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, relative, sep } from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const failures = [];
let checks = 0;
const expect = (ok, message) => { checks += 1; if (!ok) failures.push(message); };
const DAY = '2027-04-23';
const STAMP_INSET = Number(readFileSync('src/lib/cards/program-cards.ts', 'utf8').match(/STAMP_INSET = (\d+)/)[1]);
const marker = readFileSync('src/data/program-fixture.ts', 'utf8').match(/plantedMarker = '([^']+)'/)[1];
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const served = () => walk('dist').filter((f) => /\.(?:html|xml|txt|ics|js|css|json|svg)$|(?:^|\/)_(?:redirects|headers)$/.test(f));
const read = (p) => readFileSync(join('dist', p), 'utf8');
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

/** Polls `fn` in the tab (it may be async) until it's true, for up to `ms`. */
async function until(tab, fn, ms = 15000) {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 100))) {
    if (await tab.evaluate(fn).catch(() => false)) return true;
  }
  return false;
}

function build(flags, env = {}) {
  const res = spawnSync('bash', ['scripts/build.sh', '--skip-install', ...flags], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { status: res.status, log: res.stdout + res.stderr };
}

// The announcements file, changed for a step and always put back.
const ANNOUNCEMENTS = 'src/data/announcements-2027.yaml';
const announcementsText = readFileSync(ANNOUNCEMENTS, 'utf8');
process.on('exit', () => writeFileSync(ANNOUNCEMENTS, announcementsText));

// Fields the allowlist drops, from the fixture: none may reach a served file.
const DROPPED = [marker, 'speaker1@example.com', '+1 555 0100', 'example.com/track'];

/** Each Organizer on About and their credit's words, or null. */
const organizerCredits = (html) => Object.fromEntries([...html.matchAll(/<li>\s*<img[^>]*class="pg-org-photo"[\s\S]*?<\/li>/g)]
  .map((m) => [m[0].match(/<b>([^<]+)<\/b>/)[1], m[0].match(/<span class="credit">([^<]+)<\/span>/)?.[1] ?? null]));

/** The calendar file rules: CRLF lines of at most 75 octets, the Chicago zone, and one event per Session. */
function checkIcs(label, body, events) {
  const lines = body.split('\r\n');
  expect(body.endsWith('\r\n') && !/[^\r]\n/.test(body), `${label}: lines don't all end in CRLF`);
  expect(lines.every((l) => Buffer.byteLength(l) <= 75), `${label}: a line is longer than 75 octets`);
  expect(lines[0] === 'BEGIN:VCALENDAR' && lines.includes('END:VCALENDAR') && lines.includes('VERSION:2.0'), `${label}: not a calendar`);
  expect(lines.includes('TZID:America/Chicago') && lines.includes('BEGIN:VTIMEZONE'), `${label}: no America/Chicago zone`);
  const starts = lines.filter((l) => l.startsWith('DTSTART;'));
  expect(starts.length === events && starts.every((l) => /^DTSTART;TZID=America\/Chicago:\d{8}T\d{6}$/.test(l)), `${label}: ${starts.length} events with zoned start times, expected ${events}`);
}

// A local server on dist/ and a browser.
const host = '127.0.0.1';
const port = await new Promise((resolve, reject) => {
  const probe = createServer().once('error', reject).listen(0, host, () => { const { port: p } = probe.address(); probe.close(() => resolve(p)); });
});
const base = `http://${host}:${port}`;
let server = null;
const browser = await chromium.launch();
async function serve() {
  server?.kill();
  server = spawn(process.execPath, ['scripts/serve.mjs', '--host', host, '--port', String(port)], { stdio: 'ignore' });
  for (let i = 0; i < 50; i += 1) {
    try { if ((await fetch(`${base}/`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('the local server did not start');
}

try {
  // 0. The program platform: the Sessionize adapter, the CSV fallback, the build rules, the photos and the
  // refresh check, against local stand-ins (tests/program-adapter.mjs).
  const adapter = spawnSync(process.execPath, ['tests/program-adapter.mjs'], { encoding: 'utf8' });
  process.stdout.write(adapter.stdout);
  expect(adapter.status === 0, `tests/program-adapter.mjs fails:\n${adapter.stderr.slice(-3000)}`);

  // 1. The production build refuses the sample flags.
  for (const flag of [['--program-sample'], ['--clock', '10:30']]) {
    const res = build(flag, { CONTEXT: 'production' });
    expect(res.status === 2 && /not allowed in a production build/.test(res.log), `production build accepts ${flag[0]}`);
  }

  // 2. The program sample with the sample sponsors, built today (tests/browser.mjs checks today's build).
  const sample = build(['--program-sample', '--sponsors-sample']);
  if (sample.status !== 0) throw new Error(`the sample build failed:\n${sample.log.slice(-3000)}`);
  expect(!sample.log.includes(marker), 'the sample build log contains the planted marker');
  for (const f of served()) for (const d of DROPPED) expect(!readFileSync(f, 'utf8').includes(d), `${f}: contains a dropped field (${d === marker ? 'the planted marker' : d})`);

  const schedule = read('2027/schedule/index.html');
  const sessionPages = readdirSync('dist/2027/sessions').filter((n) => statSync(join('dist/2027/sessions', n)).isDirectory());
  const speakerPages = readdirSync('dist/2027/speakers').filter((n) => statSync(join('dist/2027/speakers', n)).isDirectory());
  const items = [...schedule.matchAll(/<li class="sch-item[^"]*" data-id="([^"]+)"/g)].map((m) => m[1]);
  expect(/data-schedule/.test(schedule) && items.length > 0, 'the Schedule page has no Sessions');
  expect(items.length === sessionPages.length, `the Schedule lists ${items.length} Sessions, but ${sessionPages.length} Session pages were built`);
  expect(/\bSample\b/.test(text(schedule)), 'the Schedule page does not say "Sample"');
  expect(/<script src="\/schedule\.js" defer><\/script>/.test(schedule), 'the Schedule page does not load /schedule.js');
  // Accessible by design: every Session sits under a time heading and has its time and room as text.
  const slots = [...schedule.matchAll(/<section class="sch-slot" aria-labelledby="(t-\d{4})"[^>]*>\s*<h2 class="sch-time-h" id="\1">/g)];
  expect(slots.length > 0, 'the Schedule has no time headings');
  expect([...schedule.matchAll(/<li class="sch-item[\s\S]*?<\/li>/g)].every((m) => /class="sch-time"/.test(m[0]) && /class="sch-room"/.test(m[0])), 'a Session in the Schedule has no time or room as text');
  // The fixture: its marks, and the Returning Speaker credit only where an earlier Edition matches.
  const speakers = read('2027/speakers/index.html');
  expect(/Fixture Speaker 1/.test(speakers) && /Speaker since 2026/.test(speakers), 'the Speakers list lacks the fixture or the "Speaker since 2026" credit');
  const returning = read('2027/speakers/fixture-speaker-4/index.html');
  expect(/Speaker since 2026/.test(returning), 'Fixture Speaker 4’s page lacks "Speaker since 2026" (the test history)');
  expect(!/Speaker since/.test(read('2027/speakers/fixture-speaker-1/index.html')), 'a first-time fixture Speaker shows a credit');
  expect(!/\bFixture\b/.test(read('2026/index.html')), 'the test history reaches the 2026 page');
  const credits = (speakers.match(/Speaker since/g) ?? []).length;
  expect(credits === 1, `the Speakers list shows ${credits} "Speaker since" credits; only Fixture Speaker 4 should (2026 test data never credits itself)`);
  expect(/<a href="https:\/\/example\.com\/">Website<\/a>/.test(read('2027/speakers/fixture-speaker-1/index.html')), 'an allowlisted link is missing');
  // The End-User Story badge, the formats, and the share cards.
  expect(/badge--eu/.test(schedule) && /badge--workshop/.test(schedule) && /badge--panel/.test(schedule), 'the Schedule lacks the End-User Story, workshop or panel badge');
  for (const page of [`2027/sessions/${sessionPages[0]}/index.html`, '2027/speakers/fixture-speaker-4/index.html']) {
    const html = read(page);
    const card = html.match(/<meta property="og:image" content="[^"]*\/cards\/([a-z0-9-]+)\.png"/)?.[1];
    expect(card && card !== 'default' && existsSync(join('dist/cards', `${card}.png`)), `${page}: no Share Card of its own`);
    expect(/<meta property="og:image:alt" content="Sample: /.test(html), `${page}: the Share Card's alt text does not start with "Sample:"`);
  }
  // Every Share Card in a test build carries the "Sample" stamp: a white plate in the top right corner.
  const programCards = readdirSync('dist/cards').filter((n) => /^(?:session|speaker)-/.test(n));
  expect(programCards.length > 0, 'the sample build drew no Share Cards');
  for (const name of programCards) {
    const px = await sharp(join('dist/cards', name)).removeAlpha().extract({ left: 1200 - STAMP_INSET - 8, top: STAMP_INSET + 2, width: 4, height: 4 }).raw().toBuffer();
    expect([...px].every((v) => v > 240), `cards/${name}: no "Sample" stamp in the top right corner`);
  }
  // A test build is marked, and check-dist refuses it in a production context.
  expect(existsSync('dist/.test-build'), 'the sample build has no dist/.test-build marker');
  const prod = spawnSync(process.execPath, ['scripts/check-dist.mjs'], { encoding: 'utf8', env: { ...process.env, KCD_PROGRAM_SAMPLE: '1', CONTEXT: 'production' } });
  expect(prod.status !== 0 && /\.test-build: this is a test build/.test(prod.stdout + prod.stderr), 'check-dist passes a marked test build with CONTEXT=production');
  // The calendar files.
  checkIcs('schedule.ics', read('2027/schedule.ics'), items.length);
  for (const slug of sessionPages) {
    expect(existsSync(join('dist/2027/sessions', `${slug}.ics`)), `no calendar file for ${slug}`);
  }
  checkIcs(`${sessionPages[0]}.ics`, read(`2027/sessions/${sessionPages[0]}.ics`), 1);
  // The program version, published while a gate is open.
  expect(/^[0-9a-f]{64}\n$/.test(read('2027/program-version.txt')), 'the sample build lacks /2027/program-version.txt');
  // The program script and its cache rule, the /speakers Short Link and the privacy page's My Schedule line.
  expect(existsSync('dist/schedule.js') && /^\/schedule\.js$/m.test(read('_headers')), 'the sample build lacks /schedule.js or its _headers rule');
  expect(/^\/speakers\s+\/2027\/speakers\/\s+302$/m.test(read('_redirects')), 'the sample build lacks the /speakers Short Link');
  expect(/My Schedule, the list is kept only in this browser/.test(text(read('privacy/index.html'))), 'the privacy page lacks the My Schedule line');
  // The sitemap lists the program pages while a gate is open.
  const sitemap = read('sitemap.xml');
  expect(/\/2027\/speakers\/<\/loc>/.test(sitemap) && /\/2027\/sessions\//.test(sitemap) && /\/2027\/today\/<\/loc>/.test(sitemap), 'the sitemap misses the program pages');
  // The loyalty credits from the test history: About (Mars Toktonaliev held), the walls and a Speaker page.
  const about = read('about/index.html');
  expect(/Organizer since 2026/.test(about) && /\bSample\b/.test(text(about)), 'About lacks "Organizer since 2026" or its Sample label');
  expect(organizerCredits(about)['Joel Hernandez'] === 'Organizer since 2026', 'About: a 2026 and 2027 Organizer lacks "Organizer since 2026"');
  expect(organizerCredits(about)['Mars Toktonaliev'] === null, 'About: a held Organizer shows a credit');
  expect(organizerCredits(about)['Amy Marrich'] === null, 'About: a first-time Organizer shows a credit');
  expect((read('2027/sponsors/index.html').match(/<span class="credit">Since 2026<\/span>/g) ?? []).length === 3, 'the 2027 wall lacks its three sample "Since 2026" credits');
  // check-dist refuses this build without its flag: the labels, the fixture's names, and the program built with the
  // Edition's gates closed.
  const checkDist = (env) => {
    const res = spawnSync(process.execPath, ['scripts/check-dist.mjs'], { encoding: 'utf8', env: Object.fromEntries(Object.entries({ ...process.env, ...env }).filter(([, v]) => v !== undefined)) });
    return { status: res.status, log: res.stdout + res.stderr };
  };
  const guard = checkDist({ KCD_PROGRAM_SAMPLE: undefined, KCD_SPONSORS_SAMPLE: undefined });
  expect(guard.status !== 0 && /Sample/.test(guard.log) && /Fixture/.test(guard.log) && /the Session pages \(dist\/2027\/sessions\/\): built, but the gates in src\/data\/edition-2027\.ts are closed/.test(guard.log),
    'check-dist passes the program sample without its flag');
  // The preview rule in check-dist: a build that isn't a production build never has the platform's variables, and a
  // test build never has a Speaker photo.
  const flags = { KCD_PROGRAM_SAMPLE: '1', KCD_SPONSORS_SAMPLE: '1' };
  expect(checkDist(flags).status === 0, 'check-dist fails the sample build with its flags');
  for (const context of ['deploy-preview', 'branch-deploy']) {
    const res = checkDist({ ...flags, CONTEXT: context, SESSIONIZE_ENDPOINT_ID: 'fxEndpoint42', PROGRAM_CSV_URL: 'https://example.com/p.csv' });
    expect(res.status !== 0 && /SESSIONIZE_ENDPOINT_ID reaches a build that isn't a production build/.test(res.log) && /PROGRAM_CSV_URL reaches/.test(res.log) && !res.log.includes('fxEndpoint42'),
      `check-dist passes a ${context} build with the platform's variables, or prints a value`);
  }
  writeFileSync('dist/2027/speakers/planted-small.webp', '');
  const photo = checkDist(flags);
  rmSync('dist/2027/speakers/planted-small.webp');
  expect(photo.status !== 0 && /planted-small\.webp: a Speaker photo outside a production build/.test(photo.log), 'check-dist passes a Speaker photo in a test build');

  // 3. The smoke and browser tests on the sample build: axe on every page, both themes, desktop and phone.
  await serve();
  for (const script of ['tests/smoke.mjs', 'tests/browser.mjs']) {
    const res = spawnSync(process.execPath, [script, base], { encoding: 'utf8', env: { ...process.env, KCD_PROGRAM_SAMPLE: '1' } });
    expect(res.status === 0, `${script} fails on the program sample:\n${(res.stdout + res.stderr).split('\n').filter((l) => /fail|✗|violation/i.test(l)).slice(0, 20).join('\n')}`);
  }

  // 4. The program pages in a browser.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const tab = await ctx.newPage();
  const errors = [];
  tab.on('pageerror', (e) => errors.push(e.message));
  tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await tab.goto(`${base}/2027/schedule/`);
  expect(await tab.locator('[data-filters]').isVisible(), 'the filters stay hidden with JavaScript on');
  const visible = () => tab.locator('.sch-item:visible').count();
  const all = await visible();
  await tab.locator('label.chip', { hasText: 'Workshop' }).click();
  const workshops = await tab.locator('.sch-item[data-format="workshop"]').count();
  expect(await visible() === workshops, `the Workshop filter shows ${await visible()} Sessions, not ${workshops}`);
  expect(/Showing \d+ of \d+ Sessions/.test(await tab.locator('[data-count]').textContent()), 'the filter count is missing');
  await tab.locator('label.chip', { hasText: 'Workshop' }).click();
  await tab.locator('label.chip', { hasText: 'End-User Stories' }).click();
  expect(await visible() === await tab.locator('.sch-item[data-eu="1"]').count(), 'the End-User Stories filter is wrong');
  await tab.locator('label.chip', { hasText: 'End-User Stories' }).click();
  expect(await visible() === all, 'clearing the filters does not show every Session again');
  // Three stars, with the mouse and the keyboard; they survive a reload.
  const stars = tab.locator('.sch-item [data-star]');
  await stars.nth(0).click();
  await stars.nth(2).click();
  await stars.nth(4).focus();
  await tab.keyboard.press('Enter');
  const picked = await tab.locator('.sch-item [data-star][data-on="true"]').evaluateAll((bs) => bs.map((b) => b.dataset.star));
  expect(picked.length === 3, `${picked.length} stars are on after three presses`);
  expect(/^Remove from My Schedule/.test(await stars.nth(0).textContent().then((t) => t.trim())), 'a starred Session doesn’t offer "Remove from My Schedule"');
  await tab.reload();
  const kept = await tab.locator('.sch-item [data-star][data-on="true"]').evaluateAll((bs) => bs.map((b) => b.dataset.star));
  expect(kept.join() === picked.join(), 'My Schedule does not survive a reload');
  await tab.locator('label.chip', { hasText: 'My Schedule' }).click();
  expect(await visible() === 3, `the My Schedule view shows ${await visible()} Sessions, not 3`);
  const [download] = await Promise.all([tab.waitForEvent('download'), tab.locator('[data-my-ics]').click()]);
  const mine = readFileSync(await download.path(), 'utf8');
  checkIcs('My Schedule .ics', mine, 3);
  // The Session page's star shares the same list.
  const first = await tab.locator(`.sch-item[data-id="${picked[0]}"] .sch-title a`).getAttribute('href');
  await tab.goto(`${base}${first}`);
  expect(await tab.locator('.star--words').getAttribute('data-on') === 'true', 'the Session page does not show the starred state');
  expect(await tab.locator('a[download][href$=".ics"]').count() === 1, 'the Session page lacks "Add to calendar"');
  await tab.goto(`${base}/2027/schedule/#my`);
  expect(await tab.locator('[data-filter="my"]').isChecked(), '/2027/schedule/#my does not open the My Schedule view');
  expect(!errors.length, `browser errors: ${errors.join(' | ')}`);
  await ctx.close();

  // A credit sits in the normal flow and never covers what it credits: its box intersects no logo, sponsor name,
  // photo or person's name, on a desktop and a phone.
  for (const width of [1280, 390]) {
    const c = await browser.newContext({ viewport: { width, height: 900 } });
    const p = await c.newPage();
    for (const path of ['/2027/sponsors/', '/about/', '/2027/speakers/', '/2027/speakers/fixture-speaker-4/']) {
      await p.goto(`${base}${path}`);
      const found = await p.locator('.credit').evaluateAll((credits) => credits.map((cr) => {
        const box = cr.getBoundingClientRect();
        const holder = cr.closest('li, header');
        const content = [...holder.querySelectorAll('img, .sp-name, .spk-photo, b, h1, .spk-name, .pg-aff, .spk-tag, .spk-ses')].filter((e) => !cr.contains(e));
        // A link by its words: its tap padding (tests/targets.mjs) is invisible.
        const shapes = (e) => {
          if (e.tagName !== 'A') return [e.getBoundingClientRect()];
          const words = document.createRange();
          words.selectNodeContents(e);
          return [...words.getClientRects()];
        };
        const hit = content.find((e) => shapes(e).some((r) => r.width && r.height && box.left < r.right - 0.5 && r.left < box.right - 0.5 && box.top < r.bottom - 0.5 && r.top < box.bottom - 0.5));
        return { text: cr.textContent.trim(), hit: hit ? `${hit.tagName.toLowerCase()}.${hit.className} "${(hit.textContent || hit.alt || '').trim().slice(0, 40)}"` : null };
      }));
      expect(found.length > 0, `${path} at ${width}: no credit to check`);
      for (const f of found) expect(!f.hit, `${path} at ${width}: "${f.text}" overlaps ${f.hit}`);
      // The tier sizes don't change: a tile with a credit is the same size as the others in its tier.
      const sizes = await p.locator('.tier').evaluateAll((tiers) => tiers.map((t) => [...new Set([...t.querySelectorAll('.logos > li:not(.has-credit), .sp-tile')]
        .map((e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; }))]));
      for (const tier of sizes) expect(tier.length <= 1, `${path} at ${width}: a tier's tiles differ in size (${tier.join(', ')})`);
    }
    await c.close();
  }

  // 5. The announcements file: a bad entry stops the build with a message naming the entry and the field.
  for (const [entry, want] of [
    ['- at: "2027-04-23 9:15"\n  text: Doors open.', /entry 1 \(at "2027-04-23 9:15"\): "at" must be/],
    ['- at: "2027-04-23 09:15"\n  text: Doors open.\n- at: "2027-04-23 10:15"\n  text: More.\n  link: http://example.com/', /entry 2 \(at "2027-04-23 10:15"\): "link" must be an https address/],
    ['- at: "2027-04-23 09:15"\n  txt: Doors open.', /entry 1 \(at "2027-04-23 09:15"\): "txt" is not a field/],
  ]) {
    writeFileSync(ANNOUNCEMENTS, `${announcementsText}${entry}\n`);
    const res = build([]);
    expect(res.status !== 0 && want.test(res.log), `a bad announcement does not stop the build with ${want}:\n${res.log.slice(-600)}`);
  }
  writeFileSync(ANNOUNCEMENTS, announcementsText);

  // 6. The program sample on Event Day at 10:30 a.m.: the hero's one link, the page's stamp, and now and next,
  // which follow the browser's clock in Central time. Two announcements from the file: the 10:15 one shows, with
  // its link, and the 11:00 one doesn't yet.
  writeFileSync(ANNOUNCEMENTS, `${announcementsText}- at: "2027-04-23 10:15"\n  text: Test announcement posted at 10:15.\n  link: https://example.com/today\n- at: "2027-04-23 11:00"\n  text: Test announcement posted at 11:00.\n`);
  const eventDay = build(['--program-sample', '--now', DAY, '--clock', '10:30']);
  writeFileSync(ANNOUNCEMENTS, announcementsText);
  if (eventDay.status !== 0) throw new Error(`the Event Day sample build failed:\n${eventDay.log.slice(-3000)}`);
  expect(!eventDay.log.includes(marker), 'the Event Day sample build log contains the planted marker');
  const home = read('index.html');
  expect(/<a class="btn btn--door" href="\/2027\/today\/">Open the live schedule<\/a>/.test(home), 'the Event Day hero lacks "Open the live schedule"');
  const today = read('2027/today/index.html');
  expect(/Updated 10:30 a\.m\. CT/.test(today), 'the Event Day page lacks "Updated 10:30 a.m. CT"');
  expect(/<li class="td-ses is-now"/.test(today), 'the Event Day page shows nothing on now at 10:30 without JavaScript');
  // Only the announcements posted by the build's time: the 9:05 one, not the 12:40 one.
  expect(/keynote room is full/.test(today) && !/lunch runs 15 minutes late/.test(today), 'the Event Day page at 10:30 shows an announcement posted later, or misses an earlier one');
  expect(/<time datetime="2027-04-23T10:15">10:15 a\.m\.<\/time> Test announcement posted at 10:15\. <a href="https:\/\/example\.com\/today">Details<\/a>/.test(today) && !/posted at 11:00/.test(today), 'the Event Day page at 10:30 does not show the file\'s 10:15 announcement with its link, or shows the 11:00 one');
  // Offline use: /sw.js and its rules ship, and the privacy page says so.
  expect(/OFF = false/.test(read('sw.js')) && /OFFLINE = true/.test(read('schedule.js')), 'the Event Day build does not turn offline use on');
  expect(/keeps a copy so they still open without a connection/.test(text(read('privacy/index.html'))), 'the privacy page lacks the offline copy line');
  await serve();
  for (const [at, utc] of [['10:30', '15:30'], ['15:00', '20:00']]) {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await c.clock.setFixedTime(new Date(`${DAY}T${utc}:00Z`));
    const p = await c.newPage();
    await p.goto(`${base}/2027/today/`);
    const want = await p.evaluate((t) => [...document.querySelectorAll('[data-room-block]')].map((r) => {
      const s = [...r.querySelectorAll('.td-ses')];
      const now = s.find((x) => x.dataset.start <= t && t < x.dataset.end);
      return now?.querySelector('.td-title').textContent ?? null;
    }), `${DAY}T${at}`);
    const got = await p.locator('[data-room-block]').evaluateAll((rs) => rs.map((r) => r.querySelector('.td-ses.is-now:not([hidden]) .td-title')?.textContent ?? null));
    expect(got.join('|') === want.join('|') && got.some(Boolean), `Event Day at ${at}: now is ${got.join(' | ')}`);
    await c.close();
  }
  // Offline use: load the Event Day page and a Session page, go offline, and both reload from the kept copy.
  const offline = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const off = await offline.newPage();
  const keptHere = () => until(off, async () => Boolean(await (await caches.open('kcd-texas-2027')).match(location.href)));
  await off.goto(`${base}/2027/today/`);
  expect(await keptHere(), 'the Event Day page is not kept for offline use');
  const sessionPath = await off.locator('.td-title').first().getAttribute('href');
  await off.goto(`${base}${sessionPath}`);
  expect(await keptHere(), `${sessionPath} is not kept for offline use`);
  expect(await off.evaluate(async () => (await navigator.serviceWorker.getRegistration('/2027/'))?.scope.endsWith('/2027/')), 'the offline worker is not registered with the scope /2027/');
  await offline.setOffline(true);
  for (const path of ['/2027/today/', sessionPath]) {
    const res = await off.goto(`${base}${path}`).catch(() => null);
    const shown = res && await off.evaluate(() => [document.querySelector('h1')?.textContent.trim(), getComputedStyle(document.body).fontFamily]);
    expect(res?.status() === 200 && shown[0] && /Archivo/.test(shown[1]), `${path} does not reload offline with its text and styles`);
  }
  // The browser is offline for the worker too: a page it never kept doesn't load.
  expect(await off.goto(`${base}/2027/sessions/never-kept/`).then(() => false, () => true), 'a page that was never kept loads offline, so the offline check proves nothing');
  await offline.setOffline(false);

  // From the day after Event Day: the worker clears its copies and removes itself, and the script registers none.
  const after = build(['--program-sample', '--now', '2027-04-24']);
  if (after.status !== 0) throw new Error(`the day-after sample build failed:\n${after.log.slice(-3000)}`);
  expect(/OFF = true/.test(read('sw.js')) && /OFFLINE = false/.test(read('schedule.js')), 'the day-after build does not turn offline use off');
  expect(!/without a connection/.test(read('privacy/index.html')), 'the day-after privacy page still mentions the offline copy');
  await serve();
  await off.goto(`${base}/2027/today/`);
  const gone = async () => (await navigator.serviceWorker.getRegistrations()).length === 0 && (await caches.keys()).length === 0;
  expect(await until(off, gone), 'the day-after worker does not remove itself and its copies');
  // And it stays removed: the page's script registers no worker again.
  await off.reload();
  await new Promise((r) => setTimeout(r, 2000));
  expect(await off.evaluate(gone), 'a worker or a kept copy comes back after a reload on the day after Event Day');
  await offline.close();

  // 7. The gate matrix: only `speakersPublic` open (--program-sample=speakers). The Speakers, the titles and the
  // abstracts, with no times, rooms, calendar files or Event Day page; the program version is still published.
  const speakersOnly = build(['--program-sample=speakers']);
  if (speakersOnly.status !== 0) throw new Error(`the speakers-only sample build failed:\n${speakersOnly.log.slice(-3000)}`);
  expect(!speakersOnly.log.includes(marker), 'the speakers-only build log contains the planted marker');
  {
    const sessionDirs = readdirSync('dist/2027/sessions').filter((n) => statSync(join('dist/2027/sessions', n)).isDirectory());
    expect(sessionDirs.length === sessionPages.length && existsSync('dist/2027/speakers/index.html') && existsSync('dist/2027/speakers/fixture-speaker-4/index.html'), 'the speakers-only build lacks Session or Speaker pages');
    for (const p of ['2027/today', '2027/schedule.ics']) expect(!existsSync(join('dist', p)), `the speakers-only build has ${p}`);
    expect(!readdirSync('dist/2027/sessions').some((n) => n.endsWith('.ics')), 'the speakers-only build has Session calendar files');
    expect(/^[0-9a-f]{64}\n$/.test(read('2027/program-version.txt')), 'the speakers-only build lacks /2027/program-version.txt');
    const sched = read('2027/schedule/index.html');
    expect(!/data-schedule/.test(sched) && !/schedule\.js/.test(sched), 'the speakers-only Schedule page shows the Sessions by time or loads /schedule.js');
    const fx = 'fixture-session-how-we-run-kubernetes-for-our-own-business';
    const sessionHtml = read(`2027/sessions/${fx}/index.html`);
    expect(/class="ses-abstract"/.test(sessionHtml) && /<h1 class="page-title ses-title">/.test(sessionHtml), `${fx}: no title or abstract`);
    expect(!/Time \(Central\)|<dt>Room<\/dt>|\.ics"/.test(sessionHtml), `${fx}: shows a time, a room or "Add to calendar"`);
    for (const page of ['2027/speakers/index.html', '2027/speakers/fixture-speaker-4/index.html', `2027/sessions/${fx}/index.html`]) {
      const html = read(page);
      expect(!/class="sch-(?:time|room|meta)"|data-start="\d/.test(html), `${page}: shows a time or a room`);
      expect(/2026 Speakers and made-up Sessions/.test(html), `${page}: lacks the speakers-only Sample label`);
    }
    expect(/^\/speakers\s/m.test(read('_redirects')), 'the speakers-only build lacks the /speakers Short Link');
    const sm = read('sitemap.xml');
    expect(/\/2027\/speakers\/<\/loc>/.test(sm) && !/\/2027\/today\//.test(sm), 'the speakers-only sitemap is wrong');
    // The Share Cards give no time or room either.
    const alt = sessionHtml.match(/<meta property="og:image:alt" content="([^"]*)"/)?.[1] ?? '';
    expect(/^Sample: Fixture Session/.test(alt) && !/Central|Fixture Room/.test(alt), `${fx}: the Share Card's alt text gives a time or a room: ${alt}`);
    // check-dist refuses a calendar file with only speakersPublic open.
    writeFileSync('dist/2027/schedule.ics', 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
    const timed = checkDist({ KCD_PROGRAM_SAMPLE: 'speakers' });
    rmSync('dist/2027/schedule.ics');
    expect(timed.status !== 0 && /the calendar files \(dist\/2027\/schedule\.ics, dist\/2027\/sessions\/\*\.ics\): built, but the test program's gates \(KCD_PROGRAM_SAMPLE=speakers\) open only speakersPublic/.test(timed.log),
      'check-dist passes a calendar file with only speakersPublic open');
    expect(checkDist({ KCD_PROGRAM_SAMPLE: 'speakers' }).status === 0, 'check-dist fails the speakers-only build with its flag');
  }
  await serve();
  for (const script of ['tests/smoke.mjs', 'tests/browser.mjs']) {
    const res = spawnSync(process.execPath, [script, base], { encoding: 'utf8', env: { ...process.env, KCD_PROGRAM_SAMPLE: 'speakers' } });
    expect(res.status === 0, `${script} fails on the speakers-only sample:\n${(res.stdout + res.stderr).split('\n').filter((l) => /fail|✗|violation/i.test(l)).slice(0, 20).join('\n')}`);
  }

  // 8. The history registry: a new file in src/data/history/ joins with no code change, and a bad one fails the
  // build with its name. The test file stands in for 2025 (a copy of any real one is put back afterwards): with a
  // complete 2025 Organizers record, a normal build prints the Organizer credits, each year from the records.
  const historyFile = 'src/data/history/2025.ts';
  const keptFile = existsSync(historyFile) ? `${historyFile}.kept-by-test` : null;
  if (keptFile) renameSync(historyFile, keptFile);
  try {
    writeFileSync(historyFile, "export default { year: 2025, organizers: { names: ['Rich Boyd'], complete: true, source: 'https://example.com/' } };\n");
    const joined = build([]);
    if (joined.status !== 0) throw new Error(`the build with a test history file failed:\n${joined.log.slice(-3000)}`);
    const credits = organizerCredits(read('about/index.html'));
    expect(credits['Rich Boyd'] === 'Organizer since 2025', `a new history file does not join: Rich Boyd shows ${credits['Rich Boyd']}`);
    expect(credits['Joel Hernandez'] === 'Organizer since 2026', `Joel Hernandez shows ${credits['Joel Hernandez']}, not "Organizer since 2026"`);
    expect(credits['Mars Toktonaliev'] === null, 'a held Organizer shows a credit in a normal build');
    expect(credits['Amy Marrich'] === null && credits['Myroslav Mishov'] === null, 'a first-time Organizer shows a credit in a normal build');
    expect(!/\bSample\b/.test(text(read('about/index.html'))), 'a normal build labels its credits "Sample"');
    writeFileSync(historyFile, "export default { year: 2025, speakers: { names: 'Rich Boyd', complete: true, source: 'https://example.com/' } };\n");
    const broken = build([]);
    expect(broken.status !== 0 && broken.log.includes(`${historyFile}: "speakers.names" must be a list`), 'a bad history file does not fail the build with its name');
  } finally {
    rmSync(historyFile, { force: true });
    if (keptFile) renameSync(keptFile, historyFile);
  }

  // 9. The gates closed: a normal build has no program at all, and no credit while 2025's records are missing.
  const closed = build([]);
  if (closed.status !== 0) throw new Error(`the normal build failed:\n${closed.log.slice(-3000)}`);
  expect(!closed.log.includes(marker), 'the normal build log contains the planted marker');
  for (const p of ['2027/speakers', '2027/sessions', '2027/today', '2027/schedule.ics', '2027/program-version.txt']) expect(!existsSync(join('dist', p)), `a closed gate still builds ${p}`);
  expect(!existsSync('dist/.test-build'), 'a normal build carries the test-build marker');
  expect(!readdirSync('dist/cards').some((n) => /^(?:session|speaker)-/.test(n)), 'a closed gate still draws program cards');
  expect(!walk('dist').some((f) => f.endsWith('.html') && /schedule\.js/.test(readFileSync(f, 'utf8'))), 'a page loads /schedule.js with the gates closed');
  expect(!/\/2027\/(?:speakers|sessions|today)\//.test(read('sitemap.xml')), 'the sitemap lists program pages with the gates closed');
  expect(!existsSync('dist/schedule.js') && !/schedule\.js/.test(read('_headers')), 'a closed gate still ships /schedule.js or its _headers rule');
  expect(!existsSync('dist/sw.js') && !/sw\.js|worker-src/.test(read('_headers')), 'a closed gate still ships /sw.js, its _headers rule or worker-src');
  expect(!/^\/speakers\s/m.test(read('_redirects')), 'a closed gate still serves the /speakers Short Link');
  expect(!/My Schedule/.test(read('privacy/index.html')), 'the privacy page mentions My Schedule with the gates closed');
  for (const f of served()) {
    const body = readFileSync(f, 'utf8');
    expect(!body.includes(marker) && !/Fixture (?:Speaker|Session)/.test(body), `${f}: the fixture reaches a normal build`);
    if (!existsSync('src/data/history/2025.ts')) expect(!/class="credit"/.test(body), `${f}: a normal build shows a credit with no 2025 record`);
  }
} finally {
  await browser.close().catch(() => {});
  server?.kill();
  if (process.argv.includes('--keep-dist')) console.log('dist/ is left as the last build.');
}

if (failures.length) {
  console.error(`Program tests failed (${failures.length} of ${checks}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`Program tests passed: ${checks} checks.`);
