# Event Day runbook

How the website runs on Event Day: posting announcements, checking the program refresh, and rolling back. Keep it open on the day.

## Who's on duty

Two Organizers on duty publish announcements on Event Day without a second approval (ADR 0008). They come from the group the ADR names, and they're named in the team chat before the day. Anyone else who wants something on the website asks one of them.

Safety and emergency messages never wait for the website. They go through the MC, Slack and signage.

## Post an announcement

Announcements show on `/2027/today/`, newest first. They live in `src/data/announcements-2027.yaml`.

1. On GitHub, open `src/data/announcements-2027.yaml` on `main` and press the pencil ("Edit this file").
2. Add the announcement at the end of the file, in the shape of the example there, without the `# ` at the start of each line:
   ```yaml
   - at: "2027-04-23 10:15"
     text: "The 10:30 Sessions start 10 minutes late."
     link: https://kcdtexas.org/2027/schedule/
   ```
   - `at` is the time it's posted, in Central time, in quotes. Use the current time: an entry with a later time waits for the next build after that time.
   - `text` is one line in double quotes, at most 280 characters. Write a quote inside it as `\"`.
   - `link` is optional and must start with `https://`.
3. Press "Commit changes", commit to `main`, and write a message such as "Announce: the 10:30 Sessions start late". If GitHub only offers a pull request, open it and merge it yourself; the fast track needs no second approval.

Each commit to `main` is a production deploy, and Netlify's free plan allows about 20 a month (ADR 0010). Put two announcements in one commit when you can.

## Check that it's live

1. In Netlify, open the site's Deploys. A production deploy of your commit starts within a minute or two. Wait until it says "Published".
2. Open https://kcdtexas.org/2027/today/ and reload. The page shows the time it was built ("Updated 10:32 a.m. CT") and the new announcement. Screens that already have the page open reload it within 5 minutes.

If the deploy fails, the site keeps the last good version. The deploy log names the entry and the field that's wrong, for example `entry 3 (at "2027-04-23 10:15"): "link" must be an https address`. Fix the file the same way and commit again.

## The program refresh

Room and time changes come from the program platform, not from this file. On Event Day, from 7 a.m. to 7 p.m. Central, the workflow "Rebuild on date changes" checks the program every 5 minutes and rebuilds only when it changed (`docs/rebuilds.md`).

**Check the runs:** on GitHub, open Actions, then "Rebuild on date changes". A run should appear every 5 minutes. Its program check prints "changed" or "unchanged"; after "changed", a Netlify deploy named "Program change" starts. GitHub sometimes starts scheduled runs late. If none has run for 15 minutes, force one.

**Force a rebuild:** on the same page, press "Run workflow", choose `main`, tick "Force a rebuild now" and run it. The `rebuild` job ends with "Netlify accepted the build hook", and Netlify starts a production deploy.

## Roll back

If a deploy breaks the site:

1. In Netlify, open Deploys and find the last good deploy, the one before the problem.
2. Open it and press "Publish deploy". The site switches to it at once.
3. Fix the cause on `main`: edit the file again, or undo the change.
4. Netlify may stop auto publishing after a rollback. If the Deploys page says so, press "Start auto publishing" once the fix is on `main`, or later commits won't go live.

## After the day

From the day after Event Day, builds stop offering the offline copy of the program pages, and visitors' browsers remove it the next time they open a 2027 page. Nothing to do. The morning rebuild on that day turns the site to the Recap.
