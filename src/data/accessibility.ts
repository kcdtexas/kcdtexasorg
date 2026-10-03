// The accessibility page's words. Website part: Maintainer. Event part: Core Event Committee.
import { contact, currentEdition } from './site';

export const accessibility = {
  title: 'Accessibility',
  description: 'How kcdtexas.org is checked for accessibility, what support KCD Texas confirms for the event, and how to ask for what you need.',
  kicker: 'Website and event',
  lead: 'How we check this website, and how to tell us what you need at the event.',

  website: {
    title: 'This website',
    // Off until the Oct 26 rehearsal check passes. While false, the claim never shows.
    wcagClaim: false,
    claim: 'This website meets the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.',
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
