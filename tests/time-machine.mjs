// The time machine's checks: what the built pages must say on each key day, and how to compare two
// builds while ignoring what changes every day by design (where NOW sits and how far each phase is filled).
// tests/run-time-machine.mjs builds the site at each day with scripts/build.sh --now and runs these.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
// The phase rail's rows in page order: key, state, name, start and end as read aloud (the dash is hidden, " to "
// is read), status, and whether the status is hidden on screen (`pr-lane--echo`) or from screen readers too.
const lanes = (html) => [...html.matchAll(/<li class="pr-lane pr-lane--([a-z]+) pr-lane--(future|live|past)( pr-lane--echo)?">([\s\S]*?)<\/li>/g)]
  .map(([, key, state, echo, body]) => ({
    key, state,
    name: body.match(/<p class="it-name">([^<]*)<\/p>/)?.[1],
    when: text(body.match(/<p class="pr-when">(.*?)<\/p>/)?.[1].replace(/<span class="pr-dash"[^>]*>[^<]*<\/span>/g, '') ?? '').trim(),
    status: body.match(/<p class="it-st"[^>]*>([^<]*)<\/p>/)?.[1],
    onScreen: !echo,
    ariaHidden: /<p class="it-st" aria-hidden="true">/.test(body),
  }));
const lane = (html, key) => lanes(html).find((l) => l.key === key) ?? {};
// Name -> status for the rows and the tickets line (which has no start and end).
const keyDates = (html) => [...html.matchAll(/<p class="it-name">([^<]*)<\/p>(?:<p class="pr-when">.*?<\/p>)?<p class="it-st"(?: aria-hidden="true")?>([^<]*)<\/p>/g)]
  .reduce((all, [, name, status]) => ({ ...all, [name]: status }), {});
const tixLine = (html) => html.match(/<div class="pr-tix-line[^"]*"><p class="it-name">([^<]*)<\/p><p class="it-st">([^<]*)<\/p>/)?.slice(1, 3);
const nowTags = (html) => [...html.matchAll(/<svg class="(pr-now(?: [a-z-]+)*)"/g)].map((m) => m[1].split(' '));
const overlayNow = (html) => nowTags(html).find((c) => !c.includes('pr-now--tick') && !c.includes('pr-now--arrow'));
const dated = (html) => lanes(html).filter((l) => l.key !== 'tix');
const cardOf = (html) => html.match(/<meta property="og:image" content="[^"]*\/cards\/([a-z-]+)\.png"/)?.[1];
const cfpCallout = (html) => html.match(/<p class="page-callout cfp-callout">\s*<b>([^<]*)<\/b>/)?.[1];
// Whether a row's fill is grey (finished), and whether the Sponsorships row says "Closed" exactly when it is grey.
const fillPast = (html, key) => new RegExp(`<li class="pr-lane pr-lane--${key} [^"]*">(?:(?!</li>)[\\s\\S])*<rect class="pr-done is-past"`).test(html);
const sponsorsAgree = (html) => (lane(html, 'spons').state === 'past') === (lane(html, 'spons').when === 'Closed');
const sections = (html) => [...html.matchAll(/<section [^>]*class="([a-z]+)"/g)].map((m) => m[1]).join();

/** What each key day must show. `home` and `cfp` are the built HTML of / and /2027/cfp/. */
export const DAYS = {
  '2026-10-28': ({ home, cfp }) => ({
    'phase rail rows in order: Sponsorships, CFP, Schedule, event': lanes(home).map((l) => l.key).join() === 'spons,cfp,sched,event',
    'phase rail: Sponsorships live': lane(home, 'spons').state === 'live',
    'phase rail: CFP future': lane(home, 'cfp').state === 'future',
    'key dates: CFP "Opens Nov 1", hidden on screen': keyDates(home)['Call for proposals'] === 'Opens Nov 1' && !lane(home, 'cfp').onScreen,
    'phase rail: the rows read "Open now", "Nov 1 to Jan 31", "Mar 1" (no end) and "Apr 23"':
      lane(home, 'spons').when === 'Open now' && lane(home, 'cfp').when === 'Nov 1 to Jan 31' && lane(home, 'sched').when === 'Mar 1' && lane(home, 'event').when === 'Apr 23',
    'hero: "Sponsorships: open now"': /Sponsorships: open now/.test(text(home)),
    'CFP page: "Opens Nov 1."': cfpCallout(cfp) === 'Opens Nov 1.',
    '/2027/cfp/ uses the default card': cardOf(cfp) === 'default',
    'home page sections in the one order for every width': sections(home) === 'hero,dates,wall,sponsor,stage,speak,day,attend',
    'key dates: tickets line "Coming soon"': tixLine(home)?.join() === 'Tickets,Coming soon' && keyDates(home).Tickets === 'Coming soon',
    'no tickets row before the sale day is set': !/pr-lane--tix/.test(home),
    'NOW on the phase rail': Boolean(overlayNow(home)),
  }),
  '2026-11-01': ({ home, cfp }) => ({
    'phase rail: CFP live, "Open now" on screen': lane(home, 'cfp').state === 'live' && lane(home, 'cfp').status === 'Open now' && lane(home, 'cfp').onScreen && !lane(home, 'cfp').ariaHidden,
    'hero: "Call for proposals: open now"': /Call for proposals: open now/.test(text(home)),
    'CFP page: "Open now."': cfpCallout(cfp) === 'Open now.' || /class="btn"[^>]*>[^<]*Submit/i.test(cfp),
    '/2027/cfp/ uses the cfp card': cardOf(cfp) === 'cfp',
  }),
  '2027-01-31': ({ home, cfp }) => ({
    'phase rail: CFP still live, "Open now" on screen': lane(home, 'cfp').state === 'live' && lane(home, 'cfp').status === 'Open now' && lane(home, 'cfp').onScreen,
    '/2027/cfp/ still uses the cfp card': cardOf(cfp) === 'cfp',
    'tickets still "Coming soon"': keyDates(home).Tickets === 'Coming soon',
  }),
  '2027-02-01': ({ home, cfp }) => ({
    'phase rail: CFP past, "Closed"': lane(home, 'cfp').state === 'past' && keyDates(home)['Call for proposals'] === 'Closed',
    'CFP page: "Closed."': cfpCallout(cfp) === 'Closed.',
    '/2027/cfp/ back to the default card': cardOf(cfp) === 'default',
    'key dates: tickets still "Coming soon"': keyDates(home).Tickets === 'Coming soon',
  }),
  '2027-03-01': ({ home }) => ({
    'key dates: Schedule "Mar 1"': keyDates(home).Schedule === 'Mar 1',
    'NOW on the phase rail': Boolean(overlayNow(home)),
  }),
  '2027-04-23': ({ home }) => ({
    'phase rail: event live, "Today · Dallas"': lane(home, 'event').state === 'live' && keyDates(home)['KCD Texas 2027'] === 'Today · Dallas',
    'NOW tag with at-event': Boolean(overlayNow(home)?.includes('at-event')),
    'phase rail: the Schedule still runs on Event Day': lane(home, 'sched').state !== 'past' && !fillPast(home, 'sched'),
    'phase rail: Sponsorships are grey only when they read "Closed"': sponsorsAgree(home),
  }),
  '2027-04-24': ({ home }) => ({
    'key dates: "Apr 23 · Dallas" again': keyDates(home)['KCD Texas 2027'] === 'Apr 23 · Dallas',
    'no NOW in the built page': !/pr-now/.test(home),
    'every dated row past': dated(home).length === 4 && dated(home).every((l) => l.state === 'past'),
    'phase rail: Sponsorships "Closed", with the thank-you line': lane(home, 'spons').when === 'Closed' && /Thanks to every 2027 sponsor\./.test(home),
    'hero: "Sponsorships: closed"': /Sponsorships: closed/.test(text(home)),
  }),
  '2027-05-01': ({ home }) => ({
    'no NOW in the built page': !/pr-now/.test(home),
    'every dated row past': dated(home).length === 4 && dated(home).every((l) => l.state === 'past'),
  }),
};

/** One line per page of what the key day shows, for the report. */
export function summary({ home, cfp }) {
  const k = keyDates(home);
  const rows = lanes(home).map((l) => `${l.key} ${l.state}`).join(', ');
  return `Rows ${rows} | CFP ${k['Call for proposals']} | Tickets ${k.Tickets} | Schedule ${k.Schedule} | Event ${k['KCD Texas 2027']} | NOW ${overlayNow(home) ? overlayNow(home).slice(1).join(' ') || 'yes' : 'no'} | cfp page "${cfpCallout(cfp) ?? 'submit button'}", card ${cardOf(cfp)}`;
}

/** The parts of a page that change every day by design: where NOW sits (`x`, `at-start`, `at-end` on every
 * `svg.pr-now…`) and how far each running phase is filled (`width` and `is-past` on every `rect.pr-done`). */
export function normalize(html) {
  return html
    .replace(/<svg class="(pr-now[^"]*)" x="[^"]*"/g, (_, c) => `<svg class="${c.split(' ').filter((x) => x !== 'at-start' && x !== 'at-end').join(' ')}" x="X"`)
    .replace(/<rect class="pr-done(?: is-past)?"( x="[^"]*") width="[^"]*"/g, '<rect class="pr-done"$1 width="X"');
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
