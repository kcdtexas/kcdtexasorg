// The 2025 Edition, a Past Edition. Every figure and list carries its public source (CLAUDE.md): the counts from the
// CNCF transparency report, the sponsors and Partners as shown on the 2025 Event Page, the Organizers from the
// Edition's CNCF application. The program is in program-2025.ts.
import { sessions2025, sources2025 } from './program-2025';

const reportUrl = 'https://www.cncf.io/reports/kcd-texas-2025/';
const eventPageUrl = sources2025.eventPage;

export interface PastSponsor {
  /** The stable id: the logo's file name in src/assets/logos, and a returning sponsor's 2026 id. */
  id: string;
  name: string;
  /** False when no official logo file was reachable: the wall shows the name as a text tile. */
  logo: boolean;
  /** Set when this sponsor's source differs from the tier list's. */
  source?: string;
}

export interface PastTier {
  key: string;
  name: string;
  /** The wall's tile size for this tier. */
  size: 'platinum' | 'gold' | 'silver';
  sponsors: readonly PastSponsor[];
}

export const edition2025 = {
  year: 2025,
  city: 'Austin',
  date: 'May 15, 2025',
  venue: 'Austin Central Library',
  // "Our first-ever independent KCD Texas in 2025", in the report's foreword.
  firstIndependent: true,
  reportUrl,
  eventPageUrl,
  scheduleUrl: sources2025.schedule,
  talksUrl: sources2025.playlist,
  recapUrl: 'https://www.youtube.com/watch?v=S0WTc-pzuoI',

  // Counts from the report (page 3: Speakers and stages; page 14: proposals; the foreword names the keynotes).
  // Attendance and the survey stay off the site (the Organizers, 2026-10-08).
  speakers: 29,
  stages: 3,
  proposals: '200+',
  keynotes: sessions2025.filter((s) => s.format === 'keynote').length,
  workshops: sessions2025.filter((s) => s.format === 'workshop').length,
  recordings: sessions2025.filter((s) => s.youtube).length,

  // The sponsor wall of the 2025 Event Page, by tier (checked 2026-10-10). The report's sponsor pages show the
  // same tiers without Teleport and ControlTheory; Teleport is also named in the Gold sponsors' callout video.
  sponsorsSource: eventPageUrl,
  tiers: [
    { key: 'platinum', name: 'Platinum', size: 'platinum', sponsors: [
      { id: 'wso2', name: 'WSO2', logo: true },
      { id: 'dynatrace', name: 'Dynatrace', logo: true },
    ] },
    { key: 'gold', name: 'Gold', size: 'gold', sponsors: [
      { id: 'nirmata', name: 'Nirmata', logo: true },
      { id: 'cockroachlabs', name: 'Cockroach Labs', logo: true },
      { id: 'akamai', name: 'Akamai', logo: true },
      { id: 'komodor', name: 'Komodor', logo: true },
      { id: 'tigera', name: 'Tigera', logo: true },
      { id: 'castai', name: 'CAST AI', logo: true },
      { id: 'teleport', name: 'Teleport', logo: true },
    ] },
    { key: 'silver', name: 'Silver', size: 'silver', sponsors: [
      { id: 'appscode', name: 'AppsCode', logo: true },
      { id: 'doppler', name: 'Doppler', logo: false },
      { id: 'diagrid', name: 'Diagrid', logo: true },
      { id: 'controltheory', name: 'ControlTheory', logo: true },
      { id: 'synapto', name: 'Synapto', logo: false },
      { id: 'stormforge', name: 'StormForge', logo: true },
      { id: 'kubecost', name: 'IBM Kubecost', logo: true },
    ] },
    { key: 'bronze', name: 'Bronze', size: 'silver', sponsors: [
      { id: 'nats', name: 'NATS', logo: true },
    ] },
  ] satisfies readonly PastTier[],
  // The Partners on the 2025 Event Page.
  partnerGroups: [
    { type: 'Partners', names: ['Cuemby', 'KUBE Events', 'Linux Foundation Training'] },
  ],

  // The team on the Edition's CNCF application (Oct 2024), under the names the site prints for 2026. The
  // application is the team as it applied, so it may miss someone who joined later.
  organizers: {
    names: ['Chad Crowell', 'Eddie Wassef', 'Harsha Thirimanna', 'Rafael Brito', 'Mark Lavi', 'Jamie Prince', 'Mars Toktonaliev', 'Cristher Castro', 'Mara Ruvalcaba', 'Richard Boyd II'],
    source: 'https://github.com/cncf/kubernetes-community-days/issues/587',
  },
} as const;
