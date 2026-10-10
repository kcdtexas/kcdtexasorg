// Prints every day on which the built pages change, from the Edition file. The live site is rebuilt
// rarely (ADR 0010), so date-driven text only changes when a build runs: a scheduled job builds and
// deploys on each of these days, early in the morning Central time. NOW and the phase fills on the key
// dates move in the browser (/now.js), so they need no date of their own.
// tests/run-time-machine.mjs proves the list: each day changes the output and the days between don't.
//
// Usage: node scripts/rebuild-dates.mjs [--json] [--from YYYY-MM-DD] [--tickets-day YYYY-MM-DD] [--program-public]
//   --json  print [{ "day", "why" }] instead of lines
//   --from  leave out days before this one (default: all)
//   --tickets-day  include a sample ticket sale day (as build.sh --tickets-day does)
//   --program-public  as if the program were public (as build.sh --program-public does): no program day
import { importTs } from './lib/import-ts.mjs';

const { edition2027: e } = await importTs(new URL('../src/data/edition-2027.ts', import.meta.url));

const next = (day) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

export function rebuildDates({ ticketsDay = e.tickets.onSale, programPublic = false } = {}) {
  const changes = [
    { day: e.cfp.opens, why: 'the call for proposals opens: "Open now", /2027/cfp/ gets the cfp card, and the header says "Submit a talk"' },
    { day: next(e.cfp.closes), why: 'the Countdown: the call for proposals is "Closed", the header says "Tickets", the nav says "Program", and the home page puts tickets first' },
    // The program's day, while the program isn't public: on time, its release builds this day anyway; late, this
    // build says "coming soon" instead of the date.
    ...(programPublic ? [] : [{ day: e.schedule, why: 'the program\'s day: until the program is public, the Schedule reads "coming soon" in the hero, the key dates and the program block' }]),
    // Sponsorships close after their last day, which is Event Day until one is set.
    { day: next(e.sponsorships.closes ?? e.eventDay), why: 'sponsorships are closed: "Closed" on the key dates, and the sponsors page says thank you' },
    // Only once CNCF sets the sale day; until then the key dates say "Coming soon" every day.
    ...(ticketsDay ? [{ day: ticketsDay, why: 'tickets: "On sale now" on the key dates' }] : []),
    { day: e.eventDay, why: 'Event Day: "Today" on the key dates and in the hero, and no Sponsor button, pitch or open wall slot' },
    { day: next(e.eventDay), why: 'the Recap: "Thank you, Dallas", no key dates, and NOW is gone' },
  ];
  // One build covers every change on the same day.
  const byDay = new Map();
  for (const c of changes) byDay.set(c.day, byDay.has(c.day) ? `${byDay.get(c.day)}; ${c.why}` : c.why);
  return [...byDay].map(([day, why]) => ({ day, why })).sort((a, b) => a.day.localeCompare(b.day));
}

if (import.meta.main ?? process.argv[1]?.endsWith('rebuild-dates.mjs')) {
  const args = process.argv.slice(2);
  const from = args.includes('--from') ? args[args.indexOf('--from') + 1] : '';
  const ticketsDay = args.includes('--tickets-day') ? args[args.indexOf('--tickets-day') + 1] : undefined;
  const days = rebuildDates({ ticketsDay, programPublic: args.includes('--program-public') }).filter((d) => d.day >= from);
  if (args.includes('--json')) console.log(JSON.stringify(days, null, 2));
  else for (const { day, why } of days) console.log(`${day}  ${why}`);
}
