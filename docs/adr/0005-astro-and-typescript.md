# Astro and TypeScript, not Hugo or Next.js

The Website is built with Astro and TypeScript. Pages ship as plain HTML by default, and only the interactive pieces (My Schedule, Schedule filters, Event Day mode) load JavaScript. Content types have enforced rules, so a malformed sponsor entry fails the build instead of breaking the live site.

## Considered Options

- **Hugo.** The obvious choice in the CNCF world, since kubernetes.io uses it. But its templates are awkward for interactive pieces, generating Share Card images at build time, and strict content validation.
- **Next.js (static export).** Every page would load a React runtime, which is too heavy for a mostly static event site.
- **Eleventy.** Simple, but we would build the interactive pieces and image generation ourselves.
