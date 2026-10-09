// The home page's words. Dates and figures come from the Edition files, never typed in here.
import { edition2026 } from './edition-2026';
import { prospectus } from './site';
import { cfpPath, paths } from './nav';
import { sponsors2027 } from './sponsors-2027';
import { cfpSentence, cfpStatus, edition2027, eventStatus, longDate, phase, programSample, programState, programStatus, shortDate, shortDateYear, sponsorAsk, sponsorshipsStatus, ticketsOnSale, ticketsSample, ticketsSentence, ticketsStatus } from './edition-2027';

const e = edition2027;
const lowerFirst = (s: string) => s[0].toLowerCase() + s.slice(1);
const sponsNow = sponsorshipsStatus();
const cfpNow = cfpStatus();
const tixNow = ticketsStatus();
const eventNow = eventStatus();
const tixOn = ticketsOnSale();
const prog = programState();
const has2027 = sponsors2027.length > 0;

// The Countdown's bill and the program block say where the program stands, by its gate (programState).
const progSentence = prog === 'out' ? 'are out' : prog === 'dated' ? `come out ${shortDate(e.schedule)}` : 'are coming soon';
const promise = 'One day of Kubernetes and cloud native talks and hands-on workshops';
const descriptions = {
  cfp: `KCD Texas ${e.year}: ${lowerFirst(promise)} in ${e.city} on ${longDate(e.eventDay)}. The call for proposals ${cfpSentence()}.`,
  countdown: `KCD Texas ${e.year}: ${lowerFirst(promise)} in ${e.city} on ${longDate(e.eventDay)}. Tickets ${ticketsSentence()}; the Speakers and the Schedule ${progSentence}.`,
  'event-day': `KCD Texas ${e.year} is today in ${e.city}: ${lowerFirst(promise)}.`,
  recap: `KCD Texas ${e.year} took place in ${e.city} on ${longDate(e.eventDay)}. Thank you to every Attendee, Speaker, sponsor and volunteer.`,
};

// The bill under the title (Bill2027.astro): its notes, then one big line, a link or a statement.
// CFP Phase: what's open first, sponsors then speakers; once tickets are on sale, they take the keynotes' place.
// Countdown: tickets, the Schedule (by its gate), and sponsorships while open, then the 2026 talks.
// Event Day and the Recap: one statement, no notes.
type Note = { label: string; text: string };
const bills: Record<typeof phase, { notes: Note[]; end: { label: string; href?: string } }> = {
  cfp: {
    notes: [
      { label: 'Sponsorships:', text: lowerFirst(sponsNow) },
      { label: 'Call for proposals:', text: lowerFirst(cfpNow) },
      tixOn ? { label: 'Tickets:', text: 'on sale now' } : { label: 'Keynotes:', text: `announced ${shortDate(e.schedule)}` },
    ],
    end: { label: 'Your End-User Story here', href: cfpPath },
  },
  countdown: {
    notes: [
      { label: 'Tickets:', text: lowerFirst(tixNow) },
      { label: 'Schedule:', text: programStatus() },
      ...(sponsorAsk() ? [{ label: 'Sponsorships:', text: lowerFirst(sponsNow) }] : []),
    ],
    end: { label: `Watch the ${edition2026.year} talks`, href: `${paths.edition2026}#program` },
  },
  'event-day': { notes: [], end: { label: `Today in ${e.city}` } },
  recap: { notes: [], end: { label: `Thank you, ${e.city}` } },
};

export const home = {
  title: `KCD Texas ${e.year} · ${e.city} · ${longDate(e.eventDay)}`,
  description: descriptions[phase],

  hero: {
    promise: 'One day of Kubernetes and cloud native talks and hands-on workshops, for the platform, SRE and DevOps engineers who run production across Texas. Organized by local volunteers and supported by the Cloud Native Computing Foundation (CNCF).',
    // The bill's fit values come from the font at build time (src/lib/bill-fit.ts), for whatever it says.
    bill: bills[phase],
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
    // edition-2027.ts, and /now.js between builds). Sponsorships read "Open now", then "Closed" after their last
    // day; tickets have no day until CNCF sets one, and no span then. Each detail says something the date doesn't.
    items: [
      { key: 'spons', name: 'Sponsorships', status: sponsNow, big: sponsNow, echo: true,
        // From Event Day the site asks no one to sponsor (sponsorAsk), so the row thanks them, though still open.
        detail: !sponsorAsk() ? { text: `Thanks to every ${e.year} sponsor.` } : { text: prospectus.label, href: prospectus.url ? 'prospectus' : 'sponsors' } },
      { key: 'cfp', name: 'Call for proposals', status: cfpNow, big: shortDate(e.cfp.opens), bigTo: shortDate(e.cfp.closes), echo: cfpNow.startsWith('Opens'),
        from: e.cfp.opens, until: e.cfp.closes,
        detail: cfpNow === 'Closed' ? { text: 'Thanks to everyone who sent a proposal.' } : { text: 'Read the CFP guide', href: 'cfp' } },
      // "Sample day" marks a test build with a made-up sale day (build.sh --tickets-day); check-dist blocks it elsewhere.
      { key: 'tix', name: 'Tickets', status: tixNow, big: e.tickets.onSale ? shortDate(e.tickets.onSale) : tixNow, echo: Boolean(e.tickets.onSale) && tixNow !== 'On sale now',
        // NOW treats the sale day as one day; `ends` keeps tickets current (not faded as past) until the event.
        undated: !e.tickets.onSale, ...(e.tickets.onSale ? { from: e.tickets.onSale, until: e.tickets.onSale, ends: e.eventDay } : {}),
        detail: ticketsSample ? { text: 'Sample day, not a real date' } : { text: 'Get ticket news', href: 'chapter' } },
      // The Schedule follows the program's gate (programState), like every program word: its date until then,
      // "Coming soon" with no date and no bar if the day passes without the release, "Out now" once public.
      prog === 'soon'
        ? { key: 'sched', name: 'Schedule', status: 'Coming soon', big: 'Coming soon', echo: true, late: true,
          detail: { text: 'With the Speakers and keynotes' } }
        : { key: 'sched', name: 'Schedule', status: prog === 'out' ? 'Out now' : shortDate(e.schedule), big: shortDate(e.schedule), echo: prog !== 'out', from: e.schedule, until: e.schedule, ends: e.eventDay,
          detail: { text: 'With the Speakers and keynotes' } },
      { key: 'event', name: `KCD Texas ${e.year}`, status: eventNow, big: shortDate(e.eventDay), echo: !eventNow.startsWith('Today'), from: e.eventDay, until: e.eventDay,
        detail: { text: `One day, in person, in ${e.city}.` } },
    ],
  },

  wall: {
    title: `${edition2026.sponsorCount} sponsors backed KCD Texas 2026`,
    // With the first 2027 sponsor (sponsors-2027.ts), 2027 leads. In the CFP Phase the 2026 wall stays below as
    // proof; from Feb 1 only 2027 shows here, and 2026 stays on /2026/ (plan-release-5, "The sponsor analysis").
    // The 2027 title is a draft; the wording is the Sponsor Committee's call (owner-actions A76).
    title2027: phase === 'recap' ? `Thank you to our ${e.year} sponsors` : `KCD Texas ${e.year} is made possible by`,
    thanks2026: `Thanks to our ${edition2026.year} sponsors`,
    // The open spot after the newest wall, while sponsorships are open (the owner's wording, 2026-10-08 and -09).
    slot: has2027 ? 'Join them' : `Be the first ${e.year} sponsor`,
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

  // The program block replaces the speak section from Feb 1 (ProgramBlock.astro). Its wording follows the
  // program's gate, never the date: "Mar 1" before then, "coming soon" if the day passes without the release.
  program: {
    kicker: 'The program',
    title: prog === 'out' ? (phase === 'recap' ? `The KCD Texas ${e.year} program` : 'The Speakers and the Schedule are out.')
      : `Speakers, keynotes and the Schedule: ${prog === 'dated' ? shortDate(e.schedule) : 'coming soon'}`,
    lead: prog === 'out' ? 'See who’s speaking, and plan your day.'
      : `The Session Committee selects the Sessions. The Speakers, the keynotes and the Schedule ${prog === 'dated' ? `come out together on ${shortDateYear(e.schedule)}` : 'come out together soon'}. Until then, watch how teams ran Kubernetes in production at KCD Texas 2026.`,
    schedule: 'See the Schedule',
    speakers: 'Meet the Speakers',
    past: 'See the 2026 program',
    // build.sh --program-public: the gate is open but this build has no program data.
    sample: programSample ? 'Sample: this test build has no program data.' : '',
    talksTitle: 'End-User talks from 2026',
  },

  stage: {
    kicker: `KCD Texas 2026 · ${edition2026.city} · ${edition2026.date}`,
    title: 'On the 2026 stage',
    count: `${edition2026.speakers} Speakers and ${edition2026.hosts} hosts`,
    asPrinted: 'Affiliations as printed on the 2026 Event Page.',
    // The talks list and the recap video live on /2026/ (release 4: the stage was 2,600 px tall).
    programLink: `See the full 2026 program and its ${edition2026.recordings} talk recordings`,
    // The open slot that ends the stage: an End-User Story in the CFP Phase, then the 2027 keynotes by the gate.
    slot2027: prog === 'out' ? 'See the keynotes' : `Keynotes: ${programStatus()}`,
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
    title: phase === 'event-day' ? `KCD Texas ${e.year} is today.` : `Coming to learn? Tickets ${ticketsSentence()}.`,
    lead: phase === 'event-day' ? `The travel page covers getting to ${e.city}, and the venue once it's announced.`
      : tixOn ? `Buy ${e.year} tickets on the CNCF community site. 2026 tickets cost $50 to $150, depending on when you bought.`
      : `2026 tickets cost $50 to $150, depending on when you bought. Join the KCD Texas chapter on the CNCF community site to get the email when ${e.year} tickets go on sale.`,
    buttonNote: tixOn ? 'On the CNCF community site' : 'Free CNCF community account',
    travel: 'See the travel page',
    letter: `An approval letter is coming in ${e.managerLetter}, with the cost and what your team gets back.`,
    photoAlt: 'Three attendees laugh together between sessions.',
    photoTime: '3:28 p.m.',
    photoCaption: 'Three attendees between sessions.',
  },
};
