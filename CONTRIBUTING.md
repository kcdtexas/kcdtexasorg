# Contributing

Thanks for helping with kcdtexas.org. Read these before you open a pull request.

## Before you push

- **Only announced facts.** The repository is public, and so is everything pushed to it: branches, pull requests, previews and CI logs. Don't push dates, venues, sponsors, speakers or prices the Organizers haven't announced. If you're not sure, ask in the Organizers' Slack first.
- **Numbers need a public source.** Put the source next to the number in `src/data/site.ts`.
- **No personal data.** Don't add cookies, forms, trackers or embeds that load third-party content before a click (ADR 0007).
- **Use the glossary.** Write "Edition", "Session" and "Schedule" the way `CONTEXT.md` defines them.

## Making a change

1. Branch from `main` and make your change.
2. Run `scripts/build.sh`. It fails on type errors, broken Short Links, scripts or inline styles in the output, third-party loads, and an oversized home page.
3. Open a pull request. Use a conventional title (`feat:`, `fix:`, `docs:`, `chore:`).
4. The owning Committee approves content changes. A Maintainer approves code changes. An approval given in Slack gets recorded in the pull request.

## Short Links

Short Links live in `src/data/short-links.yaml`, and the Marketing Committee owns them. Never remove one silently: re-point it, pin it, or retire it on purpose. Never add a catch-all (`/*`).

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
