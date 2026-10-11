// The accessibility page's words. Website part: Maintainer. Event part: Core Event Committee.
import { contact, currentEdition } from './site';

export const accessibility = {
  title: 'Accessibility',
  description: 'How kcdtexas.org is checked for accessibility, what support KCD Texas confirms for the event, and how to ask for what you need.',
  kicker: 'Website and event',
  lead: 'How we check this website, and how to tell us what you need at the event.',

  website: {
    title: 'This website',
    // On since the keyboard and screen-reader check (tests/a11y.mjs) passed on every page. While false, the claim never shows.
    wcagClaim: true,
    claim: 'This website meets the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.',
    // When the claim was last checked. Update it with each full check.
    claimChecked: 'We last checked every page on October 10, 2026: with a keyboard, in the accessibility tree that screen readers use, and with axe in both themes at 320 px wide and at 200% zoom.',
    checks: [
      'We check every change with axe, an automated accessibility checker, in the light and dark themes, at desktop and phone widths.',
      'Every build also checks the site’s color pairs against the WCAG AA contrast ratios, in both themes.',
    ],
    limits: 'Automated checks find only some problems. If you find one, email us the page and what went wrong.',
  },

  event: {
    title: `At KCD Texas ${currentEdition.year}`,
    // Confirmed support only (Core Event Committee). Empty until something is confirmed.
    eventSupport: [] as string[],
    meanwhile: 'We list support here once it’s confirmed. The venue’s access details come when the venue is announced.',
    ask: 'Tell us what you need before the event, and we’ll tell you what we can arrange:',
  },

  email: contact.email,
} as const;
