// Organizers listed under another form of their name in an earlier Edition: the 2027 list's name, then the
// 2026 Event Page's. src/lib/loyalty.ts matches the rest by name. Add a person only once they're known to be the
// same Organizer.

export interface SameOrganizer {
  /** The name on the 2027 list (about.ts). */
  name: string;
  /** The same person's name on an earlier Edition's list. */
  earlier: readonly string[];
}

export const returningOrganizers: readonly SameOrganizer[] = [
  { name: 'Rich Boyd', earlier: ['Richard Boyd II'] },
  { name: 'Cris Nevares', earlier: ['Cristobal Nicolas Nevares'] },
  { name: 'Vishwa Gandhi', earlier: ['Vishwa Hiren Gandhi'] },
];
