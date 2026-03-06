# kcdtexasorg

This repository contains the redirect configuration for [kcdtexas.org](https://kcdtexas.org). The site is deployed via [Netlify](https://netlify.com) and uses a Netlify `_redirects` file to forward visitors from short, memorable URLs to the appropriate destinations.

## How It Works

Netlify reads the `_redirects` file at the root of this repo and applies the rules on every incoming request to `kcdtexas.org`. No build step is required — Netlify serves the redirects directly.

## Current Redirects

### Event Pages

| Short URL | Destination | Purpose |
|---|---|---|
| [kcdtexas.org/schedule](https://kcdtexas.org/schedule) | https://kcdtexas2025.sessionize.com/schedule | 2025 event schedule |
| [kcdtexas.org/present](https://kcdtexas.org/present) | https://sessionize.com/kcd-texas | Call for Papers / speaker submissions |

### GitHub Repos — Community

| Short URL | Destination | Purpose |
|---|---|---|
| [kcdtexas.org/cfp](https://kcdtexas.org/cfp) | https://github.com/kcdtexas/cfp | Call for Papers repo |
| [kcdtexas.org/talks](https://kcdtexas.org/talks) | https://github.com/kcdtexas/talks | Post-event talk archive |
| [kcdtexas.org/code-of-conduct](https://kcdtexas.org/code-of-conduct) | https://github.com/kcdtexas/code-of-conduct | Code of Conduct |
| [kcdtexas.org/coc](https://kcdtexas.org/coc) | https://github.com/kcdtexas/code-of-conduct | Code of Conduct (short alias) |
| [kcdtexas.org/workshops](https://kcdtexas.org/workshops) | https://github.com/kcdtexas/workshop-materials | Workshop materials |

### GitHub Repos — Sponsors

| Short URL | Destination | Purpose |
|---|---|---|
| [kcdtexas.org/sponsor-guide](https://kcdtexas.org/sponsor-guide) | https://github.com/kcdtexas/sponsor-guide | Sponsor logistics guide |
| [kcdtexas.org/sponsors](https://kcdtexas.org/sponsors) | https://github.com/kcdtexas/sponsor-prospectus | Sponsorship prospectus |

### GitHub Repos — Org

| Short URL | Destination | Purpose |
|---|---|---|
| [kcdtexas.org/github](https://kcdtexas.org/github) | https://github.com/kcdtexas | KCD Texas GitHub organization |
| [kcdtexas.org/committees](https://kcdtexas.org/committees) | https://github.com/kcdtexas/committees | Committees repo |

### Catch-all

| Short URL | Destination | Purpose |
|---|---|---|
| `/*` | https://community.cncf.io/events/details/cncf-kcd-texas-presents-kcd-texas-2026/cohost-kcd-texas/ | Default — main event page |

## Adding or Updating a Redirect

Edit the `_redirects` file directly. Each line follows the Netlify redirect syntax:

```
/path  https://destination.example.com  301
```

- The catch-all rule (`/*`) at the bottom acts as the default — update it each year to point to the current event page.
- Specific paths should be listed **above** the catch-all so they take precedence.
- Redirects are 301 (permanent) by default in Netlify unless a status code is specified.

## Deployment

This repo is connected to Netlify. Any push to the `main` branch automatically deploys the updated redirect rules — no manual action needed.

## Related

- [kcdtexas.org](https://kcdtexas.org)
- [KCD Texas GitHub org](https://github.com/kcdtexas)
- [KCD Texas event page](https://community.cncf.io/kcd-texas/)
- [Netlify Redirects Docs](https://docs.netlify.com/routing/redirects/)
