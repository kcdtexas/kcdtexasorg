# Event Day runbook

How the website runs on Event Day: posting announcements, checking the program refresh, and rolling back. Keep it open on the day.

## Who's on duty

On Event Day, the two Organizers on duty, who are named in the team chat, may publish announcement-only changes without a second approval (ADR 0008's fast track). They come from a group of three: a Maintainer, the Core Event Committee Moderator and the Session Committee Moderator. Any other change needs a second Organizer's approval, as on every other day.

Room and time changes don't need the fast track. They come from the program platform, which the site checks every 5 minutes (below).

Safety and emergency messages never wait for the website. They go through the MC, Slack and signage.

## Before the day

1. Name the two Organizers on duty in the team chat.
2. If GitHub requires a review before a change reaches `main`, a repository admin adds the two to the bypass list of the rule that protects `main` (in the repository's Settings, under Rules or Branches). Then they can commit to `main` on Event Day without a review.
3. Check that both can sign in to Netlify, to watch the deploys and roll back.
4. Check Netlify's usage page. April's credits left must cover Event Day: up to 6 program deploys, the Event Day and Recap rebuilds, and the announcements, at 15 credits each (`docs/rebuilds.md`, "The credit budget").

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
3. Press "Commit changes", commit directly to `main`, and write a message such as `feat: announce that the 10:30 Sessions start late`. If GitHub offers only a pull request, open it: another Organizer approves and merges it, as on any other day.

Each announcement is a commit to `main`, so each one is a production deploy and spends 15 of the month's 300 credits. Batch them: put two or more announcements in one commit when you can. Count them in the day's budget, next to up to 6 program deploys (`docs/rebuilds.md`, "The credit budget").

## Check that it's live

1. In Netlify, open the site's Deploys. A production deploy of your commit starts within a minute or two. Wait until it says "Published".
2. Open https://kcdtexas.org/2027/today/ and reload. The page shows the time it was built ("Updated 10:32 a.m. CT") and the new announcement. Screens that already have the page open reload it within 5 minutes.

If the deploy fails, the site keeps the last good version. The deploy log names the entry and the field that's wrong, for example `entry 3 (at "2027-04-23 10:15"): "link" must be an https address`. Fix the file the same way and commit again.

## The program refresh

Room and time changes come from the program platform, not from this file. On Event Day, from 7 a.m. to 7 p.m. Central, the workflow "Rebuild on date changes" checks the program every 5 minutes and rebuilds only when it changed, at most once every 2 hours (`docs/rebuilds.md`).

**Check the runs:** on GitHub, open Actions, then "Rebuild on date changes". A run should appear every 5 minutes. Its program check prints "changed" or "unchanged". After "changed", a Netlify deploy named "Program change" starts, and the run waits until the live site has the change, for up to 10 minutes. Within 2 hours of the last program deploy, a run doesn't check, and its log says from what time the next one can deploy.

GitHub starts scheduled runs late: on 2026-10-11, the first two started 5 to 7 hours late. Event Day's 5-minute runs can be late or skipped. If a program change isn't live within 15 minutes, and the newest run's log doesn't name a later time, force a rebuild.

**Force a rebuild:** on the same page, press "Run workflow", choose `main`, tick "Force a rebuild now" and run it. The `rebuild` job ends with "Netlify accepted the build hook", and Netlify starts a production deploy.

## Roll back

If a deploy breaks the site:

1. In Netlify, open Deploys and find the last good deploy, the one before the problem.
2. Open it and press "Publish deploy". The site switches to it at once.
3. Fix the cause on `main`: edit the file again, or undo the change.
4. Netlify may stop auto publishing after a rollback. If the Deploys page says so, press "Start auto publishing" once the fix is on `main`, or later commits won't go live.

## After the day

A repository admin takes the two Organizers on duty off the bypass list for `main`, if they were added: from then on, every change needs a second Organizer's approval again.

The rest happens by itself. The morning rebuild on the day after Event Day turns the site to the Recap. Builds stop offering the offline copy of the program pages, and visitors' browsers delete it the next time they open a 2027 page.
