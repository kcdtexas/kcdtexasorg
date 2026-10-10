// The refresh policy: what one run of .github/workflows/rebuild.yml does. It rebuilds the live site, checks the
// program platform for a change first and rebuilds only if there is one, or does nothing. docs/rebuilds.md
// explains it. Pure: no I/O. The caller passes the instant, the trigger, the Edition's dates, the program gates
// and, after a check, its result.
//
// - The morning run (or a manual run) rebuilds on every rebuild day from scripts/rebuild-dates.mjs.
// - While the program is public (a gate open), from the program's day to the eve of Event Day, the morning run
//   checks the program and rebuilds only on a change.
// - On Event Day, the runs every 5 minutes from 7 a.m. to 7 p.m. Central check, and rebuild only on a change.
// - The backup run repeats the morning run's rebuild day, never its check.
// - A manual run with "force" rebuilds.
// Netlify's free plan allows about 20 production deploys a month (ADR 0010), so nothing else rebuilds.

/** The morning run and its backup, in UTC: both fall after midnight Central all year. */
export const MORNING_CRON = '17 7 * * *';
export const BACKUP_CRON = '47 10 * * *';

/** Event Day's refresh window, in Central time: 7 a.m. up to 7 p.m., every 5 minutes, 2 minutes past. */
export const EVENT_DAY_WINDOW = { from: 7 * 60, until: 19 * 60, every: 5, offset: 2 };

const ZONE = 'America/Chicago';
const clock = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** The Central day (YYYY-MM-DD) and minute of the day (0 to 1439) of an instant. Handles CST and CDT. */
export function centralClock(instant) {
  const p = Object.fromEntries(clock.formatToParts(instant).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** The UTC instant of a Central wall time on a day. Central is UTC-5 (CDT) or UTC-6 (CST). */
function centralInstant(day, minutes) {
  const [y, m, d] = day.split('-').map(Number);
  for (const offset of [5, 6]) {
    const at = new Date(Date.UTC(y, m - 1, d, offset, minutes));
    const c = centralClock(at);
    if (c.day === day && c.minutes === minutes) return at;
  }
  throw new Error(`${day} has no ${minutes} minutes past midnight in Central time`);
}

/** The cron lines (UTC) that run every 5 minutes through Event Day's window, from the Edition's event day. GitHub
 *  can't read the Edition file, so the workflow names the day; tests/rebuild.mjs checks it against this. */
export function eventDayCrons(eventDay) {
  const { from, until, every, offset } = EVENT_DAY_WINDOW;
  const start = centralInstant(eventDay, from).getTime();
  const end = centralInstant(eventDay, until).getTime();
  // The window starts and ends on whole hours in UTC too, so it's a run of whole UTC hours, by UTC day.
  const byDay = new Map();
  for (let t = start; t < end; t += 3600_000) {
    const d = new Date(t);
    const key = `${d.getUTCDate()} ${d.getUTCMonth() + 1}`;
    byDay.set(key, [...(byDay.get(key) ?? []), d.getUTCHours()]);
  }
  return [...byDay].map(([dm, hours]) => {
    const h = hours.length === 1 ? `${hours[0]}` : `${hours[0]}-${hours.at(-1)}`;
    return `${offset}-59/${every} ${h} ${dm} *`;
  });
}

/** Which run this is: 'morning', 'backup', 'event-day' (a 5-minute run), 'manual', or 'unknown'. */
export function triggerKind(trigger, eventDay) {
  if (trigger.event === 'workflow_dispatch') return 'manual';
  if (trigger.cron === MORNING_CRON) return 'morning';
  if (trigger.cron === BACKUP_CRON) return 'backup';
  if (eventDayCrons(eventDay).includes(trigger.cron)) return 'event-day';
  return 'unknown';
}

const gatesOpen = (gates) => Boolean(gates?.speakersPublic || gates?.schedulePublic);

/**
 * What a run does.
 * @param {object} input
 * @param {Date} input.at  when the run starts
 * @param {{ event: string, cron?: string, force?: boolean }} input.trigger  the GitHub event, its cron, "force"
 * @param {{ rebuildDays: { day: string, why: string }[], programDay: string, eventDay: string }} input.calendar
 * @param {{ speakersPublic: boolean, schedulePublic: boolean }} input.gates  the program gates in the Edition file
 * @param {boolean} [input.changed]  the check's result, once there is one
 * @returns {{ day: string, minutes: number, kind: string, rebuild: boolean, check: boolean, why: string }}
 *   `check`: the run asks the platform and rebuilds only on a change. Without `changed`, `rebuild` is then false.
 */
export function refreshPolicy({ at, trigger, calendar, gates, changed }) {
  const { day, minutes } = centralClock(at);
  const kind = triggerKind(trigger, calendar.eventDay);
  const hit = calendar.rebuildDays.find((d) => d.day === day);
  const open = gatesOpen(gates);
  const out = (rebuild, check, why) => ({ day, minutes, kind, rebuild: check ? changed === true : rebuild, check, why });

  if (kind === 'manual' && trigger.force) return out(true, false, 'forced by hand');
  if (kind === 'morning' || kind === 'manual') {
    if (hit) return out(true, false, hit.why);
    if (day >= calendar.programDay && day < calendar.eventDay) {
      return open ? out(false, true, 'the program is public: rebuild if it changed') : out(false, false, 'the program gates are closed');
    }
    return out(false, false, 'not a rebuild day');
  }
  if (kind === 'backup') return hit ? out(true, false, `backup run: ${hit.why}`) : out(false, false, 'not a rebuild day');
  if (kind === 'event-day') {
    const { from, until } = EVENT_DAY_WINDOW;
    if (day !== calendar.eventDay || minutes < from || minutes >= until) return out(false, false, 'outside Event Day, 7 a.m. to 7 p.m. Central');
    return open ? out(false, true, 'Event Day: rebuild if the program changed') : out(false, false, 'the program gates are closed');
  }
  return out(false, false, `"${trigger.cron}" is not one of this workflow's times`);
}
