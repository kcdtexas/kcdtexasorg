// The home page's words. Dates and figures come from the Edition files, never typed in here.
import { edition2026 } from './edition-2026';
import { cfpStatus, edition2027, longDate, shortDate, shortDateYear } from './edition-2027';

const e = edition2027;
const lowerFirst = (s: string) => s[0].toLowerCase() + s.slice(1);

export const home = {
  title: `KCD Texas ${e.year} · ${e.city} · ${longDate(e.eventDay)}`,
  description: `KCD Texas ${e.year}: one day of Kubernetes and cloud native talks and hands-on workshops in ${e.city} on ${longDate(e.eventDay)}. The call for proposals ${lowerFirst(cfpStatus())}.`,

  hero: {
    promise: 'One day of Kubernetes and cloud native talks and hands-on workshops, for the platform, SRE and DevOps engineers who run production across Texas. Organized by local volunteers and supported by the Cloud Native Computing Foundation (CNCF).',
    bill: [
      { label: 'Keynotes:', text: `announced in ${e.cfp.keynotesAnnounced}` },
      { label: 'Call for proposals:', text: lowerFirst(cfpStatus()) },
      { label: 'Sponsorships:', text: lowerFirst(e.sponsorships.status) },
    ],
    // Critique fix 6: say it's a 2026 talk, with the full title, and the name and affiliation as printed.
    watch: { text: 'Watch a 2026 talk: We Migrated to Karpenter and Our Costs Went Up: A Journey to Real Savings, Abhinav Dahiya, Lyft', youtube: 'UdpviRNrnj8' },
    talkNote: `Call for proposals ${lowerFirst(cfpStatus())}`,
    ticketNote: 'Free CNCF community account',
    managerLink: 'Need your manager’s OK?',
    proofLead: `KCD Texas 2026 in ${edition2026.city}:`,
    // Critique fix 7: no time for Ian Coldwater here; the stage card keeps 10:14 a.m.
    caption: [
      { time: null, text: 'Ian Coldwater’s keynote' },
      { time: '3:03 p.m.', text: 'A packed afternoon session' },
    ],
    bandAlt: 'KCD Texas 2026: Ian Coldwater gives a keynote to a full room of attendees, many in cowboy hats, and a packed afternoon session of attendees at tables with laptops listens to a talk.',
  },

  dates: {
    items: [
      { key: 'spons', name: 'Sponsorships', status: e.sponsorships.status, detail: { text: 'Email us for the prospectus', href: 'prospectus' } },
      { key: 'cfp', name: 'Call for proposals', status: cfpStatus(), detail: { text: `Closes ${shortDateYear(e.cfp.closes)}` } },
      { key: 'tix', name: 'Tickets', status: `On sale ${shortDate(e.tickets.onSale)}`, detail: { text: 'Chapter members hear first', href: 'chapter' } },
      { key: 'sched', name: 'Schedule', status: shortDate(e.schedule), detail: { text: `Speakers announced in ${e.speakersAnnounced}` } },
      { key: 'event', name: `KCD Texas ${e.year}`, status: `${shortDate(e.eventDay)} · ${e.city}`, detail: { text: e.eventNote } },
    ],
  },

  wall: {
    title: `${edition2026.sponsorCount} sponsors backed KCD Texas 2026`,
    slot: `Your logo here in ${e.year}`,
  },

  room: {
    title: 'Who was in the room in 2026',
    checkedInLabel: `attendees checked in, ${edition2026.city}, ${edition2026.date}`,
    reportSource: 'CNCF transparency report',
    surveySource: '2026 pre-registration survey, so it describes the people who answered it',
    more: 'Read the KCD Texas 2026 transparency report',
  },

  sponsor: {
    kicker: 'Sponsor',
    title: 'Put your team in front of Texas platform engineers.',
    lead: 'KCD Texas is where Texas teams that run Kubernetes meet the companies that build their tools. In the 2026 pre-registration survey, about 7 in 10 respondents were DevOps, SRE and sysadmin staff, developers or architects, 79% were from Texas, and about 1 in 4 worked at an End-User company.',
    tiersTitle: 'What 2026 Sponsor Tiers included',
    tiersSource: '(from the public 2026 prospectus)',
    tiers: [
      'A table in the sponsor hall (Platinum and Gold)',
      'Two minutes on the main stage to introduce your team (Platinum)',
      'Your logo on the website, in emails, on signage and in the CNCF transparency report',
      'Full-day passes for your team',
    ],
    tiersNote: `Sponsor Tiers: Platinum, Gold, Silver and End User, plus add-ons such as the happy hour, lanyards and the coffee bar. ${e.year} details are in the prospectus.`,
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
      { term: 'Video', text: `${edition2026.recordings} talks from 2026 are on YouTube` },
      { term: 'First time', text: 'First time speaking? Ask for a mentor when you submit.' },
      { term: 'Proposals', text: `KCD Texas 2025 received ${edition2026.proposals2025} proposals.` },
    ],
    photoAlt: 'Tyler Auerbeck speaks during his afternoon talk at KCD Texas 2026, a microphone clipped to his shirt.',
    photoTime: '4:07 p.m.',
    photoCaption: 'Tyler Auerbeck, Stack AV: Self-Service, Multi-Tenant Infrastructure With Kured and Flatcar Linux.',
    photoYoutube: 'WoI83_KQtWM',
  },

  stage: {
    kicker: `KCD Texas 2026 · ${edition2026.city} · ${edition2026.date}`,
    title: 'On the 2026 stage',
    count: `${edition2026.speakers} Speakers and ${edition2026.hosts} hosts`,
    asPrinted: 'Affiliations as printed on the 2026 Event Page.',
    recordings: `${edition2026.recordings} talk recordings on YouTube`,
    talksTitle: 'More 2026 talks, practitioners first',
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
    title: `Coming to learn? Tickets go on sale ${shortDate(e.tickets.onSale)}.`,
    lead: `2026 tickets cost $50 to $150, depending on when you bought. Join the KCD Texas chapter on the CNCF community site to get the email when ${e.year} tickets go on sale.`,
    letter: `An approval letter is coming in ${e.managerLetter}, with the cost and what your team gets back.`,
    photoAlt: 'Three attendees laugh together between sessions.',
    photoTime: '3:28 p.m.',
    photoCaption: 'Three attendees between sessions.',
  },
};
