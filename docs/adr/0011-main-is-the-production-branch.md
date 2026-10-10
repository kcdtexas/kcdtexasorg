---
status: accepted
---

# `main` is the production branch, and a build hook runs the scheduled rebuilds

Netlify publishes `main`. Every pull request merged into `main` has gone live within minutes since the site launched in October 2026. ADR 0010 planned a separate `release` branch that only a deploy workflow would update, and a monthly deploy counter. Neither was set up. There are only a few merges a month, so deploys stay within Netlify's budget with one branch.

Text that depends on the date changes only when a build runs. On those days, `.github/workflows/rebuild.yml` calls a Netlify build hook for `main` (`docs/rebuilds.md`).

## Consequences

- A merge into `main` is a release. Each pull request is reviewed on its Netlify deploy preview before the merge.
- Every production deploy counts against Netlify's monthly credits (ADR 0010), whether it comes from a merge or from the build hook. So an automatic rebuild runs only when the pages would change.
- The build hook's address is a secret of the GitHub environment `production`, which only `main` can use.
- The rest of ADR 0010 stands: the site stays on Netlify, and moving it needs the Organizers' approval.
