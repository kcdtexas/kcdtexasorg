// The 2024 Edition's record for the loyalty credits (src/lib/loyalty.ts), derived from edition-2024.ts and
// program-2024.ts. `complete` says whether the source lists the whole set for that kind.
import { edition2024 } from '../edition-2024';
import { speakers2024, sources2024 } from '../program-2024';

export default {
  year: 2024,
  // The record, by the Organizers' decision of 2026-10-10: the team list on the Edition's CNCF application.
  // Corrections come on request.
  organizers: { names: [...edition2024.organizers.names], complete: true, source: edition2024.organizers.source },
  // Every Speaker on the KCD Texas 2024 Schedule. The hosts didn't speak.
  speakers: { names: speakers2024.map((s) => s.name), complete: true, source: sources2024.schedule },
  // The record, under the same decision: the eight sponsors on the 2024 Event Page. Texas Linux Fest's own
  // packages, whose tiers included KCD Texas, aren't counted. Corrections come on request.
  sponsors: { ids: edition2024.tiers.flatMap((t) => t.sponsors.map((s) => s.id)), complete: true, source: edition2024.sponsorsSource },
};
