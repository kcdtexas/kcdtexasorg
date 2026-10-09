// The calls to action that follow the state (plan-release-5, "What the site shows"): the header's filled button,
// the hero's doors and the tickets button. Each comes from the four facts in edition-2027.ts, never from a date.
import { contact, prospectus } from './site';
import { cfpPath, paths } from './nav';
import { cfpStatus, edition2027, phase, programPublic, sponsorshipsOpen, ticketsOnSale } from './edition-2027';

export interface Action { href: string; label: string }

/** "Get tickets" once they are on sale with CNCF's link, else "Get ticket news" (the chapter page). */
export const ticketsAction: Action = ticketsOnSale() && edition2027.tickets.url
  ? { href: edition2027.tickets.url, label: 'Get tickets' }
  : { href: contact.chapterUrl, label: 'Get ticket news' };

/** On Event Day and in the Recap: the Schedule once public, else the way to Dallas (Event Day) or the 2026 talks. */
const afterAction: Action = programPublic() ? { href: paths.schedule, label: 'See the Schedule' }
  : phase === 'event-day' ? { href: paths.travel, label: 'Getting to Dallas' }
  : { href: paths.edition2026, label: '2026 talks' };

/** The header's filled button. The CFP Phase is as in release 4: "Submit a talk" while the call is open, then
 *  "Sponsor"; from Feb 1, tickets; on Event Day and in the Recap, afterAction. Changes only on rebuild days or
 *  with the data releases (the ticket link, the program). */
export const headerCta: Action = phase === 'cfp'
  ? (cfpStatus() === 'Open now' ? { href: cfpPath, label: 'Submit a talk' }
    : sponsorshipsOpen() ? { href: prospectus.href, label: 'Sponsor' }
    : ticketsAction)
  : phase === 'countdown' ? ticketsAction
  : afterAction;

/** The hero's doors, the filled one first; the hero keeps exactly one filled button (release 4 critique).
 *  CFP Phase: sponsors first, then "Submit a talk". Countdown: tickets, then the prospectus while sponsorships
 *  are open. Event Day and the Recap: the header's button alone. */
export const heroDoors: (Action & { line?: boolean })[] = phase === 'cfp'
  ? [{ href: prospectus.href, label: prospectus.label }, { href: cfpPath, label: 'Submit a talk', line: true }]
  : phase === 'countdown'
    ? [ticketsAction, ...(sponsorshipsOpen() ? [{ href: prospectus.href, label: prospectus.label, line: true }] : [])]
    : [afterAction];
