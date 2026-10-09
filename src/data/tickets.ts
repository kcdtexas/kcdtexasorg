// The 2027 tickets page's words (Core Event Committee). Dates come from the Edition file.
// No 2027 prices until they are announced; the 2026 range is labeled 2026.
import { edition2027, longDate, managerLetterLine, shortDate, shortDateYear, ticketsSentence } from './edition-2027';

const e = edition2027;
// " on Feb 1" once CNCF sets the sale day; empty until then.
const onDay = e.tickets.onSale ? ` on ${shortDate(e.tickets.onSale)}` : '';

export const tickets = {
  title: `Tickets for KCD Texas ${e.year}`,
  description: `Tickets for KCD Texas ${e.year} in ${e.city} ${ticketsSentence()}, on the CNCF community site. Join the KCD Texas chapter to hear first.`,
  kicker: 'Tickets',
  lead: `Tickets ${ticketsSentence()}, on the CNCF community site. Members of the KCD Texas chapter there hear first.`,
  facts: [
    { term: 'On sale', text: e.tickets.onSale ? shortDateYear(e.tickets.onSale) : 'Coming soon' },
    { term: 'Where', text: 'CNCF community site' },
    { term: 'Event', text: `${longDate(e.eventDay)}, ${e.city}` },
  ],
  chapter: {
    button: 'Join the KCD Texas chapter',
    note: 'Free CNCF community account',
    text: 'Registration and checkout happen only on the CNCF community site. We email chapter members when tickets go on sale.',
  },
  prices: {
    title: 'Prices',
    text: `We publish the ${e.year} prices when tickets go on sale${onDay}.`,
    // From the 2026 Event Page (past-editions.md). Always labeled 2026.
    past: '2026 tickets cost $50 to $150, depending on when you bought.',
  },
  diversity: {
    title: 'Diversity tickets',
    text: `KCD Texas ${e.year} offers free diversity tickets.`,
    // Who can apply, how and by when (Core Event Committee). Empty until tickets go on sale.
    details: '',
    soon: `Who can apply, and how, goes up here when tickets go on sale${onDay}.`,
  },
  manager: {
    title: 'Need your manager’s OK?',
    text: managerLetterLine,
  },
} as const;
