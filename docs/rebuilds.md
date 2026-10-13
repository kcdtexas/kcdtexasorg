# Scheduled rebuilds

The site is static and rebuilt rarely (ADR 0010). Text that depends on the date, such as "Open now", "Closed" or "Today", is written when the site is built, so it only changes when a build runs. NOW and the fills on the key dates move in the browser and don't need a build.

## How it works

1. `scripts/rebuild-dates.mjs` lists the days the built pages change, from the Edition file (`src/data/edition-2027.ts`). For 2027 that's the day the call for proposals opens, the day after it closes, the program's day (while the program isn't public), the ticket sale day once it's set, Event Day and the day after. `tests/run-time-machine.mjs` proves the list.
2. The workflow `.github/workflows/rebuild.yml` runs every morning at 07:17 UTC (2:17 a.m. CDT, 1:17 a.m. CST). It runs `node scripts/rebuild-today.mjs`, which says what the run does by the refresh policy (below), in Central time, and why.
3. On a rebuild, the workflow POSTs to the Netlify build hook, and Netlify builds and publishes `main`.
4. A second run at 10:47 UTC (5:47 a.m. CDT, 4:47 a.m. CST) is a backup in case GitHub drops or delays the first. It skips the hook when the first run already rebuilt.

A rebuild day's text changes when GitHub runs the job, which can be hours after midnight Central.

When a date in the Edition file changes, the list changes with it. The workflow has no dates of its own, except Event Day's runs (below).

The build hook's address is the secret `NETLIFY_BUILD_HOOK` in the GitHub environment `production`, which only `main` can use. The workflow never prints it.

## The program refresh

Once the program is public, the Organizers can still change it on the platform: a Session moves, or a Speaker drops out. The site should follow. Once a gate is open, every Session marked Accepted on the platform goes live with the next refresh, with no pull request. So mark a Session Accepted only once its Speaker has confirmed and it can be announced. Every production deploy spends Netlify credits (below), so a refresh rebuilds only when the program changed, and no more often than the credit budget allows.

`scripts/refresh-policy.mjs` decides what each run does:

| Run | When | What it does |
| --- | --- | --- |
| Morning, 07:17 UTC | Every rebuild day | Rebuilds, with no check |
| Morning, 07:17 UTC | The program's day to 2 days before Event Day (Mar 1 to Apr 21, 2027), while a program gate is open | Checks the program if the last program deploy was 4 or more days earlier, and rebuilds only if it changed |
| Morning, 07:17 UTC | The eve of Event Day (Apr 22, 2027), while a program gate is open | Checks the program and rebuilds if it changed |
| Backup, 10:47 UTC | Every rebuild day | Rebuilds, unless the morning run already did |
| Every 5 minutes | Event Day (Apr 23, 2027), 7 a.m. to 7 p.m. Central, while a program gate is open | Checks the program if the last program deploy started 2 or more hours earlier, and rebuilds only if it changed |
| By hand | Any time | What the morning run would do; with "Force a rebuild now" ticked, rebuilds |

The dates come from the Edition file: the program's day (`schedule`) and `eventDay`. With the gates closed, no run checks anything.

A program deploy is a rebuild after a program change, or a forced run. Its `rebuild` job is named "Program deploy" (on a rebuild day, "Scheduled rebuild"). Before a check that depends on the last one, `scripts/last-program-deploy.mjs` reads the workflow's own runs through GitHub's API and takes the start of the newest run whose "Program deploy" job got past the build hook. Days are counted in Central time. If the runs can't be read, the run doesn't check or deploy, and its log says why; the next run tries again.

The check is `node scripts/program-check.mjs`. It reads the program from the platform as a production build does, computes its version, and compares it with the live `/2027/program-version.txt`. It prints only "changed" or "unchanged". It runs in its own job, in the `production` environment, which holds the platform's key, the secret `SESSIONIZE_ENDPOINT_ID` (or `PROGRAM_CSV_URL` for a CSV). The workflow keeps no artifacts and no caches.

After a rebuild for a program change, the run waits until the live site has the new program. Just before it starts the build, it notes the live `/2027/program-version.txt`. A 404 means no program is live yet, and the note stays empty. Any other error, or no answer, stops the run before the build, because an empty note would let the wait take the old version for the new one; the next run tries again. After the build starts, the run checks that file every 20 seconds, for up to 10 minutes, until it changes, or appears if there was none. No version passes between the jobs, and none goes in the log. Runs never overlap: the next one waits for it (the workflow's `concurrency`), so it compares the platform with the new live site and doesn't deploy the same change twice. Rebuild days and forced runs don't wait.

**Event Day's runs name the day.** GitHub can't read the Edition file, so the workflow's 5-minute cron says `2-59/5 12-23 23 4 *`: from 12:02 to 23:57 UTC on Apr 23, which is 7:02 a.m. to 6:57 p.m. CDT. If Event Day moves, `tests/rebuild.mjs` fails and prints the cron line for the new day. A run that GitHub starts late, after 7 p.m. Central, does nothing.

`tests/rebuild.mjs` checks the script and the policy on every day of the Edition, on Event Day's runs and the window's edges, and across both DST changes. It checks that the workflow's times fall on the right Central day all year, and that the workflow keeps its pinned actions, least privilege, secret handling and the wait after a program change. It also counts the rebuilds in March and April with no program change (only the rebuild days) and with a change every day (within the caps below, across DST and after a forced run). When `actionlint` is installed (or `ACTIONLINT` names it), it lints the workflow too.

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
- the rebuild days
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
node scripts/rebuild-today.mjs                   # today, Central time
node scripts/rebuild-today.mjs --day 2027-02-01  # any day's morning run
node scripts/rebuild-today.mjs --at 2027-04-23T15:02:00Z --cron '2-59/5 12-23 23 4 *'  # one of Event Day's runs
node scripts/rebuild-dates.mjs                   # every rebuild day and what changes
node scripts/program-check.mjs --gates           # "open" or "closed"
```

## Test it by hand

1. On GitHub, open Actions, then "Rebuild on date changes", then "Run workflow".
2. Choose `main`, tick "Force a rebuild now", and run it.
3. The `rebuild` job should end with "Netlify accepted the build hook". In Netlify, a production deploy starts with the title "Scheduled rebuild" and the day.

A forced run spends 15 credits and counts as the last program deploy for the caps (see "The credit budget"). Without "Force a rebuild now", a manual run does what the morning run would do today. On most days it only checks and stops. A deploy started by a program change has the title "Program change" and the day.

## If GitHub turns the schedule off

GitHub turns off scheduled workflows in a public repository after 60 days without repository activity. Weeks without commits are normal here, for example between Feb 1 and Apr 23. To keep the schedule on without dummy commits, the first run each day re-enables the workflow through GitHub's API (the `keepalive` job, with `actions: write`), which counts as activity.

If it's turned off anyway (GitHub emails a warning first, and the Actions page shows "This scheduled workflow is disabled"):

1. Open Actions, then "Rebuild on date changes", then "Enable workflow".
2. Run `node scripts/rebuild-dates.mjs --from <the day it stopped>`. If a rebuild day was missed, run the workflow by hand with "Force a rebuild now" ticked. One build brings every page up to date.

## If a run fails

GitHub emails a failed scheduled run to the person who last changed its schedule. The pages keep their old text until the next build. Run the workflow by hand with "Force a rebuild now" ticked once the cause is fixed. The usual causes are a missing secret or a build hook that was deleted in Netlify. If the `program` job fails, the platform didn't answer or its data didn't validate; the log says which variable, never its value, and the next run tries again. If the `rebuild` job fails at "Note the live program version", the live site didn't give its program version (the log says the HTTP status, or "no answer"), and no build started; the next run checks again. If the `rebuild` job fails while it waits, the live site didn't get the new program within 10 minutes: open the newest deploy in Netlify's Deploys list, and its log says whether it failed or is still building. The next run checks again.
