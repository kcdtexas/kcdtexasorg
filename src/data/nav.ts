// Same-site paths that several components link to, and the menus built from them.
export const cfpPath = '/2027/cfp/';

export const paths = {
  home: '/',
  cfp: cfpPath,
  sponsors: '/2027/sponsors/',
  tickets: '/2027/tickets/',
  travel: '/2027/travel/',
  schedule: '/2027/schedule/',
  edition2026: '/2026/',
  editions: '/editions/',
  about: '/about/',
  conduct: '/code-of-conduct/',
  privacy: '/privacy/',
  accessibility: '/accessibility/',
} as const;

// The header keeps Round 1's labels; each one now opens its page.
export const mainNav = [
  { href: paths.cfp, label: 'Speak' },
  { href: paths.sponsors, label: 'Sponsor' },
  { href: paths.tickets, label: 'Attend' },
  { href: paths.edition2026, label: '2026 talks' },
  { href: paths.about, label: 'About' },
] as const;

// The footer's page lists.
export const footerNav = {
  event: [
    { href: paths.cfp, label: 'Call for proposals' },
    { href: paths.sponsors, label: 'Sponsors' },
    { href: paths.tickets, label: 'Tickets' },
    { href: paths.travel, label: 'Travel' },
    { href: paths.schedule, label: 'Schedule' },
  ],
  about: [
    { href: paths.about, label: 'About KCD Texas' },
    { href: paths.editions, label: 'Editions' },
    { href: paths.conduct, label: 'Code of Conduct' },
    { href: paths.privacy, label: 'Privacy' },
    { href: paths.accessibility, label: 'Accessibility' },
  ],
} as const;

/** Whether a nav link is the current page (or a page under it). */
export const isCurrent = (href: string, pathname: string) =>
  pathname === href || pathname === href.replace(/\/$/, '');
