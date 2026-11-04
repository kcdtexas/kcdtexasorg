# Hosting: Cloudflare Pages

kcdtexas.org is a Cloudflare Pages project built from this repository (ADR 0012). This page lists its settings, so whoever holds the account next can check them or set them up again. No secret goes here: hook addresses and the program platform's key live only in Cloudflare and in GitHub's `production` environment.

## The project's settings

| Setting | Value | Why |
|---|---|---|
| Account | the Cloudflare account that holds the kcdtexas.org zone | Pages serves an apex domain only from the zone's own account |
| Project name | `kcdtexas`, so its address is `kcdtexas.pages.dev` | the noindex rule in `_headers` matches whatever `pages.dev` name the project gets |
| Git integration | Cloudflare's GitHub app, limited to `kcdtexas/kcdtexasorg` | |
| Production branch | `main` | ADR 0011 |
| Preview branches | every other branch | a preview for every pull request |
| Framework preset | None | |
| Build command | `npm ci --ignore-scripts --no-audit --no-fund && bash scripts/build.sh --skip-install` | no dependency's install script runs in a production build |
| Build output directory | `dist` | |
| Variables, Production and Preview | `NODE_VERSION=22`, `ASTRO_TELEMETRY_DISABLED=1`, `SKIP_DEPENDENCY_INSTALL=1` | Astro needs Node 22.12 or newer; the build command installs the dependencies itself, without their install scripts |
| Variables, Production only | `ANALYTICS=cloudflare` (ADR 0013); and `SESSIONIZE_ENDPOINT_ID` or `PROGRAM_CSV_URL`, as a secret, only shortly before the program goes public | ADR 0009, `docs/program-csv.md` |
| Build cache | off | no program data in a cache |
| Deploy hook | one, for `main`; its address is the secret `CLOUDFLARE_DEPLOY_HOOK` in GitHub's `production` environment | the scheduled rebuilds (`docs/rebuilds.md`) |
| Web Analytics, the project's | off | the zone's covers kcdtexas.org (ADR 0013) |
| Failure email | Notifications: a failed Pages deployment of `kcdtexas` emails organizers@kcdtexas.org | a failed build reaches a person |
| Custom domain | `kcdtexas.org` | |

## The zone's settings

| Setting | Value | Why |
|---|---|---|
| Email Address Obfuscation | off | it rewrites every email address on our pages, which then shows as "[email protected]" without JavaScript |
| Web Analytics | on, with `ANALYTICS=cloudflare` in the project's Production variables | ADR 0013: the one script allowed from another origin; turn the zone's off before removing the variable |
| Rocket Loader, Bot Fight Mode, Zaraz | off | they add scripts or cookies |
| Always Use HTTPS | on | |
| Redirect Rule | "Redirect from WWW to root": `www.kcdtexas.org` to `kcdtexas.org`, 301 | one address for the site |
| Other records | MX and TXT for mail, `photos.kcdtexas.org` | leave them alone |

To check the result from outside, run the smoke and browser tests against the live site (`node tests/smoke.mjs https://kcdtexas.org`, `node tests/browser.mjs https://kcdtexas.org`). They fail on a cookie, a script from another origin or a console error.

## How Pages differs from Netlify

- A `_redirects` rule wins over a file at the same path. `scripts/write-host-files.mjs` refuses a Short Link that collides with a page.
- A page's other addresses redirect to its own with a 308: `/about` and `/about/index.html` go to `/about/`.
- `_headers` takes at most 100 rules; the build fails past that. A rule that starts with a URL (`https://:project.pages.dev/*`) applies on that host only.
- Pages marks its preview addresses noindex by itself.
- A rollback lasts until the next production build: the next merge or deploy hook build replaces it. Fix the cause on `main` before the next scheduled run.

## Roll back a deployment

1. On Cloudflare, open Workers & Pages, then `kcdtexas`, then Deployments.
2. Find the last good production deployment, open its menu ("…") and choose "Rollback to this deployment". The site switches to it at once.
3. Fix the cause on `main`. The next production build, from a merge or the deploy hook, replaces the rollback.

## Netlify, until it's shut down

Netlify served the site until the move, and stays ready as the rollback for two weeks after it. `netlify.toml` and `CONTEXT=production` keep it building the same site. To go back to it: in the zone's DNS records, replace the `kcdtexas.org` record that points to Pages with the old one (export the zone's records before the move); then remove `kcdtexas.org` from the Pages project's custom domains (Cloudflare detaches a custom domain only after its DNS record changes); then revert the move's pull request. Then Netlify, its GitHub app and the `NETLIFY_BUILD_HOOK` secret are removed, and so is `netlify.toml`.
