// Says whether today, in Central time, is a rebuild day (scripts/rebuild-dates.mjs) and what this run of
// .github/workflows/rebuild.yml does by the refresh policy (scripts/refresh-policy.mjs): rebuild, check the
// program for a change, or nothing. The workflow POSTs to the Netlify build hook on a rebuild, or after a check
// that finds a change. docs/rebuilds.md explains the whole loop.
//
// Usage: node scripts/rebuild-today.mjs [--day YYYY-MM-DD] [--at ISO-INSTANT] [--cron CRON] [--force true|false]
//                                       [--last-deploy ISO-INSTANT|none|unknown]
//   --day    check this Central day instead of today, as its morning run
//   --at     check this instant, such as 2026-11-01T07:17:00Z (tests the time zone)
//   --cron   the schedule that started the run (github.event.schedule); without it, a manual run
//   --force  "true" for a manual run with "force"
//   --last-deploy  when the last program deploy started, "none", or "unknown" (unreadable). Without it, and only
//            when the policy's deploy budget needs it, the script reads it from GitHub (scripts/last-program-deploy.mjs).
// Prints one line. When $GITHUB_OUTPUT is set (in GitHub Actions), it also writes rebuild=true or false,
// check=true or false, forced=true or false, the day and the reason there.
import { appendFileSync } from 'node:fs';
import { importTs } from './lib/import-ts.mjs';
import { lastProgramDeploy } from './last-program-deploy.mjs';
import { rebuildDates } from './rebuild-dates.mjs';
import { MORNING_CRON, refreshPolicy } from './refresh-policy.mjs';

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
  const lastArg = value('--last-deploy');
  if (lastArg !== undefined && !['none', 'unknown'].includes(lastArg) && Number.isNaN(Date.parse(lastArg))) { console.error('--last-deploy needs an instant, "none" or "unknown"'); process.exit(2); }
  // --day runs as that day's morning run: 12:00 UTC is 6 or 7 a.m. Central, the same day.
  const at = dayArg ? new Date(`${dayArg}T12:00:00Z`) : atArg ? new Date(atArg) : new Date();
  const cron = value('--cron') || (dayArg ? MORNING_CRON : '');
  const { edition2027: e } = await importTs(new URL('../src/data/edition-2027.ts', import.meta.url));
  const input = {
    at,
    trigger: { event: cron ? 'schedule' : 'workflow_dispatch', cron, force: value('--force') === 'true' },
    calendar: { rebuildDays: rebuildDates(), programDay: e.schedule, eventDay: e.eventDay },
    gates: e.program,
  };
  let p = refreshPolicy(input);
  // The deploy budget: read the last program deploy only when the decision depends on it.
  let last = '';
  if (p.since) {
    let lastDeploy;
    let unread = '';
    if (lastArg === 'none') lastDeploy = null;
    else if (lastArg === 'unknown') unread = 'given as unknown';
    else if (lastArg !== undefined) lastDeploy = new Date(lastArg);
    else {
      try {
        lastDeploy = await lastProgramDeploy({ since: p.since });
      } catch (err) {
        unread = err.message;
      }
    }
    last = unread ? ` Can't read the last program deploy: ${unread}.` : ` Last program deploy: ${lastDeploy ? lastDeploy.toISOString() : `none since ${p.since.toISOString()}`}.`;
    p = refreshPolicy({ ...input, lastDeploy });
  }
  const { day } = p;
  const { next } = rebuildToday(day);
  const time = `${String(Math.floor(p.minutes / 60)).padStart(2, '0')}:${String(p.minutes % 60).padStart(2, '0')}`;
  console.log(p.rebuild
    ? `${day} (Central): rebuild, ${p.why}`
    : p.check
      ? `${day} ${time} (Central): check the program, ${p.why}.${last}`
      : `${day} ${time} (Central): no rebuild, ${p.why}.${last}${next ? ` The next rebuild day is ${next.day}.` : ' No rebuild days are left in the Edition file.'}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `rebuild=${p.rebuild}\ncheck=${p.check}\nforced=${p.forced}\nday=${day}\nwhy=${p.why.replace(/\s+/g, ' ')}\n`);
  }
}
