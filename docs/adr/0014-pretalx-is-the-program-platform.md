---
status: accepted
---

# Pretalx is the program platform

> Updates [ADR 0008](0008-event-day-fast-track.md), [ADR 0009](0009-pushing-is-announcing-and-program-gates.md) and [ADR 0012](0012-hosting-cloudflare-pages.md): the program comes from Pretalx, not Sessionize, and needs no key. The rest of all three stands.

The 2027 Edition's call for proposals runs on Pretalx, at pretalx.com/kcd-texas-2027. So the build reads the 2027 program from Pretalx: the Sessions, the Speakers and the Schedule. The Sessionize reader is gone. The CSV fallback stays (`docs/program-csv.md`).

The build reads Pretalx's public REST API, with no key. Without a key, the API shows only what Pretalx already publishes on its own pages: the confirmed Sessions of a released, public schedule, their Speakers, the rooms and breaks, and the answers to custom fields set to "Publish answers". Private fields, reviews, notes and email addresses aren't in it. `src/lib/program-source/pretalx.mjs` reads it, and `src/lib/program.ts` applies the allowlist and the gates as before. `docs/pretalx.md` has the details, and what the Organizers set in Pretalx.

## Considered Options

- **Keep the Sessionize reader.** The call for proposals moved to Pretalx, so Sessionize has no 2027 program to read.
- **Pretalx's API with an organizer token.** A token also sees unreleased Sessions, private fields and email addresses, so the build would have to filter all of them, and the token would be one more secret to keep out of previews. The public API reads only what's already public.
- **Pretalx's schedule export (`schedule.json`).** It takes 1 request, but it has no answers to custom fields, so it can't mark End-User Stories or print job titles.
- **The event's short form in a host variable (`PRETALX_EVENT`).** It isn't a secret: the site links to the call for proposals. A variable would only add a setting to forget, in Cloudflare Pages and in GitHub, before the announcement.
- **Pin the API version (the `Pretalx-Version` header).** Pretalx removes an old version 1 or 2 releases after a new one, which could fall close to Event Day. The build reads the current version and checks the shape of every response instead.

## Consequences

- No new variable or secret. A production build with a gate open reads Pretalx. The event's short form and the names of the custom fields it reads are in `src/lib/program-source/config.mjs`. Setting `PROGRAM_CSV_URL` in production switches the build to the CSV. Every other build still uses the test data and reads nothing (ADR 0009).
- Pretalx publishes Sessions and Speakers only with a released, public schedule. Until then the build fails, with a message that says so. So `speakersPublic` alone also needs a released schedule, and the site still hides the times and rooms then.
- Releasing a schedule publishes it on pretalx.com at once, whatever the gates say. The Organizers release it on the announcement day, or keep the schedule hidden in Pretalx until then.
- A time or room change reaches the site only after a new release in Pretalx. The refresh check then finds it like any other change (`docs/rebuilds.md`).
- The refresh check still compares a hash of the public model, not Pretalx's schedule version, so it also follows changes outside the schedule, such as an edited bio.
- Speaker photos are downloaded at build time, as ADR 0007 asks, and only from pretalx.com or the event's custom domain, redirects included. Pretalx stopped taking pictures from other sites, such as Gravatar, in version 2026.1.
- Pretalx stores abstracts, descriptions and bios as Markdown. The site shows them as plain text with the marks removed, as the owner chose on 2026-11-08 (`src/lib/program-source/markdown.mjs`).
- ADR 0012's "program platform's key" now means only the CSV's address.
- Past Editions keep their Sessionize links and their saved programs (ADR 0004).
