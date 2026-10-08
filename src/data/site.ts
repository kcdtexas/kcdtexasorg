// Facts shown on the site. Every number needs a public source (see CLAUDE.md).
import { edition2027, longDate } from './edition-2027';
import { paths } from './nav';

export const contact = {
  email: 'organizers@kcdtexas.org',
  conductEmail: 'conduct@cncf.io',
  chapterUrl: 'https://community2.cncf.io/kcd-texas/',
  communityUrl: 'https://cloudnativetexas.com',
  githubUrl: 'https://github.com/kcdtexas',
  social: [
    { label: 'X', handle: '@KCDTexas', url: 'https://x.com/KCDTexas' },
    { label: 'LinkedIn', handle: 'KCD Texas', url: 'https://www.linkedin.com/company/kcdtexas/' },
    { label: 'Instagram', handle: '@TexasKCD', url: 'https://www.instagram.com/texaskcd/' },
    // The channel with every recorded talk (a Co-Organizer asked for a direct link, 2026-10-08).
    { label: 'YouTube', handle: '@KCDTexas', url: 'https://www.youtube.com/@KCDTexas' },
  ],
} as const;

export const currentEdition = {
  year: edition2027.year,
  city: edition2027.city,
  date: edition2027.eventDay, // Event Day (Central time)
  when: longDate(edition2027.eventDay),
} as const;

export const legal = {
  codeOfConductUrl: 'https://www.cncf.io/conduct/',
  kcdProgramUrl: 'https://www.cncf.io/kcds/',
  lfTrademarksUrl: 'https://www.linuxfoundation.org/legal/trademark-usage',
} as const;

// The 2027 prospectus (Sponsor Committee): a PDF the committee puts on GitHub and links directly, so no
// one has to email for it. Until its link is in, the sponsor doors open the sponsors page and say it's
// coming soon (a Co-Organizer, 2026-10-08). Put the direct link in `url` to switch every door to it.
const prospectusUrl: string = '';
export const prospectus = {
  url: prospectusUrl,
  href: prospectusUrl || paths.sponsors,
  // The doors: the hero, the home sponsor block and the sponsors link card.
  label: prospectusUrl ? `Download the ${edition2027.year} prospectus` : `Sponsor KCD Texas ${edition2027.year}`,
  // The open slot on the home page's sponsor wall, next to "Your logo here".
  slot: prospectusUrl ? `Download the ${edition2027.year} prospectus` : 'How to sponsor',
  note: prospectusUrl ? 'PDF on GitHub' : `${edition2027.year} prospectus coming soon`,
} as const;

// Umami, the one analytics exception to zero data (ADR 0007). Off until the host sets ANALYTICS=umami;
// the footer's privacy line follows this setting so it stays true.
export const analytics = {
  enabled: import.meta.env.ANALYTICS === 'umami',
} as const;

export const privacyLine = analytics.enabled
  ? 'This website sets no cookies. Its cookieless analytics run on kcdtexas.org.'
  : 'This website sets no cookies and loads nothing from other companies’ servers.';
