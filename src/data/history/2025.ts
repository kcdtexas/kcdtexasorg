// The 2025 Edition's record for the loyalty credits (src/lib/loyalty.ts), derived from edition-2025.ts and
// program-2025.ts. `complete` says whether the source lists the whole set for that kind.
import { edition2025 } from '../edition-2025';
import { speakers2025, sources2025 } from '../program-2025';

export default {
  year: 2025,
  // The record, by the Organizers' decision of 2026-10-10: the team list on the Edition's CNCF application.
  // Corrections come on request.
  organizers: { names: [...edition2025.organizers.names], complete: true, source: edition2025.organizers.source },
  // Every Speaker on the Schedule: 29, as the report counts. The hosts didn't speak.
  speakers: { names: speakers2025.map((s) => s.name), complete: true, source: sources2025.schedule },
  // The Event Page's whole sponsor wall; the Partners aren't sponsors.
  sponsors: { ids: edition2025.tiers.flatMap((t) => t.sponsors.map((s) => s.id)), complete: true, source: edition2025.sponsorsSource },
};
