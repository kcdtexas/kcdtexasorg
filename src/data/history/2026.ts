// The 2026 Edition's history, for the loyalty credits (src/lib/loyalty.ts). Every list comes from the data the 2026
// page prints, as listed on the 2026 Event Page: the Organizers and the sponsors (by logo file name) from
// edition-2026.ts, and the Speakers from program-2026.ts (keynotes and talks; the hosts didn't speak). The Speakers'
// and the sponsors' lists are complete when they match the transparency report's counts. The Organizers' list is
// set complete with no count to check it against: it is the Event Page's organizer cards.
import { edition2026 } from '../edition-2026';
import { keynotes2026, speakers2026 } from '../program-2026';

const e = edition2026;
const speakers = [...keynotes2026, ...speakers2026].map((s) => s.name);
const sponsors = [...e.sponsors.platinum, ...e.sponsors.gold, ...e.sponsors.silver].map((s) => s.id);

export default {
  year: 2026,
  organizers: { names: e.organizers.map((o) => o.name), complete: true, source: e.eventPageUrl },
  speakers: { names: speakers, complete: speakers.length === e.speakers, source: e.eventPageUrl },
  sponsors: { ids: sponsors, complete: sponsors.length === e.sponsorCount, source: e.eventPageUrl },
};
