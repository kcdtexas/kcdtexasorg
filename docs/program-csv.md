# The program from a CSV file

The site reads the program (Sessions, Speakers, the Schedule) from Sessionize. If the program lives somewhere else, or the platform has no API, the build can read one CSV file instead. `src/lib/program-source/csv.mjs` reads it, and `src/lib/program.ts` applies the same allowlist and gates as for Sessionize.

**Never commit a program CSV to this repository before the program is announced.** The repository is public, so a committed file announces the program (ADR 0009). The made-up file in `tests/fixtures/program.csv` is the only CSV in git.

## Where the file comes from

The build downloads the file from the address in the host environment variable `PROGRAM_CSV_URL`. A published Google Sheet works: in Google Sheets, choose File, Share, Publish to web, the sheet, and "Comma-separated values (.csv)".

- The address must be https.
- Treat it as a secret, like the Sessionize endpoint ID. It goes in Netlify's production environment variables and in the GitHub environment `production`, never in git. The build never prints it, error messages included.
- When `SESSIONIZE_ENDPOINT_ID` is also set, the build reads Sessionize and ignores the CSV.

## When it's read

- Only in a production build (`CONTEXT=production` on Netlify), and only while a program gate is open (`program` in `src/data/edition-2027.ts`).
- With both gates closed, the build reads nothing.
- Deploy previews, branch deploys and local builds with a gate open use the test program, labeled "Sample", and never read the variable.
- If a gate is open in production and neither variable is set, the build fails. It also fails when the download fails or the file doesn't follow this format, so Netlify keeps the last good deploy.

## The format

- UTF-8, comma-separated, with a header row. Fields with commas, quotes or line breaks go in double quotes, and a quote inside one is written twice (`""`), as every spreadsheet exports it.
- Column names are case-insensitive and can come in any order. Columns that aren't listed here are ignored, so the sheet can keep private notes in its own columns. They never reach the site.
- Each row is one thing, named in the `type` column: `speaker`, `session` or `break`.

| Column | Used by | What goes in it |
| --- | --- | --- |
| `type` | every row | `speaker`, `session` or `break` |
| `id` | speaker, session | A unique id, such as `p1` or `s1`. Sessions name their Speakers by these ids. |
| `name` | speaker | The Speaker's name, as they want it printed |
| `tagline` | speaker | Their role and company, as printed under the name |
| `bio` | speaker | The bio, as the Speaker wrote it |
| `photo` | speaker | An https address of the photo. The build downloads it, crops it square and serves it from kcdtexas.org. |
| `links` | speaker | https addresses, separated by spaces or `;`. The kind comes from the address: github.com, bsky.app, linkedin.com, x.com or twitter.com, a Mastodon profile (`https://<server>/@<name>`), and anything else is the Speaker's website. |
| `title` | session, break | The title |
| `format` | session | `Keynote`, `Talk`, `Workshop` or `Panel` |
| `end_user` | session | `yes` for an End-User Story; `no` or empty otherwise |
| `speakers` | session | The Speakers' ids, separated by `;` |
| `start`, `end` | session, break | Central time, as `2027-04-23 09:30` (or `2027-04-23T09:30`) |
| `room` | session, break | The room's name. Rooms show in the order they first appear. A break with no room spans every room. |
| `abstract` | session | The abstract, as the Speaker wrote it |
| `recording` | session | An https address of the recording, after the event |

Times and rooms are needed only once `schedulePublic` is open. While only `speakersPublic` is open, the build leaves them out even when the file has them.

## An example

```csv
type,id,title,name,format,end_user,speakers,start,end,room,tagline,links
speaker,p1,,Fixture Person A,,,,,,,"Platform Engineer, Fixture Company",https://github.com/fixture-person-a
speaker,p2,,Fixture Person B,,,,,,,Site Reliability Engineer,
session,s1,Fixture Talk: An Example,,Talk,yes,p1;p2,2027-04-23 10:00,2027-04-23 10:30,Fixture Hall,,
break,,Lunch,,,,,2027-04-23 12:00,2027-04-23 13:00,,,
```

## Tests

`tests/program-adapter.mjs` reads `tests/fixtures/program.csv` and builds the site from it, served by a local test server. A test may point the build at a server on the same machine (`127.0.0.1`, `localhost` or `[::1]`) over plain http. Netlify and GitHub Actions builds refuse that, so a real production build always reads an https address.
