# KCD Texas Website

The official website of KCD Texas at kcdtexas.org: one permanent site that presents the Current Edition and keeps every Past Edition.

## Read first

- `CONTEXT.md` is the project glossary. Use its terms in code, content and conversation, and avoid the words listed under _Avoid_.
- `docs/adr/` holds the architecture decisions. Don't reverse one without writing a new ADR that supersedes it.

## Rules

- **Merging = announcing.** The repository is public. Never commit anything the Organizers haven't announced yet: dates, venue, sponsors, speakers, prices or targets.
- **Verified numbers only.** Attendance means checked-in Attendees, never Registrations. Every figure on the site needs a public source, such as a CNCF transparency report.
- **English only** for now.
- **Public copy workflow:** Claude drafts the text, the user runs a de-AI pass (delete-ai-words / red-pen), and the owning Committee reviews it before merge.
- **No secrets in git.** Sessionize endpoint IDs and analytics keys go in environment variables or GitHub secrets.
- **`docs/research/` is private and git-ignored.** Never commit it, and never quote it as fact without checking a primary source.
- **Licensing:**
  - Code: Apache-2.0.
  - Original text: CC BY 4.0.
  - Logos, trademarks, event photos, Session abstracts and Speaker bios keep their owners' rights.

## Stack

Astro + TypeScript, built as a static site and deployed to Netlify. See `docs/adr/0005-astro-and-typescript.md`. The build runs through a single script that local builds and CI both use. Scaffold pending.

## Git

- Conventional commit messages (`feat:`, `fix:`, `docs:`, `chore:`).
- The commit identity is set in the local repo config.
