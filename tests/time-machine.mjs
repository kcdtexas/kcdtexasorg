// The time machine's checks: what the built pages must say on each key day, and how to compare two
// builds while ignoring what changes every day by design ("As of" and where "Now" sits).
// tests/run-time-machine.mjs builds the site at each day with scripts/build.sh --now and runs these.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const keyDates = (html) => [...html.matchAll(/<p class="it-name">([^<]*)<\/p>\s*<p class="it-st">([^<]*)<\/p>/g)]
  .reduce((all, [, name, status]) => ({ ...all, [name]: status }), {});
const cardOf = (html) => html.match(/<meta property="og:image" content="[^"]*\/cards\/([a-z-]+)\.png"/)?.[1];
const cfpCallout = (html) => html.match(/<p class="page-callout cfp-callout">\s*<b>([^<]*)<\/b>/)?.[1];

/** What each key day must show. `home` and `cfp` are the built HTML of / and /2027/cfp/. */
export const DAYS = {
  '2026-10-28': ({ home, cfp }) => ({
    'As of Oct 28, 2026': /As of Oct 28, 2026/.test(home),
    'key dates: CFP "Opens Nov 1"': keyDates(home)['Call for proposals'] === 'Opens Nov 1',
    'CFP page: "Opens Nov 1."': cfpCallout(cfp) === 'Opens Nov 1.',
    '/2027/cfp/ uses the default card': cardOf(cfp) === 'default',
    'home page in the CFP Phase order': /<main id="main" class="main--cfp">/.test(home),
    'key dates: tickets "On sale Feb 1"': keyDates(home).Tickets === 'On sale Feb 1',
    '"Now" on the strip': /class="tl-now"/.test(home),
  }),
  '2026-11-01': ({ home, cfp }) => ({
    'key dates: CFP "Open now"': keyDates(home)['Call for proposals'] === 'Open now',
    'hero: "Call for proposals: open now"': /Call for proposals: open now/.test(text(home)),
    'CFP page: "Open now."': cfpCallout(cfp) === 'Open now.' || /class="btn"[^>]*>[^<]*Submit/i.test(cfp),
    '/2027/cfp/ uses the cfp card': cardOf(cfp) === 'cfp',
  }),
  '2027-01-31': ({ home, cfp }) => ({
    'key dates: CFP still "Open now"': keyDates(home)['Call for proposals'] === 'Open now',
    '/2027/cfp/ still uses the cfp card': cardOf(cfp) === 'cfp',
    'tickets still "On sale Feb 1"': keyDates(home).Tickets === 'On sale Feb 1',
  }),
  '2027-02-01': ({ home, cfp }) => ({
    'key dates: CFP "Closed"': keyDates(home)['Call for proposals'] === 'Closed',
    'CFP page: "Closed."': cfpCallout(cfp) === 'Closed.',
    '/2027/cfp/ back to the default card': cardOf(cfp) === 'default',
    'key dates: tickets "On sale now"': keyDates(home).Tickets === 'On sale now',
    'home page left the CFP Phase order': !/class="main--cfp"/.test(home),
  }),
  '2027-03-01': ({ home }) => ({
    'key dates: Schedule "Mar 1"': keyDates(home).Schedule === 'Mar 1',
    '"Now" on the strip': /class="tl-now"/.test(home),
  }),
  '2027-04-23': ({ home }) => ({
    'key dates: Event Day "Today · Dallas"': keyDates(home)['KCD Texas 2027'] === 'Today · Dallas',
    '"Now" on the strip': /class="tl-now"/.test(home),
  }),
  '2027-04-24': ({ home }) => ({
    'key dates: "Apr 23 · Dallas" again': keyDates(home)['KCD Texas 2027'] === 'Apr 23 · Dallas',
  }),
  '2027-05-01': ({ home }) => ({
    'no "Now" line in the built page': !/tl-now/.test(home),
    'As of May 1, 2027': /As of May 1, 2027/.test(home),
  }),
};

/** One line per page of what the key day shows, for the report. */
export function summary({ home, cfp }) {
  const k = keyDates(home);
  return `As of ${home.match(/As of ([^<]*)/)?.[1]} | CFP ${k['Call for proposals']} | Tickets ${k.Tickets} | Schedule ${k.Schedule} | Event ${k['KCD Texas 2027']} | Now ${/class="tl-now"/.test(home) ? 'yes' : 'no'} | cfp page "${cfpCallout(cfp) ?? 'submit button'}", card ${cardOf(cfp)} | Phase order ${/main--cfp/.test(home) ? 'CFP' : 'default'}`;
}

/** The parts of a page that change every day by design: "As of" and the "Now" positions. */
export function normalize(html) {
  return html
    .replace(/As of [A-Z][a-z]{2} \d{1,2}, \d{4}/g, 'As of DAY')
    .replace(/(<line class="tl-past"[^>]*\sx2=")[^"]*"/g, '$1X"')
    .replace(/(<line class="tl-now"[^>]*?)\sx1="[^"]*" x2="[^"]*"/g, '$1 x1="X" x2="X"')
    .replace(/(<text class="tl-now-label"[^>]*?)\sx="[^"]*" dx="[^"]*" y="9" text-anchor="[^"]*"/g, '$1 x="X" dx="X" y="9" text-anchor="X"');
}

/** A fingerprint of every built file, with the pages normalized. Returns Map(path -> hash). */
export function fingerprint(dist) {
  const walk = (dir) => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  const out = new Map();
  for (const file of walk(dist).sort()) {
    const buf = readFileSync(file);
    const body = file.endsWith('.html') ? normalize(buf.toString('utf8')) : buf;
    out.set(relative(dist, file).split(sep).join('/'), createHash('sha256').update(body).digest('hex'));
  }
  return out;
}

/** The files that differ between two fingerprints. */
export function diff(a, b) {
  return [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k)).sort();
}
