// Prints every day on which the built pages change, from the Edition file. The live site is rebuilt
// rarely (ADR 0010), so date-driven text only changes when a build runs: a scheduled job builds and
// deploys on each of these days, early in the morning Central time. "As of" on the key dates changes
// with every build and "Now" moves in the browser (/now.js), so neither needs a date of its own.
// tests/run-time-machine.mjs proves the list: each day changes the output and the days between don't.
//
// Usage: node scripts/rebuild-dates.mjs [--json] [--from YYYY-MM-DD] [--tickets-day YYYY-MM-DD]
//   --json  print [{ "day", "why" }] instead of lines
//   --from  leave out days before this one (default: all)
//   --tickets-day  include a sample ticket sale day (as build.sh --tickets-day does)
import { importTs } from './lib/import-ts.mjs';

const { edition2027: e, timeline } = await importTs(new URL('../src/data/edition-2027.ts', import.meta.url));

const next = (day) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

export function rebuildDates({ ticketsDay = e.tickets.onSale } = {}) {
  const changes = [
    { day: e.cfp.opens, why: 'the call for proposals opens: "Open now", and /2027/cfp/ gets the cfp card' },
    { day: next(e.cfp.closes), why: 'the call for proposals is closed: "Closed", and the home page leaves the CFP Phase order' },
    // Only once CNCF sets the sale day; until then the key dates say "Coming soon" every day.
    ...(ticketsDay ? [{ day: ticketsDay, why: 'tickets: "On sale now" on the key dates' }] : []),
    { day: e.eventDay, why: 'Event Day: "Today" on the key dates' },
    { day: next(e.eventDay), why: 'the day after Event Day: the key dates show the date again' },
    { day: timeline.end, why: 'the key-dates strip ends: no "Now" line in the built page' },
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
  const days = rebuildDates({ ticketsDay }).filter((d) => d.day >= from);
  if (args.includes('--json')) console.log(JSON.stringify(days, null, 2));
  else for (const { day, why } of days) console.log(`${day}  ${why}`);
}
