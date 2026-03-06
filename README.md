# kcdtexasorg

This repository contains the redirect configuration for [kcdtexas.org](https://kcdtexas.org). The site is deployed via [Netlify](https://netlify.com) and uses a Netlify `_redirects` file to forward visitors from short, memorable URLs to the appropriate destinations.

## How It Works

Netlify reads the `_redirects` file at the root of this repo and applies the rules on every incoming request to `kcdtexas.org`. No build step is required — Netlify serves the redirects directly.

## Current Redirects

| Path | Destination | Purpose |
|---|---|---|
| `/schedule` | https://kcdtexas2025.sessionize.com/schedule | 2025 event schedule |
| `/present` | https://sessionize.com/kcd-texas | Call for Papers / speaker submissions |
| `/*` (catch-all) | https://community.cncf.io/events/details/cncf-kcd-texas-presents-kcd-texas-2026/cohost-kcd-texas/ | Main event page |

## Adding or Updating a Redirect

Edit the `_redirects` file directly. Each line follows the Netlify redirect syntax:

```
/path  https://destination.example.com  301
```

- The catch-all rule (`/*`) at the bottom acts as the default — update it each year to point to the current event page.
- Specific paths (e.g. `/schedule`, `/present`) should be listed **above** the catch-all so they take precedence.
- Redirects are 301 (permanent) by default in Netlify unless a status code is specified.

## Deployment

This repo is connected to Netlify. Any push to the `main` branch automatically deploys the updated redirect rules — no manual action needed.

## Related

- [kcdtexas.org](https://kcdtexas.org)
- [KCD Texas event page](https://community.cncf.io/kcd-texas/)
- [Netlify Redirects Docs](https://docs.netlify.com/routing/redirects/)
