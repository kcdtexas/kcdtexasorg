// The 2027 Edition's history, for the loyalty credits (src/lib/loyalty.ts): the Organizers on the About page and
// the announced Sponsorships (never the sample tiles). The Speakers join once the program is public. The sponsors'
// list grows until Event Day, so it is complete only once the Edition is over.
import { about } from '../about';
import { asOfDay, edition2027 } from '../edition-2027';
import { paths } from '../nav';
import { announcedSponsors2027 } from '../sponsors-2027';

const site = 'https://kcdtexas.org';

export default {
  year: 2027,
  organizers: { names: about.organizers2027.map((o) => o.name), complete: true, source: `${site}${paths.about}` },
  sponsors: { ids: announcedSponsors2027.map((s) => s.id), complete: asOfDay > edition2027.eventDay, source: `${site}${paths.sponsors}` },
};
