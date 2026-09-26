# kcdtexas.org

The website of [KCD Texas](https://kcdtexas.org), the community-run Kubernetes Community Day for Texas. One permanent site presents the Current Edition and keeps every Past Edition.

- **What and why:** [docs/brief.md](docs/brief.md)
- **Vocabulary:** [CONTEXT.md](CONTEXT.md)
- **Decisions:** [docs/adr/](docs/adr/)

## Build it

You need Node.js 22.12 or newer.

```sh
scripts/build.sh            # install, type-check, build, write _redirects/_headers, check the output
scripts/build.sh --serve    # the same, then preview at http://127.0.0.1:4321
scripts/build.sh --zip      # the same, plus out/kcdtexas-<commit>.zip
npm run dev                 # live-reload dev server while editing
```

The built site goes to `dist/`. It's plain static files that any static host can serve.

## Where things live

| What | Where |
|---|---|
| Pages | `src/pages/` |
| Facts shown on the site (contacts, numbers and their sources) | `src/data/site.ts` |
| Short Links (`kcdtexas.org/cfp` and friends) | `src/data/short-links.yaml` |
| Shared design foundation, reusable by sister sites | `src/foundation/` |
| Build and checks | `scripts/` |

## Ground rules

- **Pushing is announcing.** This repository is public, and so are branches, pull requests and previews. Only push facts the Organizers have already announced (ADR 0009).
- **Every number needs a public source**, such as a CNCF transparency report. Attendance means checked-in attendees.
- **The site collects no personal data** (ADR 0007).

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Licenses

- Code: [Apache-2.0](LICENSE).
- Original text: [CC BY 4.0](LICENSE-CONTENT.md).
- Logos, trademarks, photos, Session abstracts and Speaker bios aren't covered. [LICENSE-CONTENT.md](LICENSE-CONTENT.md) lists them.

Built with AI assistance (Claude). KCD Texas Organizers review all content.
