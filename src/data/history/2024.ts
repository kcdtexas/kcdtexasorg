// The 2024 Edition's record for the "since" credits (src/lib/loyalty.ts), derived from edition-2024.ts and
// program-2024.ts. `complete` says whether the source lists the whole set for that kind.
import { edition2024 } from '../edition-2024';
import { speakers2024, sources2024 } from '../program-2024';

export default {
  year: 2024,
  // The application's team dates from Feb 2023, so it may differ from the team that ran the day.
  organizers: { names: [...edition2024.organizers.names], complete: false, source: edition2024.organizers.source },
  // Every Speaker on the KCD Texas 2024 Schedule. The hosts didn't speak.
  speakers: { names: speakers2024.map((s) => s.name), complete: true, source: sources2024.schedule },
  // Texas Linux Fest's sponsor page lists more companies in tiers that included KCD Texas.
  sponsors: { ids: edition2024.tiers.flatMap((t) => t.sponsors.map((s) => s.id)), complete: false, source: edition2024.sponsorsSource },
};
