# Scheduled rebuilds

The site is static and rebuilt rarely (ADR 0010). Text that depends on the date, such as "Open now", "Closed" or "Today", is written when the site is built, so it only changes when a build runs. NOW and the fills on the key dates move in the browser and don't need a build.

## How it works

1. `scripts/rebuild-dates.mjs` lists the days the built pages change, from the Edition file (`src/data/edition-2027.ts`). For 2027 that's the day the call for proposals opens, the day after it closes, the program's day (while the program isn't public), the ticket sale day once it's set, Event Day and the day after. `tests/run-time-machine.mjs` proves the list.
2. Every build writes the Central day it was built for to `/build.txt`, for example `2026-11-01`.
3. The workflow `.github/workflows/rebuild.yml` runs four times a day: at 07:17, 10:47, 13:17 and 16:17 UTC (2:17, 5:47, 8:17 and 11:17 a.m. CDT; an hour earlier in CST). Each run reads the live `https://kcdtexas.org/build.txt` and runs `node scripts/rebuild-today.mjs`, which says what the run does by the refresh policy (below), in Central time, and why.
4. A run rebuilds when the newest rebuild day, up to today, is later than the live build's day. Then the workflow POSTs to the Netlify build hook, Netlify builds and publishes `main`, and the run waits until the live `/build.txt` has the new day.

GitHub's schedule runs late, often by hours (6 to 9 hours in October 2026), and it can drop a run. A rebuild day's text changes when the first run gets through. On Nov 1, that can be the middle of the day.

If the text hasn't changed by 10 a.m. on a rebuild day, run the workflow with "Force a rebuild now" (see "Test it by hand").

## Catch-up

A run compares two days: the newest rebuild day on or before today, and the day the live site was built for. A late, dropped or failed run is made up by the next run that gets through, on the same day or a later one:

- **Runs dropped:** if GitHub drops every run on a rebuild day, the first run the next day rebuilds.
- **The hook fails:** if the build hook doesn't answer, the run fails, and the next run tries again.
- **A merge:** a merge builds the current day's text, so after a merge on a rebuild day, no run rebuilds that day.
- **A forced run:** it rebuilds, and its build writes the new day.

A rollback in Netlify to a deploy from before the rebuild day puts an older `/build.txt` live. If a run already used the hook that day, nothing deploys again. If the day's text came from a merge, the next run rebuilds `main` once. Netlify may stop auto publishing after a rollback, and then that build isn't published (`docs/event-day.md`, "Roll back").

The build hook is used once per rebuild day. If Netlify accepted it and the live site still shows an older day, because the deploy failed or wasn't published, no run deploys again for that day. The run's log says so. Fix the cause in Netlify, then run the workflow with "Force a rebuild now".

If the live `/build.txt` can't be read (an answer other than 200 or 404, or no answer), the run does nothing and its log says why. A 404 means the live build is from before `/build.txt` existed, and the run treats it as built the day before.

To see the live build's day:

```
curl -s https://kcdtexas.org/build.txt
```

A catch-up rebuild is the deploy the missed day would have made, so it adds no credits. A failed deploy costs nothing.

When a date in the Edition file changes, the list changes with it. The workflow has no dates of its own, except Event Day's runs (below).

The build hook's address is the secret `NETLIFY_BUILD_HOOK` in the GitHub environment `production`, which only `main` can use. The workflow never prints it.

## The program refresh

Once the program is public, the Organizers can still change it on the platform: a Session moves, or a Speaker drops out. The site should follow. Once a gate is open, every Session marked Accepted on the platform goes live with the next refresh, with no pull request. So mark a Session Accepted only once its Speaker has confirmed and it can be announced. Every production deploy spends Netlify credits (below), so a refresh rebuilds only when the program changed, and no more often than the credit budget allows.

`scripts/refresh-policy.mjs` decides what each run does:

| Run | When | What it does |
| --- | --- | --- |
| Any run | The live build is older than the newest rebuild day up to today | Rebuilds, with no check (see "Catch-up") |
| Morning, 07:17 UTC | The program's day to 2 days before Event Day (Mar 1 to Apr 21, 2027), while a program gate is open | Checks the program if the last program deploy was 4 or more days earlier, and rebuilds only if it changed |
| Morning, 07:17 UTC | The eve of Event Day (Apr 22, 2027), while a program gate is open | Checks the program and rebuilds if it changed |
| Later runs, 10:47, 13:17 and 16:17 UTC | Any day | Only the catch-up above, never a program check |
| Every 5 minutes | Event Day (Apr 23, 2027), 7 a.m. to 7 p.m. Central, while a program gate is open | Checks the program if the last program deploy started 2 or more hours earlier, and rebuilds only if it changed |
| By hand | Any time | What the morning run would do; with "Force a rebuild now" ticked, rebuilds |

The dates come from the Edition file: the program's day (`schedule`) and `eventDay`. With the gates closed, no run checks anything.

A program deploy is a rebuild after a program change, or a forced run. Its `rebuild` job is named "Program deploy" (on a rebuild day, "Scheduled rebuild"). Before a check that depends on the last one, `scripts/last-program-deploy.mjs` reads the workflow's own runs through GitHub's API and takes the start of the newest run whose "Program deploy" job got past the build hook. Days are counted in Central time. If the runs can't be read, the run doesn't check or deploy, and its log says why; the next run tries again.

The check is `node scripts/program-check.mjs`. It reads the program from the platform as a production build does, computes its version, and compares it with the live `/2027/program-version.txt`. It prints only "changed" or "unchanged". It runs in its own job, in the `production` environment, which holds the platform's key, the secret `SESSIONIZE_ENDPOINT_ID` (or `PROGRAM_CSV_URL` for a CSV). The workflow keeps no artifacts and no caches.

After a rebuild for a program change, the run waits until the live site has the new program. Just before it starts the build, it notes the live `/2027/program-version.txt`. A 404 means no program is live yet, and the note stays empty. Any other error, or no answer, stops the run before the build, because an empty note would let the wait take the old version for the new one; the next run tries again. After the build starts, the run checks that file every 20 seconds, for up to 10 minutes, until it changes, or appears if there was none. No version passes between the jobs, and none goes in the log. Runs never overlap: the next one waits for it (the workflow's `concurrency`), so it compares the platform with the new live site and doesn't deploy the same change twice. Rebuild days and forced runs wait for the new day in `/build.txt` instead ("How it works").

Only the morning run checks the program, and only the morning run keeps the workflow on (below).

**Event Day's runs name the day.** GitHub can't read the Edition file, so the workflow's 5-minute cron says `2-59/5 12-23 23 4 *`: from 12:02 to 23:57 UTC on Apr 23, which is 7:02 a.m. to 6:57 p.m. CDT. If Event Day moves, `tests/rebuild.mjs` fails and prints the cron line for the new day. A run that GitHub starts late, after 7 p.m. Central, doesn't check the program. Event Day's runs also catch up: if the daily runs are late, the first 5-minute run that gets through switches the site to Event Day. Don't count on it: an Organizer forces a rebuild at 6 a.m. (`docs/event-day.md`).

`tests/rebuild.mjs` checks the script and the policy on every day of the Edition, on Event Day's runs and the window's edges, and across both DST changes. It plays the catch-up: runs late by hours, every set of a rebuild day's runs dropped, a failed hook, a deploy that never went live, a merge, a rollback, a forced run, and a live `/build.txt` that's missing, unreadable or ahead of today. Each rebuild day deploys once. It checks every daily run's Central time in CST and CDT, and that the workflow keeps its pinned actions, least privilege, secret handling and the wait after a program change. It also counts the rebuilds in March and April with no program change (only the rebuild days) and with a change every day (within the caps below, across DST and after a forced run). When `actionlint` is installed (or `ACTIONLINT` names it), it lints the workflow too.

## The credit budget

Netlify's free plan gives 300 credits a month, and that's a hard limit. Production deploys, bandwidth and requests share them ([Netlify's pricing](https://www.netlify.com/pricing/)):

| What | Credits |
| --- | --- |
| A production deploy | 15 |
| 1 GB of bandwidth | 20 |
| 10,000 requests | 2 |

Failed deploys, rollbacks, deploy previews and branch deploys cost nothing.

What spends credits:

- every merge into `main`
- the rebuild days, one deploy each, even when a later run catches one up
- program deploys
- Event Day announcements, one production deploy per commit (`docs/event-day.md`)
- traffic: bandwidth and requests

The caps on program deploys, set in `DEPLOY_BUDGET` in `scripts/refresh-policy.mjs`:

- Mar 1 to Apr 21: only if the last program deploy was 4 or more days earlier, in Central days. At most 8 a month.
- Apr 22: whenever the program changed, so it's fresh for Event Day.
- Event Day, 7 a.m. to 7 p.m. Central: at most one every 2 hours. At most 6.
- A forced run always deploys, and counts as the last program deploy.

With a program change every day, the program deploys and the rebuild days make 9 production deploys in March (135 credits) and 14 in April (210 credits). That leaves 90 credits in April for merges, announcements and traffic.

Check Netlify's usage page on the 1st and the 15th of March and April, and on Apr 20.

If the credits run out, every page shows "Site not available" until the next month. A rollback costs nothing, so undo a bad deploy by rolling back in Netlify (`docs/event-day.md`) before you commit a fix.

## Check a day

```
node scripts/rebuild-today.mjs                   # today, Central time, against the live /build.txt
node scripts/rebuild-today.mjs --day 2027-02-01  # any day's morning run, with a live build from the day before
node scripts/rebuild-today.mjs --at 2027-02-02T13:17:00Z --cron '17 13 * * *' --live-day 2027-01-31  # a catch-up
node scripts/rebuild-today.mjs --at 2027-04-23T15:02:00Z --cron '2-59/5 12-23 23 4 *'  # one of Event Day's runs
node scripts/rebuild-dates.mjs                   # every rebuild day and what changes
node scripts/program-check.mjs --gates           # "open" or "closed"
```

## Test it by hand

1. On GitHub, open Actions, then "Rebuild on date changes", then "Run workflow".
2. Choose `main`, tick "Force a rebuild now", and run it.
3. The `rebuild` job reports "Netlify accepted the build hook", then waits until the live site has today's `/build.txt`, and ends with "The live site is built for" and the day. In Netlify, a production deploy starts with the title "Scheduled rebuild" and the day.

A forced run spends 15 credits and counts as the last program deploy for the caps (see "The credit budget"). Without "Force a rebuild now", a manual run does what the morning run would do today. On most days it only checks and stops. A deploy started by a program change has the title "Program change" and the day.

## If GitHub turns the schedule off

GitHub turns off scheduled workflows in a public repository after 60 days without repository activity. Weeks without commits are normal here, for example between Feb 1 and Apr 23. To keep the schedule on without dummy commits, the first run each day re-enables the workflow through GitHub's API (the `keepalive` job, with `actions: write`), which counts as activity.

If it's turned off anyway (GitHub emails a warning first, and the Actions page shows "This scheduled workflow is disabled"):

1. Open Actions, then "Rebuild on date changes", then "Enable workflow".
2. The next run catches up a missed rebuild day by itself. To have it now, run the workflow by hand with "Force a rebuild now" ticked. One build brings every page up to date.

## If a run fails

GitHub emails a failed scheduled run to the person who last changed its schedule. If the build hook failed, the next run tries again. If the `rebuild` job fails while it waits for the new day, Netlify took the build but the live site didn't get it within 10 minutes: open the newest deploy in Netlify's Deploys list. No run deploys that day again by itself, so run the workflow by hand with "Force a rebuild now" ticked once the cause is fixed. Don't use "Re-run jobs" on a failed run: a re-run skips the `rebuild` job, unless the run was forced, because its check is out of date. The usual causes are a missing secret or a build hook that was deleted in Netlify. If the `program` job fails, the platform didn't answer or its data didn't validate; the log says which variable, never its value, and the next run tries again. If the `rebuild` job fails at "Note the live program version", the live site didn't give its program version (the log says the HTTP status, or "no answer"), and no build started; the next run checks again. If the `rebuild` job fails while it waits for the new program, the live site didn't get it within 10 minutes: open the newest deploy in Netlify's Deploys list, and its log says whether it failed or is still building. The next run checks again.
