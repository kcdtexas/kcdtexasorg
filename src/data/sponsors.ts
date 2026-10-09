// The 2027 sponsors page's words (Sponsor Committee). Figures come from the Edition files.
import { edition2026 } from './edition-2026';
import { edition2027, longDate, sponsorshipsOpen } from './edition-2027';
import { home } from './home';
import { prospectus } from './site';

const e = edition2027;
// From Apr 1 (sponsorships close Mar 31) the page says thank you instead of asking.
const open = sponsorshipsOpen();

export const sponsors = {
  title: open ? `Sponsor KCD Texas ${e.year}` : `The KCD Texas ${e.year} sponsors`,
  description: open
    ? `Sponsor KCD Texas ${e.year} in ${e.city} on ${longDate(e.eventDay)}: who you'll meet, the ${edition2026.year} sponsors, what their Sponsor Tiers included, and the ${e.year} prospectus${prospectus.url ? '' : ', coming soon'}.`
    : `Sponsorships for KCD Texas ${e.year} are closed. Thank you to every sponsor.`,
  closed: {
    lead: 'Sponsorships are closed.',
    text: `Thank you to every KCD Texas ${e.year} sponsor.`,
  },
  kicker: 'Sponsor',
  lead: `KCD Texas is where Texas teams that run Kubernetes meet the companies that build their tools. KCD Texas ${e.year} is in ${e.city} on ${longDate(e.eventDay)}.`,

  meet: {
    title: 'Who you’ll meet',
    // In words: the attendance and survey figures stay off the site (the Organizers, 2026-10-08).
    who: 'The platform, SRE and DevOps engineers, developers and architects who run Kubernetes in production across Texas.',
    quote: 'It was very engaging and as a sponsor there was lots of opportunity to engage with potential customers.',
    dallasTitle: 'Why Dallas',
    quoteBy: `A ${edition2026.year} Sponsor, in the CNCF transparency report`,
  },

  wall: {
    title2027: `KCD Texas ${e.year} is made possible by`,
    title: `${edition2026.sponsorCount} sponsors backed KCD Texas ${edition2026.year}`,
    tierPrefix: String(edition2026.year),
  },

  tiers: {
    title: 'Sponsor Tiers',
    pastTitle: `What ${edition2026.year} Sponsor Tiers included`,
    pastSource: `(from the public ${edition2026.year} prospectus)`,
    past: home.sponsor.tiers,
    pastNote: `${edition2026.year} Sponsor Tiers: Platinum, Gold, Silver and End User, plus add-ons such as the happy hour, lanyards and the coffee bar.`,
    soon: `The ${e.year} Sponsor Tiers go here when the prospectus is out.`,
    sourceLabel: 'Source:',
    pdfSource: `${edition2026.year} sponsorship prospectus (PDF, ${edition2026.prospectusPdf.size})`,
  },
  // The 2027 Sponsor Tiers, prices and benefits. Empty until the Sponsor Committee publishes them;
  // while empty, the page shows the "soon" line above.
  terms2027: null as null | { name: string; price: string; benefits: string[] }[],

  // While the 2027 prospectus has no link: the line at the top of the page, instead of a door.
  prospectusSoon: {
    lead: `The ${e.year} prospectus is coming soon.`,
    before: 'Until then, see',
    link: `what ${edition2026.year} Sponsor Tiers included`,
  },

  money: {
    title: 'Where the money goes',
    text: 'KCD Texas is not-for-profit: sponsorship and tickets pay for the event.',
    report: 'CNCF published transparency reports on the 2025 and 2026 Editions.',
    reportLink: `Read the ${edition2026.year} report`,
  },

  questions: {
    title: 'Questions',
    email: 'Email',
    conduct: 'Sponsors agree to the',
    conductLink: 'CNCF Code of Conduct',
  },
};
