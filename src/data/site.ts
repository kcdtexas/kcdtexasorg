// Facts shown on the site. Every number needs a public source (see CLAUDE.md).
import { edition2027, longDate } from './edition-2027';

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

// The sponsor door: one email with the fields the Sponsor Committee needs.
export const prospectus = {
  href: `mailto:${contact.email}?subject=${encodeURIComponent(`KCD Texas ${edition2027.year} sponsor prospectus`)}&body=${encodeURIComponent('Company: \r\nName: \r\nSponsor Tier of interest: ')}`,
  label: `Email us for the ${edition2027.year} prospectus`,
  reply: 'We reply within two business days.',
} as const;

// Umami, the one analytics exception to zero data (ADR 0007). Off until the host sets ANALYTICS=umami;
// the footer's privacy line follows this setting so it stays true.
export const analytics = {
  enabled: import.meta.env.ANALYTICS === 'umami',
} as const;

export const privacyLine = analytics.enabled
  ? 'This website sets no cookies. Its cookieless analytics run on kcdtexas.org.'
  : 'This website sets no cookies and loads nothing from other companies’ servers.';
