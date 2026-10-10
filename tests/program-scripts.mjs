// The program pages' browser scripts, src/scripts/schedule.js and src/scripts/sw.js, with no browser and no build:
//   - My Schedule's calendar file escapes text as the build's calendar files do (src/lib/ics.ts);
//   - /schedule.js draws the stars before it registers the offline worker, and a browser that throws on
//     navigator.serviceWorker (storage blocked) still gets them; from the day after Event Day it never asks;
//   - /sw.js keeps the program pages, their CSS, fonts and images (the logos in /brand/ too) and /schedule.js, and
//     nothing else, and both scripts stay within their budgets as built.
// tests/run-local.mjs runs it; tests/run-program.mjs drives both scripts in a browser.
// Usage: node tests/program-scripts.mjs
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { importTs } from '../scripts/lib/import-ts.mjs';

const failures = [];
let checks = 0;
const expect = (ok, message) => { checks += 1; if (!ok) failures.push(message); };

const schedule = readFileSync('src/scripts/schedule.js', 'utf8');
const sw = readFileSync('src/scripts/sw.js', 'utf8');
// As src/pages/[script].js.ts builds them: the worker's version is the build's time, and offline use is on or off.
const buildSchedule = (offline) => schedule.replace('var OFFLINE = true,', `var OFFLINE = ${offline},`);
const buildSw = (off) => sw.replace("var VERSION = 'BUILD', OFF = false,", `var VERSION = '${new Date().toISOString()}', OFF = ${off},`);

// My Schedule's calendar file escapes a backslash, a semicolon, a comma and a line break like src/lib/ics.ts.
const { calendar } = await importTs(new URL('../src/lib/ics.ts', import.meta.url));
const escapeSource = schedule.match(/function x\(v\) \{[^\n]*\}/)?.[0];
const escape = escapeSource ? new Function(`${escapeSource}; return x;`)() : null;
for (const title of ['Back\\slash; semi, comma', 'Two\nlines', 'Windows\r\nline', 'Ends with a backslash \\', 'Plain']) {
  const summary = calendar('Test', [{ uid: 'u', title, start: '2027-04-23T10:00', end: '2027-04-23T10:30', location: 'Room', url: 'https://kcdtexas.org/' }], '20270101T000000Z')
    .replace(/\r\n /g, '').split('\r\n').find((l) => l.startsWith('SUMMARY:'));
  expect(escape && `SUMMARY:${escape(title)}` === summary, `My Schedule writes ${JSON.stringify(title)} as ${JSON.stringify(escape?.(title))}, the build's calendar files as ${JSON.stringify(summary?.slice(8))}`);
}

/** Runs the built /schedule.js on a page with one star, as a browser would, and says what happened. */
function runSchedule(offline, serviceWorker) {
  const seen = { read: false, registered: null, starShown: false, threw: null };
  const star = { dataset: { star: 's1' }, hidden: true, querySelector: () => ({ textContent: 'Add to My Schedule' }) };
  const document = {
    readyState: 'complete',
    body: { appendChild() {} },
    createElement: () => ({ setAttribute() {} }),
    querySelector: () => null,
    querySelectorAll: (q) => (q === '[data-star]' ? [star] : []),
    addEventListener() {},
  };
  const navigator = {};
  Object.defineProperty(navigator, 'serviceWorker', {
    get() {
      seen.read = true;
      if (serviceWorker === 'throws') throw new Error('SecurityError: the operation is insecure');
      return { ready: new Promise(() => {}), register: (url, options) => { seen.registered = { url, scope: options?.scope, starShown: !star.hidden }; return Promise.resolve(); } };
    },
  });
  try {
    runInNewContext(buildSchedule(offline), {
      document, navigator, localStorage: { getItem: () => null, setItem() {} }, matchMedia: () => ({ matches: false }),
      location: { hash: '', href: 'https://kcdtexas.org/2027/sessions/a/' }, performance: { getEntriesByType: () => [] }, addEventListener() {}, Intl,
    });
  } catch (e) { seen.threw = e.message; }
  seen.starShown = !star.hidden;
  return seen;
}
let r = runSchedule(true, 'works');
expect(!r.threw && r.starShown && r.registered?.url === '/sw.js' && r.registered?.scope === '/2027/' && r.registered?.starShown, `with offline use on, /schedule.js ${JSON.stringify(r)}: it should draw the star, then register /sw.js with the scope /2027/`);
r = runSchedule(true, 'throws');
expect(!r.threw && r.starShown, `a browser that throws on navigator.serviceWorker stops /schedule.js: ${JSON.stringify(r)}`);
r = runSchedule(false, 'throws');
expect(!r.threw && r.starShown && !r.read, `from the day after Event Day, /schedule.js still asks for navigator.serviceWorker: ${JSON.stringify(r)}`);

// What /sw.js keeps: same-origin program pages, their CSS, fonts and images, the logos in /brand/, and /schedule.js.
const keep = new Function(`${sw.match(/^var KEEP = [^\n]+$/m)?.[0] ?? 'var KEEP = /$^/;'} return KEEP;`)();
for (const [path, want] of [
  ['/2027/schedule/', true], ['/2027/today/', true], ['/2027/sessions/a-talk/', true], ['/2027/speakers/', true],
  ['/2027/speakers/a-person/', true], ['/2027/speakers/a-person-small.webp', true], ['/_astro/index.a1b2.css', true],
  ['/_astro/photo.a1b2.webp', true], ['/fonts/archivo/archivo-latin-wdth-normal.woff2', true], ['/schedule.js', true],
  ['/brand/kcd-logo-black.svg', true], ['/brand/kcd-logo-white.svg', true], ['/brand/badge-2027.png', true],
  ['/theme.js', false], ['/now.js', false], ['/sw.js', false], ['/2027/cfp/', false], ['/2027/schedule.ics', false],
  ['/2027/sessions/a-talk.ics', false], ['/about/', false], ['/', false], ['/cards/default.png', false], ['/brand/notes.txt', false],
]) expect(keep.test(path) === want, `/sw.js ${want ? "doesn't keep" : 'keeps'} ${path}`);

// The budgets check-dist holds them to: /sw.js at most 3 KB and /schedule.js at most 8 KB, as built.
for (const off of [false, true]) expect(Buffer.byteLength(buildSw(off)) <= 3 * 1024 && buildSw(off) !== sw, `/sw.js is ${Buffer.byteLength(buildSw(off))} bytes as built, over 3,072`);
for (const offline of [true, false]) expect(Buffer.byteLength(buildSchedule(offline)) <= 8 * 1024, `/schedule.js is ${Buffer.byteLength(buildSchedule(offline))} bytes as built, over 8,192`);

if (failures.length) {
  console.error(`Program script tests failed (${failures.length} of ${checks}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`Program script tests passed: ${checks} checks.`);
