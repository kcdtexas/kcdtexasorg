// Says whether today, in Central time, is a rebuild day (scripts/rebuild-dates.mjs) and why. The scheduled
// workflow .github/workflows/rebuild.yml calls it every morning and POSTs to the Netlify build hook when it is.
// docs/rebuilds.md explains the whole loop.
//
// Usage: node scripts/rebuild-today.mjs [--day YYYY-MM-DD] [--at ISO-INSTANT]
//   --day  check this Central day instead of today
//   --at   check the Central day of this instant, such as 2026-11-01T07:17:00Z (tests the time zone)
// Prints one line. When $GITHUB_OUTPUT is set (in GitHub Actions), it also writes rebuild=true or false, the
// day and the reason there.
import { appendFileSync } from 'node:fs';
import { rebuildDates } from './rebuild-dates.mjs';

/** The Central calendar day (America/Chicago) of an instant, as YYYY-MM-DD. Handles CST and CDT. */
export function centralDay(instant = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

/** Whether `day` is a rebuild day, why, and the next rebuild day after it. */
export function rebuildToday(day) {
  const days = rebuildDates();
  const hit = days.find((d) => d.day === day);
  const next = days.find((d) => d.day > day);
  return { day, rebuild: Boolean(hit), why: hit?.why ?? '', next: next ?? null };
}

if (import.meta.main ?? process.argv[1]?.endsWith('rebuild-today.mjs')) {
  const args = process.argv.slice(2);
  const value = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const dayArg = value('--day');
  const atArg = value('--at');
  if (dayArg !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(dayArg)) { console.error('--day needs a date as YYYY-MM-DD'); process.exit(2); }
  if (atArg !== undefined && Number.isNaN(Date.parse(atArg))) { console.error('--at needs an instant, such as 2026-11-01T07:17:00Z'); process.exit(2); }
  const day = dayArg ?? centralDay(atArg ? new Date(atArg) : new Date());
  const r = rebuildToday(day);
  console.log(r.rebuild
    ? `${day} (Central) is a rebuild day: ${r.why}`
    : `${day} (Central) is not a rebuild day.${r.next ? ` The next one is ${r.next.day}.` : ' No rebuild days are left in the Edition file.'}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `rebuild=${r.rebuild}\nday=${day}\nwhy=${r.why.replace(/\s+/g, ' ')}\n`);
  }
}
