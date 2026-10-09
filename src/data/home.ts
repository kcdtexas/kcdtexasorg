// The home page's words. Dates and figures come from the Edition files, never typed in here.
import { edition2026 } from './edition-2026';
import { prospectus } from './site';
import { cfpSentence, cfpStatus, edition2027, eventStatus, longDate, shortDate, shortDateYear, ticketsSample, ticketsSentence, ticketsStatus } from './edition-2027';

const e = edition2027;
const lowerFirst = (s: string) => s[0].toLowerCase() + s.slice(1);
const cfpNow = cfpStatus();
const tixNow = ticketsStatus();
const eventNow = eventStatus();

export const home = {
  title: `KCD Texas ${e.year} · ${e.city} · ${longDate(e.eventDay)}`,
  description: `KCD Texas ${e.year}: one day of Kubernetes and cloud native talks and hands-on workshops in ${e.city} on ${longDate(e.eventDay)}. The call for proposals ${cfpSentence()}.`,

  hero: {
    promise: 'One day of Kubernetes and cloud native talks and hands-on workshops, for the platform, SRE and DevOps engineers who run production across Texas. Organized by local volunteers and supported by the Cloud Native Computing Foundation (CNCF).',
    bill: [
      { label: 'Keynotes:', text: `announced ${shortDate(e.schedule)}` },
      { label: 'Call for proposals:', text: lowerFirst(cfpStatus()) },
      { label: 'Sponsorships:', text: lowerFirst(e.sponsorships.status) },
    ],
    proofLead: `KCD Texas 2026 in ${edition2026.city}:`,
    // The band's two photos, each captioned under itself like every photo on the site: a bold lead, then the words.
    // The one with a phone crop is the only one phones show.
    // Critique fix 7: no time on Ian Coldwater's keynote here; the stage card keeps 10:14 a.m.
    band: [
      { photo: 'band-043', lead: 'Keynote', text: 'Ian Coldwater', alt: 'KCD Texas 2026: Ian Coldwater gives a keynote to a full room of attendees, many in cowboy hats.' },
      { photo: 'band-171', phone: 'band-171-phone', lead: '3:03 p.m.', text: 'A packed afternoon session', alt: 'KCD Texas 2026: a packed afternoon session of attendees at tables with laptops listens to a talk.' },
    ],
  },

  dates: {
    title: 'Key dates',
    // In date order. `big` is the poster line and `bigTo` a range's end; `echo` marks a status that only repeats
    // `big`, so the key dates can hide it on screen; `from` and `until` (YYYY-MM-DD) place NOW (nowOn() in
    // edition-2027.ts, and /now.js between builds). Sponsorships are open throughout, and tickets have no day
    // until CNCF sets one, so neither has a span then. Each detail says something the date doesn't.
    items: [
      { key: 'spons', name: 'Sponsorships', status: e.sponsorships.status, big: e.sponsorships.status, echo: true,
        detail: prospectus.url ? { text: 'Download the prospectus', href: 'prospectus' } : { text: 'How to sponsor', href: 'sponsors' } },
      { key: 'cfp', name: 'Call for proposals', status: cfpNow, big: shortDate(e.cfp.opens), bigTo: shortDate(e.cfp.closes), echo: cfpNow.startsWith('Opens'),
        from: e.cfp.opens, until: e.cfp.closes,
        detail: cfpNow === 'Closed' ? { text: 'Thanks to everyone who sent a proposal.' } : { text: 'Read the CFP guide', href: 'cfp' } },
      // "Sample day" marks a test build with a made-up sale day (build.sh --tickets-day); check-dist blocks it elsewhere.
      { key: 'tix', name: 'Tickets', status: tixNow, big: e.tickets.onSale ? shortDate(e.tickets.onSale) : tixNow, echo: Boolean(e.tickets.onSale) && tixNow !== 'On sale now',
        undated: !e.tickets.onSale, ...(e.tickets.onSale ? { from: e.tickets.onSale, until: e.tickets.onSale } : {}),
        detail: ticketsSample ? { text: 'Sample day, not a real date' } : { text: 'Get ticket news', href: 'chapter' } },
      { key: 'sched', name: 'Schedule', status: shortDate(e.schedule), big: shortDate(e.schedule), echo: true, from: e.schedule, until: e.schedule,
        detail: { text: 'With the Speakers and keynotes' } },
      { key: 'event', name: `KCD Texas ${e.year}`, status: eventNow, big: shortDate(e.eventDay), echo: !eventNow.startsWith('Today'), from: e.eventDay, until: e.eventDay,
        detail: { text: `One day, in person, in ${e.city}.` } },
    ],
  },

  wall: {
    title: `${edition2026.sponsorCount} sponsors backed KCD Texas 2026`,
    // The open spot that ends the 2026 wall (the owner's wording, 2026-10-08; proof first, 2026-10-09).
    // It holds only while no 2027 sponsor is announced: with the first, this area becomes the 2027
    // sponsors, the spot says "Your logo here", and the 2026 wall leaves the home page (owner-actions A64).
    slot: `Be the first ${e.year} sponsor`,
    link: 'How to get a spot here',
  },

  sponsor: {
    kicker: 'Sponsor',
    title: 'Put your team in front of Texas platform engineers.',
    lead: 'KCD Texas is where Texas teams that run Kubernetes meet the companies that build their tools.',
    tiersTitle: 'What 2026 Sponsor Tiers included',
    tiersSource: '(from the public 2026 prospectus)',
    tiers: [
      'A table in the sponsor hall (Platinum and Gold)',
      'Two minutes on the main stage to introduce your team (Platinum)',
      'Your logo on the website, in emails, on signage and in the CNCF transparency report',
      'Full-day passes for your team',
    ],
    tiersNote: `Sponsor Tiers: Platinum, Gold, Silver and End User, plus add-ons such as the happy hour, lanyards and the coffee bar.`,
    // Critique fix 8: the sponsor hall (photo 001) instead of the cut-off roll-up (136).
    photoAlt: 'Attendees, several in cowboy hats, walk between sponsor tables in the KCD Texas 2026 sponsor hall, in front of Diagrid’s backdrop.',
    photoTime: '8:41 a.m.',
    photoCaption: 'The sponsor hall before the first keynote.',
  },

  speak: {
    kicker: 'Tell us what broke',
    title: 'Run Kubernetes at work? Tell us how.',
    lead: 'We want more talks from teams running cloud native in production: what broke, what they changed, what they’d do again. If your organization runs Kubernetes rather than sells it, mark your proposal as an End-User Story. Work at a vendor? Tell us what you learned, not what you sell.',
    // Assumed approved by the Session Committee (owner, 2026-10-03), so no tag.
    employer: 'You don’t have to name your employer’s systems. Ask us for help with your company’s review.',
    facts: [
      { term: 'Dates', text: `Opens ${shortDateYear(e.cfp.opens)}; closes ${shortDateYear(e.cfp.closes)}, ${e.cfp.closesTime} Central` },
      { term: 'Formats', text: 'Talks and hands-on workshops' },
      { term: 'Video', text: `${edition2026.recordings} talks from 2026 are on YouTube`, href: edition2026.talksUrl },
      { term: 'First time', text: 'First time speaking? Ask for a mentor when you submit.' },
      { term: 'Proposals', text: `KCD Texas 2025 received ${edition2026.proposals2025} proposals.` },
    ],
    photoAlt: 'Tyler Auerbeck speaks during his afternoon talk at KCD Texas 2026, a microphone clipped to his shirt.',
    photoTime: '4:07 p.m.',
    photoCaption: 'Tyler Auerbeck, Stack AV: Self-Service, Multi-Tenant Infrastructure With Kured and Flatcar Linux.',
    photoYoutube: 'WoI83_KQtWM',
    // Two more End-User talks from 2026 under the photo (they moved here from the hero in release 4),
    // with titles, names and affiliations as printed (edition2026.talks).
    talksTitle: 'More End-User talks from 2026',
    talks: ['abhinav-dahiya', 'shravani-gunturu'],
  },

  stage: {
    kicker: `KCD Texas 2026 · ${edition2026.city} · ${edition2026.date}`,
    title: 'On the 2026 stage',
    count: `${edition2026.speakers} Speakers and ${edition2026.hosts} hosts`,
    asPrinted: 'Affiliations as printed on the 2026 Event Page.',
    // The talks list and the recap video live on /2026/ (release 4: the stage was 2,600 px tall).
    programLink: `See the full 2026 program and its ${edition2026.recordings} talk recordings`,
  },

  day: {
    title: 'A day at KCD Texas 2026',
    photos: [
      { id: '206', time: '1:00 p.m.', caption: 'A Texas longhorn came to visit.', alt: 'An attendee in a cowboy hat raises an arm beside a Texas longhorn with wide horns, in front of the KCD Texas backdrop.' },
      { id: '082', time: '3:12 p.m.', caption: 'Between sessions.', alt: 'Three attendees bump fists in the hallway between sessions.' },
      { id: '138', time: '5:15 p.m.', caption: 'Hands up for the closing raffle.', alt: 'An attendee in a cowboy hat and bandana raises an arm for the closing raffle, with more raised hands behind.' },
    ],
  },

  attend: {
    kicker: 'Attend',
    title: `Coming to learn? Tickets ${ticketsSentence()}.`,
    lead: `2026 tickets cost $50 to $150, depending on when you bought. Join the KCD Texas chapter on the CNCF community site to get the email when ${e.year} tickets go on sale.`,
    letter: `An approval letter is coming in ${e.managerLetter}, with the cost and what your team gets back.`,
    photoAlt: 'Three attendees laugh together between sessions.',
    photoTime: '3:28 p.m.',
    photoCaption: 'Three attendees between sessions.',
  },
};
