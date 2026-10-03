// The 2027 travel page's words (Venue Committee). The drive block comes from edition-2026.ts (OpenStreetMap).
// The venue, hotels and directions stay empty until the Venue Committee announces them.
import { edition2027, longDate } from './edition-2027';

const e = edition2027;

export const travel = {
  title: 'Getting to Dallas',
  description: `How to get to Dallas for KCD Texas ${e.year} on ${longDate(e.eventDay)}: the two airports and the drive from Austin, Houston and San Antonio.`,
  kicker: 'Travel',
  lead: `KCD Texas ${e.year} is in ${e.city} on ${longDate(e.eventDay)}. Until the venue is announced, this page covers getting to ${e.city}.`,
  venue: {
    title: 'The venue',
    // The venue's name and address (Venue Committee). Empty until announced.
    name: '',
    soon: 'Venue announced soon. Directions and hotels come with it.',
  },
  air: {
    title: 'By air',
    airports: [
      { name: 'Dallas Fort Worth International Airport', code: 'DFW' },
      { name: 'Dallas Love Field', code: 'DAL' },
    ],
  },
  car: {
    title: 'By car',
  },
} as const;
