# The program from Pretalx

The 2027 Edition's call for proposals runs on Pretalx, at https://pretalx.com/kcd-texas-2027/. The site reads the 2027 program from there: the Sessions, the Speakers and the Schedule (ADR 0014). `src/lib/program-source/pretalx.mjs` reads Pretalx's public API, and `src/lib/program.ts` applies the allowlist and the gates (ADR 0009). If the program ever has to come from somewhere else, the build can read a CSV file instead (`docs/program-csv.md`).

## When it's read

- Only in a production build (Cloudflare Pages building `main`, `src/lib/build-context.mjs`), and only while a program gate is open (`program` in `src/data/edition-2027.ts`).
- With both gates closed, the build reads nothing.
- Deploy previews, branch deploys and local builds with a gate open use the test program, labeled "Sample", and read nothing.
- Pretalx's public API needs no key, so production needs no variable for it. When `PROGRAM_CSV_URL` is set in production, the build reads the CSV instead of Pretalx.
- If Pretalx doesn't answer, or its data doesn't validate, the build fails, and the site keeps the last good deployment. The refresh check reads Pretalx the same way (`docs/rebuilds.md`).

## What Pretalx publishes, and when

Pretalx's public API shows what Pretalx's own public pages show, and nothing else:

- the confirmed Sessions of the newest released schedule, with their times and rooms, once the schedule is public;
- their Speakers, the rooms and the breaks;
- the answers to custom fields set to "Publish answers".

Accepted Sessions that aren't confirmed yet, private fields, reviews, notes and email addresses aren't in it.

Until a schedule is released and public, Pretalx answers HTTP 401 for the Sessions, the Speakers and the rooms. The build then fails and says "Pretalx publishes the Sessions, the Speakers and the rooms only once a schedule is released and public". So even `speakersPublic` alone needs a released schedule. With only `speakersPublic` open, the site still shows no times, rooms, calendar files or Event Day page.

Releasing a schedule in Pretalx publishes it on pretalx.com at once, whatever the site's gates say. Release it on the announcement day, or keep it hidden until then (in Pretalx's schedule editor: Actions, then Hide schedule).

## What the Organizers set in Pretalx

Before the announcement pull request opens the gates (the program's day, Mar 1, 2027):

1. **The custom fields, active, with "Publish answers" on.** Pretalx hides the answers of an inactive field. The site finds each one by its label or its identifier (`pretalx.fields` in `src/lib/program-source/config.mjs`), asked for each proposal or each speaker as below. Case, spaces and punctuation don't count, and "&" counts as "and".

   | Field, as the 2027 call names it | Type | For each | On the site | Without it |
   |---|---|---|---|---|
   | Is this an End-User Story? | Yes/No | proposal | the End-User Story label | the build fails |
   | Job title and company | Text | speaker | the line under the Speaker's name | the build fails |
   | Website or public profile, for example LinkedIn link | URL | speaker | a link on the Speaker's page | no website links |
   | Level | Choose one | proposal | the Level in the format's badge, and the Schedule's Level filter | no Session shows a Level |

   A field renamed beyond case and punctuation needs its new label added to `pretalx.fields`. Giving the field the identifier `end-user-story`, `job-title-and-company`, `website` or `level` in Pretalx works too.

   The Level field's options are named Beginner, Intermediate and Advanced. A Session whose Level has another name shows no Level, and the build goes on; its log says how many Sessions, naming the options by their ids. To show a renamed option, add its new name, in lowercase, to `levelNames` with the Level it stands for, for example `'beginner friendly': 'beginner'`. A fourth Level needs code: `LEVELS` in `model.mjs` and `levelName` in `src/lib/program.ts`.
2. **The session types** are named Talk, Workshop or Keynote. Another name needs a line in `formatNames` in the same file, or the build fails and names the type by its id.
3. **Each Session** is confirmed (by its Speaker, or marked confirmed by an Organizer) and placed in a room at a time.
4. **The schedule** is released and public (in the schedule editor: Actions, then Make schedule public).
5. **The event** stays public, with the short form `kcd-texas-2027` (`pretalx.event` in `config.mjs`). If it gets a custom domain, the site accepts photos from that domain too.

## Changes after the announcement

- Times and rooms change on Pretalx's public schedule only with a new release. Move the Session in the schedule editor, then release a new version. The site picks it up with its next refresh: the next morning, or within about 5 minutes on Event Day (`docs/rebuilds.md`, `docs/event-day.md`).
- A Session canceled in Pretalx stays in the released schedule, marked canceled, until the next release. The site drops it with its next refresh, without waiting for a new release, since it shows only confirmed Sessions.
- The refresh compares everything the pages show, so an edited title, abstract, bio, photo, job title or Level also comes through.

## What the site shows

| On the site | From Pretalx |
|---|---|
| A Session's title | the title |
| A Session's text | the abstract, then the description, as one text (once, if both say the same) |
| Its format | the session type: Talk, Workshop or Keynote (`formatNames`) |
| The End-User Story label | the End-User Story field, answered Yes |
| Its Level, in the format's badge ("TALK \| BEGINNER") | the Level field's option: Beginner, Intermediate or Advanced. The Session page and the Schedule show it; a Speaker's page doesn't. |
| Its Speakers, in order | the Session's speakers |
| Its time and room | its slot in the released schedule, in Central time |
| Breaks | the schedule's breaks, once each: across all rooms when a break is in every room that has Sessions, else with the names of its rooms |
| A Speaker's name and bio | the name and the biography |
| The line under the name | the "Job title and company" field |
| Links | the Speaker's public URL fields. GitHub, LinkedIn, Bluesky, X and Mastodon are known by their address, or by the field's icon or label. Any other address in the website field is the Speaker's website. Only https addresses show. Pretalx and Sessionize profiles, Instagram and Facebook are dropped. |
| The photo | the profile picture, downloaded at build time (ADR 0007), cropped square and saved as WebP, only from pretalx.com or the event's custom domain, redirects included |

The Schedule's Level filter offers the Levels the Sessions have. A Session with no Level, such as a keynote, shows only while no Level is ticked.

Everything else Pretalx sends is dropped. A Session given more than once (scheduled in 2 slots) shows once for each time; while only `speakersPublic` is open, it shows once. A break with no title shows as "Break".

Pretalx's abstracts, descriptions and bios are Markdown. The site shows them as plain text with the marks removed (`src/lib/program-source/markdown.mjs`): emphasis and code marks, headings, quote markers and bullets go; numbered items keep their numbers; a link keeps its text, an image its alt text, an address in angle brackets the address. Of HTML, only the formatting tags Pretalx allows, such as `<b>`, `<a>` or `<p>`, go. Pretalx shows any other tag as text, like `<pod-name>` in `kubectl logs <pod-name>`, and so does the site. Line breaks stay, in abstracts and bios alike. An asterisk or an underscore that isn't emphasis stays as written, like in 5 * 3, 2*3*4 or snake_case, and so does anything in code or in a web address. Titles and job titles aren't Markdown in Pretalx, and stay as written.

Pretalx sets no length limit, so the build cuts any of these texts past 20,000 characters at a word, with an ellipsis. Its log then names the Session or the Speaker and the length, never the text.

## When the build fails

| The message says | What to do |
|---|---|
| `HTTP 401: Pretalx publishes the Sessions, the Speakers and the rooms only once a schedule is released and public` (or `HTTP 404` for the released schedule) | Release the schedule in Pretalx and make it public, then build again. |
| `Pretalx has no public custom field per proposal named ...` (or per speaker) | Turn on "Publish answers" for that field in Pretalx, keep it active, and check it's asked for each proposal or each speaker as the table above says. If it was renamed, add its label to `pretalx.fields`. |
| `its session type (...) is not a known format` | Name the session type Talk, Workshop or Keynote, or add its name to `formatNames`. |
| `the Schedule is public, but it has no time or room` | A confirmed Session isn't in the released schedule. Schedule it, and release again. |
| `HTTP 404: there is no public event kcd-texas-2027` | The event isn't public, or its short form changed. Make it public, or fix `pretalx.event`. |
| `the list changed while it was read`, or `is not among the slots of the released schedule` | Pretalx changed during the build, or a new version was released meanwhile. The next build reads it again. |
| `... from schedule ..., not from the released one` | Pretalx sent slots from another version of the schedule than the newest one. Its API changed: the reader needs a fix. |

## The API

The build reads these from `https://pretalx.com/api/events/kcd-texas-2027/`, 50 entries a page, and follows each list's `next` page on the same host: the event itself, `questions/?expand=options`, `submission-types/`, `rooms/`, `schedules/latest/`, `submissions/?expand=answers`, `speakers/?expand=answers` and `slots/?schedule=<id>`. That's 8 requests while every list fits on one page, plus one per photo.

Pretalx keeps every released version of the schedule. The build takes the newest version's id from `schedules/latest/` and asks for that version's slots only. If a slot from another version comes back anyway, or a Session's slot is missing from the list, the build fails and says so.

The build follows a redirect only to the same kind of host: an API request stays on pretalx.com, and a photo stays on pretalx.com or the event's custom domain. A redirect anywhere else fails the build, and no request goes there.

When Pretalx is busy (HTTP 429) and asks to wait 30 seconds or less, the build waits as long as it asks (3 seconds if it doesn't say) and tries that request once more. When a gateway fails (HTTP 502, 503 or 504), it waits 2 seconds and tries once more. A second failure, or any other error, or a wait longer than 30 seconds, fails the build. Photos and the CSV get the same one retry. Every request names the site in its User-Agent, and no email address.

The build reads the API's current version (Pretalx's API changelog: https://docs.pretalx.org/api/changelog/) and checks the shape of every response, so a change on Pretalx's side fails the build instead of showing wrong data.

## Tests

`tests/program-adapter.mjs` serves `tests/fixtures/pretalx-event.json`, a made-up event in the API's shape, from a local test server, and builds the site from it. `KCD_PROGRAM_TEST_BASE` points the reader at that server. Cloudflare Pages, Netlify and GitHub Actions refuse it.
