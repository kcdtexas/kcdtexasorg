// The 2024 Edition, a Past Edition, co-located with Texas Linux Fest. Every list carries its public source
// (CLAUDE.md): the sponsors and Partners as shown on the 2024 Event Page, the Organizers from the Edition's CNCF
// application. The program is in program-2024.ts. No attendance figure: none is published as a number.
import type { PastTier } from './edition-2025';
import { sessions2024, sources2024 } from './program-2024';

const eventPageUrl = sources2024.eventPage;

export const edition2024 = {
  year: 2024,
  city: 'Austin',
  date: 'April 12, 2024',
  coLocated: { name: 'Texas Linux Fest', url: 'https://2024.texaslinuxfest.org/' },
  // "A co-located gathering in 2024", in the 2025 transparency report's foreword.
  report2025Url: 'https://www.cncf.io/reports/kcd-texas-2025/',
  eventPageUrl,
  scheduleUrl: sources2024.schedule,
  tlfKcdUrl: sources2024.tlfKcd,
  talksUrl: sources2024.playlist,

  // Counts from the KCD Texas 2024 Schedule; Texas Linux Fest's KCD page says "two tracks".
  speakers: new Set(sessions2024.flatMap((s) => s.speakers.map((p) => p.name))).size,
  tracks: 2,
  keynotes: sessions2024.filter((s) => s.format === 'keynote').length,
  workshops: sessions2024.filter((s) => s.format === 'workshop').length,
  recordings: sessions2024.filter((s) => s.youtube).length,

  // The sponsors on the 2024 Event Page, by tier (checked 2026-10-10). Texas Linux Fest's own sponsor page lists
  // more companies in the tiers whose packages included KCD Texas, so this list may be incomplete.
  sponsorsSource: eventPageUrl,
  tiers: [
    { key: 'diamond', name: 'Diamond', size: 'platinum', sponsors: [
      { id: 'scinary', name: 'Scinary', logo: false },
    ] },
    { key: 'platinum', name: 'Platinum', size: 'platinum', sponsors: [
      { id: 'loft', name: 'Loft', logo: false },
    ] },
    { key: 'gold', name: 'Gold', size: 'gold', sponsors: [
      { id: 'elastic', name: 'Elastic', logo: true },
      { id: 'redhat', name: 'Red Hat', logo: true },
      { id: 'rockylinux', name: 'Rocky Linux', logo: true },
      { id: 'rezoomex', name: 'rezoomex', logo: false },
    ] },
    { key: 'silver', name: 'Silver', size: 'silver', sponsors: [
      { id: 'sva', name: 'SVA Software', logo: false },
    ] },
    { key: 'special', name: 'Special', size: 'silver', sponsors: [
      { id: 'civo', name: 'Civo', logo: true },
    ] },
  ] satisfies readonly PastTier[],
  partnerGroups: [
    { type: 'Partners', names: ['Cuemby', 'KCD DC', 'KUBE Events', 'Sticker Mule', 'Austin Women in Technology'] },
    { type: 'Media partners', names: ['Jupiter Broadcasting'] },
  ],

  // The team on the Edition's CNCF application, opened in Feb 2023 for the canceled 2023 Edition and carried
  // to April 2024, under the names the site prints for 2026. The team that ran the day may differ.
  organizers: {
    names: ['Chad Crowell', 'Chris Aniszczyk', 'Jim Angel', 'Laura Santamaria', 'Mars Toktonaliev', 'Aly Ibrahim', 'Cristher Castro', 'Joaquin Rodriguez', 'Moeez Mustafa', 'Alvin Estrada', 'Rafael Brito'],
    // Each name's photo in src/assets/organizers/, from the 2026 Event Page. The others show initials: no headshot
    // was found for them. To add a photo, put the file there and the name's line here.
    photos: {
      'Chad Crowell': 'chad-crowell', 'Mars Toktonaliev': 'mars-toktonaliev', 'Cristher Castro': 'cristher-castro',
      'Rafael Brito': 'rafael-brito',
    } as Readonly<Record<string, string>>,
    source: 'https://github.com/cncf/kubernetes-community-days/issues/466',
  },
} as const;
