// The refresh policy: what one run of .github/workflows/rebuild.yml does. It rebuilds the live site, checks the
// program platform for a change first and rebuilds only if there is one, or does nothing. docs/rebuilds.md
// explains it. Pure: no I/O. The caller passes the instant, the trigger, the Edition's dates, the program gates,
// the live build's day and, after a check, its result.
//
// - Every scheduled or manual run catches up: it rebuilds when the newest rebuild day from
//   scripts/rebuild-dates.mjs, on or before today, is later than the day the live site was built for (/build.txt).
//   So a rebuild day that GitHub ran late or dropped, or whose build hook failed, is made up by the next run that
//   gets through. The build hook is used at most once per rebuild day: if Netlify accepted it and the live site
//   still has an older day, no run deploys again (docs/rebuilds.md).
// - While the program is public (a gate open), from the program's day to the eve of Event Day, the morning run
//   checks the program and rebuilds only on a change, and no sooner than DEPLOY_BUDGET allows.
// - On Event Day, the runs every 5 minutes from 7 a.m. to 7 p.m. Central check, and rebuild only on a change, at
//   most once per DEPLOY_BUDGET.eventDayEveryMinutes.
// - The later daily runs only catch up, and never check the program.
// - A manual run with "force" rebuilds, and counts as the last program deploy.
// Netlify's free plan has 300 credits a month, and a production deploy costs 15 (docs/rebuilds.md, "The credit
// budget"), so nothing else rebuilds.

/**
 * The deploy budget for program changes. A program deploy is a rebuild after a check found a change, or a forced
 * run. The caller reads the last one's time (scripts/last-program-deploy.mjs).
 * - From the program's day to 2 days before Event Day, a change deploys only if the last program deploy was
 *   `everyDays` or more Central days earlier: at most 8 a month.
 * - On the eve of Event Day, a change always deploys, so the program is fresh for the day.
 * - On Event Day, from 7 a.m. to 7 p.m. Central, a change deploys only if the last program deploy started
 *   `eventDayEveryMinutes` or more earlier: at most 6.
 */
export const DEPLOY_BUDGET = { everyDays: 4, eventDayEveryMinutes: 120 };

/** The daily runs, in UTC: the morning run, then later chances for a rebuild day that GitHub ran late or dropped.
 *  All fall after midnight Central and on the same Central day, all year (tests/rebuild.mjs). */
export const MORNING_CRON = '17 7 * * *';
export const RETRY_CRONS = ['47 10 * * *', '17 13 * * *', '17 16 * * *'];

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

/** Which run this is: 'morning', 'retry' (a later daily run), 'event-day' (a 5-minute run), 'manual', or 'unknown'. */
export function triggerKind(trigger, eventDay) {
  if (trigger.event === 'workflow_dispatch') return 'manual';
  if (trigger.cron === MORNING_CRON) return 'morning';
  if (RETRY_CRONS.includes(trigger.cron)) return 'retry';
  if (eventDayCrons(eventDay).includes(trigger.cron)) return 'event-day';
  return 'unknown';
}

const gatesOpen = (gates) => Boolean(gates?.speakersPublic || gates?.schedulePublic);

/** A Central day `n` days after `day` (YYYY-MM-DD), and the days between two days. */
const dayNumber = (day) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000;
const shiftDay = (day, n) => new Date((dayNumber(day) + n) * 86_400_000).toISOString().slice(0, 10);
const UNREADABLE = "the last program deploy's time can't be read, so no deploy";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * What a run does.
 * @param {object} input
 * @param {Date} input.at  when the run starts
 * @param {{ event: string, cron?: string, force?: boolean }} input.trigger  the GitHub event, its cron, "force"
 * @param {{ rebuildDays: { day: string, why: string }[], programDay: string, eventDay: string }} input.calendar
 * @param {{ speakersPublic: boolean, schedulePublic: boolean }} input.gates  the program gates in the Edition file
 * @param {string | null} [input.liveDay]  the day the live site was built for (/build.txt), as YYYY-MM-DD.
 *   'missing' (a 404: a build from before /build.txt) or leaving it out counts as yesterday. Anything else means
 *   it couldn't be read, and the run does nothing.
 * @param {Date | null} [input.hooked]  when the newest run that got past the build hook started; null if none did
 *   since `hookSince` (below). Anything else means it couldn't be read, and a catch-up doesn't run.
 * @param {boolean} [input.changed]  the check's result, once there is one
 * @param {Date | null} [input.lastDeploy]  when the last program deploy's run started; null if there was none
 *   since `since` (below). Anything else means its time couldn't be read, and a spaced check doesn't run.
 * @returns {{ day: string, minutes: number, kind: string, rebuild: boolean, check: boolean, forced: boolean,
 *   since: Date | null, hookSince: Date | null, why: string }}
 *   `check`: the run asks the platform and rebuilds only on a change. Without `changed`, `rebuild` is then false.
 *   `since`: set when the decision depends on the last program deploy: only one at or after it matters.
 *   `hookSince`: set when the decision depends on the build hook's last use: only one at or after it matters.
 *   `forced`: a forced run, which counts as a program deploy.
 */
export function refreshPolicy({ at, trigger, calendar, gates, liveDay, hooked, changed, lastDeploy }) {
  const { day, minutes } = centralClock(at);
  const kind = triggerKind(trigger, calendar.eventDay);
  const open = gatesOpen(gates);
  const forced = kind === 'manual' && Boolean(trigger.force);
  let hookSince = null;
  let note = '';
  const out = (rebuild, check, why, since = null) => ({ day, minutes, kind, rebuild: check ? changed === true : rebuild, check, forced, since, hookSince, why: `${note}${why}` });
  const known = lastDeploy === null || (lastDeploy instanceof Date && !Number.isNaN(lastDeploy.getTime()));
  const { everyDays, eventDayEveryMinutes } = DEPLOY_BUDGET;

  if (forced) return out(true, false, 'forced by hand');
  if (kind === 'unknown') return out(false, false, `"${trigger.cron}" is not one of this workflow's times`);

  // Catch-up: the newest rebuild day up to today, against the live build's day.
  const live = liveDay === undefined || liveDay === 'missing' ? shiftDay(day, -1) : liveDay;
  if (typeof live !== 'string' || !DAY.test(live)) return out(false, false, "the live site's /build.txt can't be read, so nothing runs");
  const due = calendar.rebuildDays.filter((d) => d.day <= day).at(-1);
  if (due && live < due.day) {
    hookSince = centralInstant(due.day, 0);
    if (!(hooked === null || (hooked instanceof Date && !Number.isNaN(hooked.getTime())))) return out(false, false, "the build hook's last use can't be read, so no rebuild");
    if (!hooked || hooked < hookSince) {
      return out(true, false, due.day === day ? due.why : `catch-up for ${due.day}: ${due.why}`);
    }
    // Netlify took the hook for this rebuild day, but the live site didn't follow (a failed or unpublished
    // deploy): no second deploy for it. The run goes on as if it were caught up.
    note = `Netlify accepted a rebuild for ${due.day} at ${hooked.toISOString()}, but the live build is still for ${live}, so no second deploy (docs/rebuilds.md); `;
  }
  const idle = note ? 'nothing else to do' : due && due.day === day ? "today's rebuild is already live" : 'not a rebuild day';

  if (kind === 'morning' || kind === 'manual') {
    if (day >= calendar.programDay && day < calendar.eventDay) {
      if (!open) return out(false, false, 'the program gates are closed');
      if (day === shiftDay(calendar.eventDay, -1)) return out(false, true, 'the eve of Event Day: rebuild if the program changed');
      // Spaced by Central days, so DST doesn't matter: only a deploy since midnight `everyDays - 1` days ago counts.
      const since = centralInstant(shiftDay(day, 1 - everyDays), 0);
      if (!known) return out(false, false, UNREADABLE, since);
      const last = lastDeploy && centralClock(lastDeploy).day;
      if (last && dayNumber(day) - dayNumber(last) < everyDays) {
        return out(false, false, `the last program deploy was on ${last}: the next can be on ${shiftDay(last, everyDays)}`, since);
      }
      return out(false, true, 'the program is public: rebuild if it changed', since);
    }
    return out(false, false, idle);
  }
  if (kind === 'retry') return out(false, false, idle);
  // An Event Day run.
  const { from, until } = EVENT_DAY_WINDOW;
  if (day !== calendar.eventDay || minutes < from || minutes >= until) return out(false, false, 'outside Event Day, 7 a.m. to 7 p.m. Central');
  if (!open) return out(false, false, 'the program gates are closed');
  const gap = eventDayEveryMinutes * 60_000;
  const since = new Date(at.getTime() - gap);
  if (!known) return out(false, false, UNREADABLE, since);
  if (lastDeploy && at.getTime() - lastDeploy.getTime() < gap) {
    const next = centralClock(new Date(lastDeploy.getTime() + gap)).minutes;
    return out(false, false, `Event Day: the last program deploy was less than ${eventDayEveryMinutes} minutes ago; the next can be from ${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')} Central`, since);
  }
  return out(false, true, 'Event Day: rebuild if the program changed', since);
}
