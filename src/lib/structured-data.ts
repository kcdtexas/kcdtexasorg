// The home page's structured data (JSON-LD), built only from the data files: it repeats what the
// page already says and adds no facts (ADR 0009). No venue until one is announced, and no offers
// until prices are. tests/structured-data.mjs checks it against the same files.
import { edition2027 } from '../data/edition-2027';
import { home } from '../data/home';
import { contact } from '../data/site';

const SITE = 'https://kcdtexas.org';
const ORG_ID = `${SITE}/#organization`;

export function homeJsonLd() {
  const e = edition2027;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORG_ID,
        name: 'KCD Texas',
        url: SITE,
        logo: `${SITE}/brand/badge-2027-600.png`,
        sameAs: contact.social.map((s) => s.url),
      },
      {
        '@type': 'Event',
        name: `KCD Texas ${e.year}`,
        description: home.description,
        url: `${SITE}/`,
        image: `${SITE}/cards/default.png`,
        startDate: e.eventDay,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
          '@type': 'Place',
          name: `${e.city}, TX`,
          address: { '@type': 'PostalAddress', addressLocality: e.city, addressRegion: 'TX', addressCountry: 'US' },
        },
        organizer: { '@id': ORG_ID, '@type': 'Organization', name: 'KCD Texas', url: SITE },
      },
    ],
  };
}

/** JSON for a <script type="application/ld+json"> block: "<" escaped so no text can close the element. */
export const jsonLdText = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
