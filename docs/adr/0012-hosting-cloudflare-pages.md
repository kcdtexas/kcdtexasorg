---
status: accepted
---

# Hosting moves to Cloudflare Pages, built from GitHub

> Supersedes [ADR 0010](0010-hosting-netlify-rare-updates.md). Updates [ADR 0011](0011-main-is-the-production-branch.md): `main` stays the production branch, and the scheduled rebuilds call the Pages deploy hook instead of Netlify's build hook.

On 2026-10-30 the Organizers decided to move the Website from Netlify to Cloudflare Pages. The kcdtexas.org zone and its registration are already on Cloudflare.

The Website is a Pages project with Git integration, in the Cloudflare account that holds the kcdtexas.org zone. Pages builds `main` as production and every other branch as a preview, with `scripts/build.sh`, as Netlify did. Its settings and the rollback are in `docs/hosting.md`.

## Considered Options

- **Stay on Netlify.** The free plan gives 300 credits a month at 15 per production deploy, pauses every site on the team when they run out, and allows one member. That's why merges waited for rebuild days, and why the program refresh was spaced days apart.
- **Netlify's Open Source plan.** 10,000 credits and several members, but whether an event site qualifies is Netlify's call, and the plan asks for a credit on every page.
- **Cloudflare Workers with static assets.** Cloudflare's newer product could serve the same files. Pages has everything this site uses built in: production and preview builds from GitHub, separate Production and Preview variables, deploy hooks, `_headers` and `_redirects`. The build stays host-neutral, so a later move to Workers reuses it.
- **Build in GitHub Actions and upload to Cloudflare.** The repository is public, so its build logs are too. Pages' build logs are private to the account, as Netlify's were, which keeps a program build out of public logs (ADR 0009).
- **Pages with Direct Upload.** A Direct Upload project can't switch to Git integration later.

## Consequences

- **Production is Pages building `main`:** `CF_PAGES=1` and `CF_PAGES_BRANCH=main`, which Pages sets itself (`src/lib/build-context.mjs`). Netlify's `CONTEXT=production` still counts, so Netlify can serve as the rollback until it's shut down. A pull request's preview can't become a production build.
- **The program platform's key goes in Pages' Production variables only,** as a secret (ADR 0009, `docs/program-csv.md`). The build cache stays off, so no program data sits in a cache.
- **Production builds cost nothing.** Pages' free plan builds 500 times a month, previews included. Every merge into `main` goes live right away. The refresh policy keeps the schedule's production builds under 250 a month (`docs/rebuilds.md`, "The build budget"): the program refresh runs daily, and every 5 minutes on Event Day (ADR 0008).
- **Zero data on Cloudflare (ADR 0007):** the zone features that add scripts or cookies to our pages stay off: Email Address Obfuscation, Web Analytics, Rocket Loader, Bot Fight Mode and Zaraz. The live check after each release looks for cookies, other origins and console errors. Cloudflare's Network Error Logging header stays: its reports go to Cloudflare, which is our host, and the privacy page already covers the host's request logs.
- **Pages applies a `_redirects` rule even where a file exists at that path.** `scripts/write-host-files.mjs` refuses a Short Link that collides with a page. Pages also redirects a page's other addresses (`/about`, `/about/index.html`) to its own with a 308; `scripts/serve.mjs` does the same locally.
- **One site at one address.** The project's `kcdtexas.pages.dev` address answers with `X-Robots-Tag: noindex` (`_headers`), and a Redirect Rule on the zone sends `www.kcdtexas.org` to `kcdtexas.org`.
- **Several admins.** The Cloudflare account has at least two Organizers as Super Administrators.
- **Netlify stays as the rollback for two weeks after the move,** then it's shut down, along with `netlify.toml` and its GitHub app (`docs/hosting.md`).
