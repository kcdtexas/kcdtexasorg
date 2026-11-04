---
status: accepted
---

# Cloudflare Web Analytics is the one analytics exception

> Updates [ADR 0007](0007-zero-data-website.md): Cloudflare Web Analytics replaces Umami as the one analytics exception. The rest of ADR 0007 stands.

On 2026-10-30 the Organizers chose Cloudflare Web Analytics. The site moves to Cloudflare Pages (ADR 0012), and Cloudflare already serves every request, so its analytics add no new company to the path.

Cloudflare adds its script to the live pages itself; the build ships no analytics code. The script loads from `static.cloudflareinsights.com` and reports to our own domain. It sets no cookies, and Cloudflare says it doesn't collect or use visitors' personal data.

## Considered Options

- **Umami, as ADR 0007 planned.** Cookie-free too, but it needs an account, a script we host and a gateway to keep running.
- **No analytics.** The cleanest option, but the Organizers couldn't tell whether the site does its job.
- **Cloudflare's traffic statistics only.** They need no script, but they count requests, not page views.

## Consequences

- It stays behind a switch, as ADR 0007 asks: the production build sets `ANALYTICS=cloudflare` (`docs/hosting.md`). Only then does the CSP's `script-src` allow `https://static.cloudflareinsights.com`, and only then do the privacy page and the footer's privacy line describe it (`src/data/site.ts`, `src/data/privacy.ts`). `scripts/check-dist.mjs` fails a build where the two disagree.
- Turning it off means turning off Web Analytics on the zone and removing `ANALYTICS` from the production variables, in that order, so the CSP never blocks a script the zone still adds.
- Previews and local builds have no analytics: Cloudflare adds the script on kcdtexas.org only.
- The live check after each release allows that one script and still fails on any cookie, any storage, or any other origin.
