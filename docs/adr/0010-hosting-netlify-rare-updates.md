---
status: accepted
---

# Hosting stays on Netlify in rare-updates mode, and any move needs the Organizers' approval

The Website stays on the existing Netlify site. To fit Netlify's free plans, a production deploy happens only when:

- the Phase changes,
- a content batch is released (at most weekly),
- the published program data changes (at most daily, and immediately in Event Day week), or
- there's an emergency.

The production branch is `release`, and only the deploy workflow updates it. `main` and pull requests get previews only. A monthly deploy counter blocks non-urgent deploys once the budget is used up.

Moving to Cloudflare Pages is a separate decision for the Organizers. The kcdtexas.org DNS zone is already on Cloudflare, and a move would allow frequent deploys and several admins.

## Considered Options

- **A new Netlify team.** The current free plan gives 300 credits a month at 15 per production deploy. Every site on the team is paused when credits run out, and only one member is allowed.
- **Moving to Cloudflare Pages now.** Free, unlimited static serving and several admins. But moving hosting is the Organizers' call, and doing it during the CFP launch adds DNS risk.
- **Netlify's Open Source plan.** We're applying. If it's granted, frequent deploys and several members work on Netlify too.

## Consequences

- The build doesn't depend on the host. The same build script, `_redirects` and `_headers` work on Netlify and on Cloudflare Pages, and deploys go through a build hook.
- Netlify's free plans allow a single member, so the account uses a shared Organizer login kept in the Organizers' vault, unless the Open Source plan is granted.
