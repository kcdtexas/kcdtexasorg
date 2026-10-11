# Scheduled rebuilds

The site is static and rebuilt rarely (ADR 0010). Text that depends on the date, such as "Open now", "Closed" or "Today", is written when the site is built, so it only changes when a build runs. NOW and the fills on the key dates move in the browser and don't need a build.

## How it works

1. `scripts/rebuild-dates.mjs` lists the days the built pages change, from the Edition file (`src/data/edition-2027.ts`). For 2027 that's the day the call for proposals opens, the day after it closes, the program's day (while the program isn't public), the ticket sale day once it's set, Event Day and the day after. `tests/run-time-machine.mjs` proves the list.
2. The workflow `.github/workflows/rebuild.yml` runs every morning at 07:17 UTC (2:17 a.m. CDT, 1:17 a.m. CST). It runs `node scripts/rebuild-today.mjs`, which says whether today, in Central time, is on that list and why.
3. If it is, the workflow POSTs to the Netlify build hook, and Netlify builds and publishes `main`.
4. A second run at 10:47 UTC (5:47 a.m. CDT, 4:47 a.m. CST) is a backup in case GitHub drops or delays the first. It skips the hook when the first run already rebuilt.

When a date in the Edition file changes, the list changes with it. The workflow has no dates of its own.

The build hook's address is the secret `NETLIFY_BUILD_HOOK` in the GitHub environment `production`, which only `main` can use. The workflow never prints it.

`tests/rebuild.mjs` checks the script on every day of the Edition, across both DST changes. It also checks that the workflow's times fall on the right Central day all year, and that the workflow keeps its pinned actions, least privilege and secret handling.

## Check a day

```
node scripts/rebuild-today.mjs                   # today, Central time
node scripts/rebuild-today.mjs --day 2027-02-01  # any day
node scripts/rebuild-dates.mjs                   # every rebuild day and what changes
```

## Test it by hand

1. On GitHub, open Actions, then "Rebuild on date changes", then "Run workflow".
2. Choose `main`, tick "force", and run it.
3. The `rebuild` job should end with "Netlify accepted the build hook". In Netlify, a production deploy starts with the title "Scheduled rebuild" and the day.

Without "force", a manual run does what the morning run would do today. On most days it only checks and stops.

## If GitHub turns the schedule off

GitHub turns off scheduled workflows in a public repository after 60 days without repository activity. Weeks without commits are normal here, for example between Feb 1 and Apr 23. To keep the schedule on without dummy commits, the first run each day re-enables the workflow through GitHub's API (the `keepalive` job, with `actions: write`), which counts as activity.

If it's turned off anyway (GitHub emails a warning first, and the Actions page shows "This scheduled workflow is disabled"):

1. Open Actions, then "Rebuild on date changes", then "Enable workflow".
2. Run `node scripts/rebuild-dates.mjs --from <the day it stopped>`. If a rebuild day was missed, run the workflow by hand with "force". One build brings every page up to date.

## If a run fails

GitHub emails a failed scheduled run to the person who last changed its schedule. The pages keep their old text until the next build. Run the workflow by hand with "force" once the cause is fixed. The usual causes are a missing secret or a build hook that was deleted in Netlify.
