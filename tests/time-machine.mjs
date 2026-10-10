// The time machine's checks: what the built pages must say on each key day, and how to compare two
// builds while ignoring what changes every day by design (where NOW sits and how far each phase is filled).
// tests/run-time-machine.mjs builds the site at each day with scripts/build.sh --now and runs these.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { cfpSaleDay, laterOnSale, laterSaleDay } from './sample-days.mjs';

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
// The header's filled button: its label and where it goes.
const headCta = (html) => html.match(/<a class="btn btn--sm head-cta" href="([^"]*)"(?: aria-current="page")?>([^<]*)<\/a>/)?.slice(1, 3) ?? [];
// The wide nav's link labels (the phone menu is a separate list).
const navLabels = (html) => [...(html.match(/<nav class="nav" aria-label="Main">([\s\S]*?)<\/nav>/)?.[1] ?? '').matchAll(/<a [^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);
const menuLabels = (html) => [...(html.match(/<nav class="menu-panel" aria-label="Main, phone">([\s\S]*?)<\/nav>/)?.[1] ?? '').matchAll(/<a [^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);
const allLinks = 'Speak,Sponsor,Attend,2026 talks,About';
const navWithout = (html) => navLabels(html).join() === 'Speak,Attend,2026 talks,About' && menuLabels(html).join() === allLinks;
const navWith = (html) => navLabels(html).join() === allLinks && menuLabels(html).join() === allLinks;
// The home page's sections in DOM order, by their last class ("speak program" is the program block).
const sections = (html) => [...html.matchAll(/<section [^>]*class="([a-z ]+)"/g)].map((m) => m[1].split(' ').at(-1)).join();
const sectionOf = (html, cls) => html.match(new RegExp(`<section [^>]*class="(?:[a-z ]* )?${cls}"[\\s\\S]*?</section>`))?.[0] ?? '';
// The hero's doors: filled or outlined, where they go, and their words.
const heroDoors = (html) => [...sectionOf(html, 'hero').matchAll(/<a class="btn btn--door( btn--line)?" href="([^"]*)">([^<]*)<\/a>/g)]
  .map(([, line, href, label]) => ({ filled: !line, href, label: label.trim() }));
const doorsAre = (html, ...want) => heroDoors(html).map((d) => `${d.filled ? 'filled' : 'line'} ${d.label}`).join() === want.join();
// The hero bill's words: the notes, then the end line.
const bill = (html) => text(html.match(/<ul class="slots[^"]*">([\s\S]*?)<\/ul>/)?.[1].replace(/<\/li>/g, ' | ') ?? '').replace(/ \| $/, '').replace(/\s+\|/g, ' |').replace(/\s*→\s*/g, ' ').trim();
// Every link's words, and the open wall slot's label (its link holds spans).
const linkWords = (html) => [...html.matchAll(/<a [^>]*>([^<]*)<\/a>/g)].map((m) => m[1].trim());
const slotLabel = (html) => html.match(/<span class="slot-label">([^<]*)<\/span>/)?.[1];
// What asks for sponsors: a link that starts with "Sponsor" (not "Sponsors"), the open wall slot, the pitch.
const sponsorAsks = (html) => [
  ...linkWords(html).filter((w) => /^Sponsor(?!s\b)/.test(w)),
  ...(slotLabel(html) ? [`slot "${slotLabel(html)}"`] : []),
  ...(/<section id="sponsor"/.test(html) ? ['the pitch'] : []),
];
// What invites proposals, once the call is closed: "Submit a talk" or the nav's "Speak".
const talkAsks = (html) => linkWords(html).filter((w) => w === 'Submit a talk' || w === 'Speak');
const navIs = (html, labels) => navLabels(html).join() === labels && menuLabels(html).join() === labels;
const countdownNav = 'Program,Sponsor,Attend,2026 talks,About';
const closedNav = 'Program,Sponsors,Attend,2026 talks,About';
const sponsorsPage = (html) => (/<p class="page-callout"><b>Sponsorships are closed\.<\/b>/.test(html) ? 'closed' : 'open');
const chapter = 'https://community2.cncf.io/kcd-texas/';

/** What each key day must show. `home`, `cfp`, `schedule` and `sponsors` are the built HTML of /, /2027/cfp/,
 *  /2027/schedule/ and /2027/sponsors/. */
export const DAYS = {
  '2026-10-28': ({ home, cfp }) => ({
    'nav: no "Sponsor" link while the button says "Sponsor"; the phone menu keeps it': navWithout(home) && navWithout(cfp),
    'header: "Sponsor", to the hero\'s Sponsor door': headCta(home)[1] === 'Sponsor' && new RegExp(`class="btn btn--door" href="${headCta(home)[0]}"`).test(home),
    'phase rail rows in order: Sponsorships, CFP, Schedule, event': lanes(home).map((l) => l.key).join() === 'spons,cfp,sched,event',
    'phase rail: Sponsorships live': lane(home, 'spons').state === 'live',
    'phase rail: CFP future': lane(home, 'cfp').state === 'future',
    'key dates: CFP "Opens Nov 1", hidden on screen': keyDates(home)['Call for proposals'] === 'Opens Nov 1' && !lane(home, 'cfp').onScreen,
    'phase rail: the rows read "Open now", "Nov 1 to Jan 31", "Mar 1" (no end) and "Apr 23"':
      lane(home, 'spons').when === 'Open now' && lane(home, 'cfp').when === 'Nov 1 to Jan 31' && lane(home, 'sched').when === 'Mar 1' && lane(home, 'event').when === 'Apr 23',
    'hero: "Sponsorships: open now"': /Sponsorships: open now/.test(text(home)),
    'hero: Sponsor filled, then "Submit a talk" outlined': doorsAre(home, 'filled Sponsor KCD Texas 2027', 'line Submit a talk'),
    'CFP page: "Opens Nov 1."': cfpCallout(cfp) === 'Opens Nov 1.',
    '/2027/cfp/ uses the default card': cardOf(cfp) === 'default',
    'home page sections in the one order for every width': sections(home) === 'hero,dates,wall,sponsor,stage,speak,day,attend',
    'key dates: tickets line "Coming soon"': tixLine(home)?.join() === 'Tickets,Coming soon' && keyDates(home).Tickets === 'Coming soon',
    'no tickets row before the sale day is set': !/pr-lane--tix/.test(home),
    'wall: the open slot "Be the first 2027 sponsor"': slotLabel(home) === 'Be the first 2027 sponsor',
    'NOW on the phase rail': Boolean(overlayNow(home)),
  }),
  '2026-11-01': ({ home, cfp }) => ({
    'nav: the "Sponsor" link is back': navWith(home) && navWith(cfp),
    'header: "Submit a talk", to the CFP page': headCta(home).join() === '/2027/cfp/,Submit a talk' && headCta(cfp)[1] === 'Submit a talk',
    'phase rail: CFP live, "Open now" on screen': lane(home, 'cfp').state === 'live' && lane(home, 'cfp').status === 'Open now' && lane(home, 'cfp').onScreen && !lane(home, 'cfp').ariaHidden,
    'hero: "Call for proposals: open now"': /Call for proposals: open now/.test(text(home)),
    'CFP page: "Open now."': cfpCallout(cfp) === 'Open now.' || /class="btn"[^>]*>[^<]*Submit/i.test(cfp),
    '/2027/cfp/ uses the cfp card': cardOf(cfp) === 'cfp',
  }),
  '2027-01-31': ({ home, cfp }) => ({
    'header: still "Submit a talk" on the last day of the call': headCta(home).join() === '/2027/cfp/,Submit a talk',
    'phase rail: CFP still live, "Open now" on screen': lane(home, 'cfp').state === 'live' && lane(home, 'cfp').status === 'Open now' && lane(home, 'cfp').onScreen,
    '/2027/cfp/ still uses the cfp card': cardOf(cfp) === 'cfp',
    'tickets still "Coming soon"': keyDates(home).Tickets === 'Coming soon',
  }),
  '2027-02-01': ({ home, cfp, schedule, sponsors }) => ({
    'nav: "Program" for "Speak", and "Sponsor"; the phone menu the same': navIs(home, countdownNav) && navIs(cfp, countdownNav),
    'header: "Tickets", to the hero\'s filled door (ticket news until the link is in)': headCta(home).join() === `${chapter},Tickets` && heroDoors(home)[0]?.href === chapter,
    'hero: tickets filled, then the Sponsor door outlined': doorsAre(home, 'filled Get ticket news', 'line Sponsor KCD Texas 2027'),
    'hero bill: Tickets, Schedule, Sponsorships, then the 2026 talks': bill(home) === 'Tickets: coming soon | Schedule: Mar 1 | Sponsorships: open now | Watch the 2026 talks',
    'home order: the wall third, Attend fourth, the pitch last': sections(home) === 'hero,dates,wall,attend,program,stage,day,sponsor',
    'no "Submit a talk" or "Speak" on any page checked': [home, cfp, schedule, sponsors].every((h) => !talkAsks(h).length),
    'wall: the open slot stays': slotLabel(home) === 'Be the first 2027 sponsor',
    'phase rail: CFP past, "Closed"': lane(home, 'cfp').state === 'past' && keyDates(home)['Call for proposals'] === 'Closed',
    'key dates: Schedule "Mar 1", Sponsorships "Open now"': keyDates(home).Schedule === 'Mar 1' && lane(home, 'spons').when === 'Open now',
    'CFP page: "Closed."': cfpCallout(cfp) === 'Closed.',
    '/2027/cfp/ back to the default card': cardOf(cfp) === 'default',
    'key dates: tickets still "Coming soon"': keyDates(home).Tickets === 'Coming soon',
    'sponsors page: open': sponsorsPage(sponsors) === 'open',
    'attend: the manager letter "coming soon", no month': /An approval letter is coming soon,/.test(text(home)) && !/coming in November/.test(text(home)),
  }),
  '2027-02-28': ({ home }) => ({
    'key dates: Schedule still "Mar 1", with its outline': keyDates(home).Schedule === 'Mar 1' && /pr-lane--sched [^"]*">(?:(?!<\/li>)[\s\S])*<rect class="pr-span"/.test(home),
    'hero bill: "Schedule: Mar 1"': /Schedule: Mar 1/.test(bill(home)),
  }),
  '2027-03-01': ({ home, cfp, schedule }) => ({
    'key dates: Schedule "Coming soon", with no date': lane(home, 'sched').when === 'Coming soon' && keyDates(home).Schedule === 'Coming soon',
    'key dates: no Schedule bar or fill for /now.js to paint': !/pr-lane--sched [^"]*">(?:(?!<\/li>)[\s\S])*<rect class="pr-(?:span|done)/.test(home),
    'hero bill: "Schedule: coming soon"': /Schedule: coming soon/.test(bill(home)),
    'program block: "coming soon", no "Mar 1"': /Speakers, keynotes and the Schedule: coming soon/.test(text(home)) && !/Schedule: Mar 1/.test(text(home)),
    'schedule page and CFP page: no "Mar 1"': [schedule, cfp].every((h) => !/Mar 1\b/.test(text(h.replace(/<head>[\s\S]*?<\/head>/, '')))),
    'NOW on the phase rail': Boolean(overlayNow(home)),
  }),
  '2027-03-31': ({ home }) => ({
    'nav: "Sponsor" still; sponsorships run through Event Day': navIs(home, countdownNav),
    'header: still "Tickets"': headCta(home)[1] === 'Tickets',
    'hero: the Sponsor door still outlined': doorsAre(home, 'filled Get ticket news', 'line Sponsor KCD Texas 2027'),
    'phase rail: Sponsorships still "Open now"': lane(home, 'spons').state === 'live' && lane(home, 'spons').when === 'Open now',
  }),
  '2027-04-01': ({ home, sponsors }) => ({
    'nav: still "Sponsor" (Apr 1 is no rebuild day)': navIs(home, countdownNav),
    'hero bill: "Sponsorships: open now"': /Sponsorships: open now/.test(bill(home)),
    'the pitch still last': sections(home).endsWith(',sponsor'),
    'sponsors page: still open': sponsorsPage(sponsors) === 'open',
  }),
  '2027-04-22': ({ home }) => ({
    'the last day that asks: the Sponsor door, the pitch and the open slot': doorsAre(home, 'filled Get ticket news', 'line Sponsor KCD Texas 2027') && sections(home).endsWith(',sponsor') && slotLabel(home) === 'Be the first 2027 sponsor',
    'home order: the wall still third': sections(home).split(',')[2] === 'wall',
  }),
  '2027-04-23': ({ home, cfp, sponsors }) => ({
    'phase rail: event live, "Today · Dallas"': lane(home, 'event').state === 'live' && keyDates(home)['KCD Texas 2027'] === 'Today · Dallas',
    'NOW tag with at-event': Boolean(overlayNow(home)?.includes('at-event')),
    'phase rail: Sponsorships still "Open now" on their last day, with the thank-you line, no ask': lane(home, 'spons').state === 'live' && lane(home, 'spons').when === 'Open now' && /Thanks to every 2027 sponsor\./.test(home),
    'phase rail: Sponsorships are grey only when they read "Closed"': sponsorsAgree(home),
    'nav: "Sponsors"': navIs(home, closedNav) && navIs(cfp, closedNav),
    'header: "Travel", to the travel page': headCta(home).join() === '/2027/travel/,Travel',
    'hero: one filled button, "Getting to Dallas"': doorsAre(home, 'filled Getting to Dallas'),
    'hero bill: the statement "Today in Dallas"': bill(home) === 'Today in Dallas',
    'no sponsor call to action on the home page or in the header': !sponsorAsks(home).length && !sponsorAsks(cfp).length,
    'home order: Hero, Key dates, Wall, Program, Attend': sections(home) === 'hero,dates,wall,program,attend',
    'sponsors page: still open on Event Day': sponsorsPage(sponsors) === 'open',
    'key dates: no Tickets line and no Schedule row for what never came': !tixLine(home) && !/pr-lane--sched/.test(home) && !/Coming soon/.test(text(home)),
    'program block: only the 2026 talks, nothing "coming soon"': /Watch the 2026 talks/.test(text(home)) && !/Schedule: coming soon/.test(text(home)),
  }),
  '2027-04-24': ({ home, cfp, sponsors }) => ({
    'no key dates and no NOW in the Recap': !/class="dates"/.test(home) && !/pr-now/.test(home),
    'nav: "Sponsors"': navIs(home, closedNav) && navIs(cfp, closedNav),
    'header: "2026 talks", to the 2026 page': headCta(home).join() === '/2026/,2026 talks',
    'hero: one filled button, "2026 talks"': doorsAre(home, 'filled 2026 talks'),
    'hero bill: the statement "Thank you, Dallas"': bill(home) === 'Thank you, Dallas',
    'no sponsor call to action on the home page or in the header': !sponsorAsks(home).length && !sponsorAsks(cfp).length,
    'home order: Hero, Wall, Program, Day': sections(home) === 'hero,wall,program,day',
    'program block: only the 2026 talks, nothing "coming soon"': /Watch the 2026 talks/.test(text(home)) && !/coming soon/i.test(text(home)),
    'sponsors page: "Sponsorships are closed.", thank you': sponsorsPage(sponsors) === 'closed' && /Thank you to every KCD Texas 2027 sponsor\./.test(sponsors),
  }),
  '2027-05-01': ({ home }) => ({
    'no NOW in the built page': !/pr-now/.test(home),
    'still the Recap': headCta(home)[1] === '2026 talks' && sections(home) === 'hero,wall,program,day',
  }),
};

// The test-only flags (scripts/build.sh): each run builds once with its flags and checks the pages. The sample
// ticket day gives the stand-in ticket link, the KCD Texas chapter page, so "Get tickets" goes there too.
export const RUNS = [
  { name: 'tickets on sale in the CFP Phase', flags: ['--now', cfpSaleDay, '--tickets-day', cfpSaleDay], checks: ({ home }) => ({
    'header: still "Submit a talk"': headCta(home)[1] === 'Submit a talk',
    'hero: Sponsor filled, "Submit a talk" outlined': doorsAre(home, 'filled Sponsor KCD Texas 2027', 'line Submit a talk'),
    'hero bill: "Tickets: on sale now" third': bill(home) === 'Sponsorships: open now | Call for proposals: open now | Tickets: on sale now | Your End-User Story here',
    'home order: Attend fourth': sections(home) === 'hero,dates,wall,attend,sponsor,stage,speak,day',
  }) },
  { name: 'tickets on sale in the Countdown', flags: ['--now', '2027-02-01', '--tickets-day', cfpSaleDay], checks: ({ home }) => ({
    'header: "Tickets", where the hero\'s "Get tickets" goes': headCta(home)[1] === 'Tickets' && doorsAre(home, 'filled Get tickets', 'line Sponsor KCD Texas 2027') && heroDoors(home)[0].href === headCta(home)[0],
    'hero bill: "Tickets: on sale now"': bill(home) === 'Tickets: on sale now | Schedule: Mar 1 | Sponsorships: open now | Watch the 2026 talks',
    'home order: as without tickets': sections(home) === 'hero,dates,wall,attend,program,stage,day,sponsor',
  }) },
  { name: 'a later sale day in the Countdown', flags: ['--now', '2027-02-01', '--tickets-day', laterSaleDay], checks: ({ home }) => ({
    'header: "Tickets", to ticket news until the sale day': headCta(home).join() === `${chapter},Tickets` && doorsAre(home, 'filled Get ticket news', 'line Sponsor KCD Texas 2027'),
    [`hero bill: "Tickets: ${laterOnSale}"`]: bill(home) === `Tickets: ${laterOnSale} | Schedule: Mar 1 | Sponsorships: open now | Watch the 2026 talks`,
  }) },
  { name: 'the program public in the Countdown', flags: ['--now', '2027-03-10', '--program-public'], checks: ({ home, schedule }) => ({
    'header: still "Tickets"': headCta(home)[1] === 'Tickets',
    'hero bill: "Schedule: out now"': bill(home) === 'Tickets: coming soon | Schedule: out now | Sponsorships: open now | Watch the 2026 talks',
    'key dates: Schedule "Out now" on screen, with its bar': keyDates(home).Schedule === 'Out now' && lane(home, 'sched').onScreen && /pr-lane--sched [^"]*">(?:(?!<\/li>)[\s\S])*<rect class="pr-done/.test(home),
    'key dates: the Schedule row links "See the Schedule"': /pr-lane--sched [^"]*">(?:(?!<\/li>)[\s\S])*<a href="\/2027\/schedule\/">See the Schedule<\/a>/.test(home),
    'the home page and the schedule page say "Sample"': /\bSample\b/.test(text(home)) && /\bSample\b/.test(text(schedule)),
  }) },
  { name: 'the program public on Event Day', flags: ['--now', '2027-04-23', '--program-public'], checks: ({ home }) => ({
    'header: "Schedule", to the schedule page': headCta(home).join() === '/2027/schedule/,Schedule',
    'hero: one filled button, "See the Schedule"': doorsAre(home, 'filled See the Schedule'),
    'no sponsor call to action': !sponsorAsks(home).length,
  }) },
  { name: 'the program public in the Recap', flags: ['--now', '2027-04-24', '--program-public'], checks: ({ home }) => ({
    'header: "Schedule", to the schedule page': headCta(home).join() === '/2027/schedule/,Schedule',
    'hero: one filled button, "See the Schedule"': doorsAre(home, 'filled See the Schedule'),
  }) },
  { name: 'sample sponsors in the CFP Phase', flags: ['--now', '2026-10-28', '--sponsors-sample'], checks: ({ home }) => ({
    'wall: 2027 leads, "Join them", the 2026 wall below as thanks': /Sample Platinum sponsor/.test(home) && slotLabel(home) === 'Join them' && /Thanks to our 2026 sponsors/.test(home),
    'home order: as without': sections(home) === 'hero,dates,wall,sponsor,stage,speak,day,attend',
  }) },
  { name: 'sample sponsors in the Countdown', flags: ['--now', '2027-02-01', '--sponsors-sample'], checks: ({ home, sponsors }) => ({
    'wall: only 2027, "KCD Texas 2027 is made possible by", "Join them"': /KCD Texas 2027 is made possible by/.test(home) && slotLabel(home) === 'Join them' && !/Thanks to our 2026 sponsors/.test(home),
    'home order: the wall third': sections(home) === 'hero,dates,wall,attend,program,stage,day,sponsor',
    'sponsors page: the 2027 wall says "Sample"': /Sample Platinum sponsor/.test(sponsors),
  }) },
  { name: 'sample sponsors on Event Day', flags: ['--now', '2027-04-23', '--sponsors-sample'], checks: ({ home }) => ({
    'wall: third, with no open slot': sections(home).split(',')[2] === 'wall' && !slotLabel(home) && /Sample Platinum sponsor/.test(home),
    'no sponsor call to action': !sponsorAsks(home).length,
  }) },
  { name: 'sample sponsors in the Recap', flags: ['--now', '2027-04-24', '--sponsors-sample'], checks: ({ home }) => ({
    'wall: "Thank you to our 2027 sponsors", second': /Thank you to our 2027 sponsors/.test(home) && sections(home).split(',')[1] === 'wall',
    'no sponsor call to action': !sponsorAsks(home).length,
  }) },
];

/** One line per page of what the key day shows, for the report. */
export function summary({ home, cfp }) {
  const k = keyDates(home);
  const rows = lanes(home).map((l) => `${l.key} ${l.state}`).join(', ');
  const rest = `header "${headCta(home)[1]}" | cfp page "${cfpCallout(cfp) ?? 'submit button'}", card ${cardOf(cfp)}`;
  if (!rows) return `No key dates | ${rest}`;
  return `Rows ${rows} | CFP ${k['Call for proposals']} | Tickets ${k.Tickets} | Schedule ${k.Schedule} | Event ${k['KCD Texas 2027']} | NOW ${overlayNow(home) ? overlayNow(home).slice(1).join(' ') || 'yes' : 'no'} | ${rest}`;
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
