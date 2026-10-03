// The 2027 sponsors page's words (Sponsor Committee). Figures come from the Edition files.
import { edition2026 } from './edition-2026';
import { edition2027, longDate } from './edition-2027';
import { home } from './home';

const e = edition2027;

export const sponsors = {
  title: `Sponsor KCD Texas ${e.year}`,
  description: `Sponsor KCD Texas ${e.year} in ${e.city} on ${longDate(e.eventDay)}. Who you'll meet, the ${edition2026.year} sponsors, and how to get the ${e.year} prospectus.`,
  kicker: 'Sponsor',
  lead: `KCD Texas is where Texas teams that run Kubernetes meet the companies that build their tools. ${edition2026.checkedIn} attendees checked in at KCD Texas ${edition2026.year} in ${edition2026.city}. KCD Texas ${e.year} is in ${e.city} on ${longDate(e.eventDay)}.`,

  meet: {
    title: 'Who you’ll meet',
    checkedInLabel: `attendees checked in, ${edition2026.city}, ${edition2026.date}`,
    reportSource: 'CNCF transparency report',
    surveyTitle: `From the ${edition2026.year} pre-registration survey`,
    // The top three roles, then where respondents came from, first visits and End-User companies
    // (the survey's "7 in 10" line is left out: the roles above already say it).
    survey: [...edition2026.surveyRoles, ...edition2026.survey.filter((f) => !('about' in f) || f.value !== '7 in 10')],
    surveySource: `${edition2026.year} pre-registration survey, so these figures describe the people who answered it.`,
    quote: 'It was very engaging and as a sponsor there was lots of opportunity to engage with potential customers.',
    dallasTitle: 'Why Dallas',
    quoteBy: `A ${edition2026.year} Sponsor, in the CNCF transparency report`,
  },

  wall: {
    title: `${edition2026.sponsorCount} sponsors backed KCD Texas ${edition2026.year}`,
    tierPrefix: String(edition2026.year),
  },

  tiers: {
    title: 'Sponsor Tiers',
    pastTitle: `What ${edition2026.year} Sponsor Tiers included`,
    pastSource: `(from the public ${edition2026.year} prospectus)`,
    past: home.sponsor.tiers,
    pastNote: `${edition2026.year} Sponsor Tiers: Platinum, Gold, Silver and End User, plus add-ons such as the happy hour, lanyards and the coffee bar.`,
    soon: `The ${e.year} Sponsor Tiers go here when the prospectus is ready. Until then, email us for it.`,
    sourceLabel: 'Source:',
    pdfSource: `${edition2026.year} sponsorship prospectus (PDF, ${edition2026.prospectusPdf.size})`,
  },
  // The 2027 Sponsor Tiers, prices and benefits. Empty until the Sponsor Committee publishes them;
  // while empty, the page shows the "soon" line above.
  terms2027: null as null | { name: string; price: string; benefits: string[] }[],

  money: {
    title: 'Where the money goes',
    text: 'KCD Texas is not-for-profit: sponsorship and tickets pay for the event.',
    report: `CNCF publishes a transparency report after each Edition.`,
    reportLink: `Read the ${edition2026.year} report`,
  },

  questions: {
    title: 'Questions',
    email: 'Email',
    conduct: 'Sponsors agree to the',
    conductLink: 'CNCF Code of Conduct',
  },
};
