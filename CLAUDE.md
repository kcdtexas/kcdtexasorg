# KCD Texas Website

The official website of KCD Texas at kcdtexas.org: one permanent site that presents the Current Edition and keeps every Past Edition.

## Read first

- `CONTEXT.md` is the project glossary. Use its terms in code, content and conversation, and avoid the words listed under _Avoid_.
- `docs/adr/` holds the architecture decisions. Don't reverse one without writing a new ADR that supersedes it.
- `docs/brief.md` is the public project brief.

## Rules

- **Pushing = announcing (ADR 0009).** The repository is public, and branches, pull requests, previews and CI logs are public too. Never push anything the Organizers haven't announced: dates, venue, sponsors, speakers, prices or targets.
- **Program data only through `src/lib/program.ts`.** It applies the field allowlist and the `speakersPublic` / `schedulePublic` gates at fetch time. Nothing else reads Sessionize. Pull request builds use test data with the gates closed. No real program data goes in CI logs, artifacts or caches.
- **Zero data (ADR 0007).** No cookies and no forms on our domain. Download images, fonts and thumbnails at build time. Videos load only on click through our nocookie facade. Umami analytics is the only exception.
- **Verified numbers only.** Attendance means checked-in Attendees, never Registrations. Every figure needs a public source, and survey figures are labeled as survey figures.
- **English only** for now. **Central time** (America/Chicago) everywhere.
- **Public copy workflow:** Claude drafts the text and runs the delete-ai-words / red-pen pass. The user skims it, and the owning Committee approves before merge. An approval given in Slack is recorded in the pull request.
- **No secrets in git.** Sessionize endpoint IDs, deploy hooks and analytics settings belong in host environment variables or the `production` GitHub environment, which is limited to `main`.
- **`docs/research/` is private and git-ignored.** Never commit it, and never quote it as fact without checking a primary source. `docs/research/past-editions.md` is the only source for published numbers.
- **Licensing:**
  - Code: Apache-2.0.
  - Original text: CC BY 4.0.
  - Logos, trademarks, event photos, Session abstracts and Speaker bios keep their owners' rights.

## Stack

- **Build:** Astro 7 + TypeScript, built as a static site (ADR 0005). Node ≥22.12. Tailwind v4 through `@tailwindcss/vite`, and Preact for the interactive pieces.
- **Scripts:** one build script, `scripts/build.sh`, used both locally and in CI.
- **Hosting:** Netlify in rare-updates mode (ADR 0010). Production deploys come only from the `release` branch or the build hook.

## Git

- Conventional commit messages (`feat:`, `fix:`, `docs:`, `chore:`).
- The commit identity is set in the local repo config.
