// The 2026 Edition, a Past Edition. Every figure needs a public source (CLAUDE.md):
// numbers from the CNCF transparency report, names and affiliations as printed on the Event Page.

export const edition2026 = {
  year: 2026,
  city: 'Austin',
  date: 'May 15, 2026',
  reportUrl: 'https://www.cncf.io/reports/kcd-texas-2026/',
  report2025Url: 'https://www.cncf.io/reports/kcd-texas-2025/',
  eventPageUrl: 'https://community2.cncf.io/events/details/cncf-kcd-texas-presents-kcd-texas-2026/',
  talksUrl: 'https://www.youtube.com/playlist?list=PL4UW_RgvzVcgZfg1SBz6_J6L8jchHvoX7',
  recapUrl: 'https://www.youtube.com/watch?v=yg6AS9W7bzE',
  photosUrl: 'https://photos.kcdtexas.org/',
  // The raw file, 23 MB. A compressed copy on kcdtexas.org replaces it later.
  prospectusPdf: { url: 'https://github.com/kcdtexas/sponsor-prospectus/raw/main/KCD-TEXAS-2026-Sponsorship-Prospectus.pdf', size: '23 MB' },

  // Verified: the transparency report counts check-ins, not Registrations.
  checkedIn: 207,
  speakers: 27,
  hosts: 3,
  sponsorCount: 14,
  recordings: 18,
  // 2025 Edition, from the 2025 transparency report.
  proposals2025: '200+',

  // 2026 pre-registration survey: describes the people who answered it.
  survey: [
    { value: '79%', label: 'came from Texas' },
    { value: '70%', label: 'were at their first KCD Texas' },
    { about: true, value: '7 in 10', label: 'were DevOps, SRE and sysadmin staff, developers or architects' },
    { about: true, value: '1 in 4', label: 'worked at an End-User company, one that runs Kubernetes rather than sells it' },
  ],

  sponsors: {
    platinum: [
      { id: 'solo', name: 'Solo.io' },
      { id: 'vcluster', name: 'vCluster' },
      { id: 'wso2', name: 'WSO2' },
    ],
    gold: [
      { id: 'chainguard', name: 'Chainguard' },
      { id: 'cloudbolt', name: 'CloudBolt' },
      { id: 'diagrid', name: 'Diagrid' },
      { id: 'elastic', name: 'Elastic' },
      { id: 'grafana', name: 'Grafana Labs' },
      { id: 'isovalent', name: 'Isovalent' },
      { id: 'plural', name: 'Plural' },
      { id: 'teleport', name: 'Teleport' },
    ],
    silver: [
      { id: 'akamai', name: 'Akamai' },
      { id: 'komodor', name: 'Komodor' },
      { id: 'synadia', name: 'Synadia' },
    ],
  },
  partners: 'Partners: Cuemby, KubeSkills. Community partners: Austin Women in Technology, Merge Forward. Media partners: Software Guru, KUBE Events, Clowder Space.',

  keynotes: [
    { photo: 'katie', time: '9:28 a.m.', name: 'Katie Gamanji', affiliation: 'CNCF, TOC Member', talk: 'The State of Cloud Native: The Shift Towards AI', youtube: 'Z2hOG3K0gis',
      alt: 'Katie Gamanji speaks on stage at KCD Texas 2026, holding a microphone in front of a slide with a rising chart.' },
    { photo: 'bryce', time: '9:59 a.m.', name: 'Jonathan Bryce', affiliation: 'Cloud Native Computing Foundation (CNCF), Executive Director', talk: 'Open Source Infrastructure for the AI Native Era', youtube: 'bTjnWq2zCkw',
      alt: 'Jonathan Bryce smiles on stage at KCD Texas 2026, microphone in hand, wearing a blue KCD Texas shirt.' },
    { photo: 'ian', time: '10:14 a.m.', name: 'Ian Coldwater', affiliation: 'Kubernetes SIG Security Chair', talk: 'Spoke to a full room', youtube: null,
      alt: 'Ian Coldwater speaks into a microphone on stage at KCD Texas 2026, seen in profile.' },
  ],

  // "More 2026 talks, practitioners first"
  talks: [
    { face: 'abhinav-dahiya', name: 'Abhinav Dahiya', affiliation: 'Lyft', title: 'We Migrated to Karpenter and Our Costs Went Up: A Journey to Real Savings', youtube: 'UdpviRNrnj8' },
    { face: 'tyler-auerbeck', name: 'Tyler Auerbeck', affiliation: 'Stack AV', title: 'Self-Service, Multi-Tenant Infrastructure With Kured and Flatcar Linux', youtube: 'WoI83_KQtWM' },
    { face: 'shravani-gunturu', name: 'Shravani Gunturu', affiliation: 'SoFi (Galileo)', title: 'Hybrid Cloud at Enterprise Scale: Private Kubernetes for Portability and Control', youtube: 'RQUGlPV0DOg' },
    { face: 'cesar-diaz', name: 'Cesar Diaz', affiliation: 'Globant', title: 'Kubernetes at the Edge: Declaring the Indeterminable with Nix and K3s', youtube: 'w-H7a4UFHvU' },
    { face: 'julia-furst-morgado', name: 'Julia Furst Morgado', affiliation: 'Dash0', title: 'Mastering the Dark Arts of OTel Debugging', youtube: 'nUqS3YcmloI' },
    { face: 'engin-diri', name: 'Engin Diri', affiliation: 'Pulumi', title: 'Stop Wasting GPUs: How We Built a Golden Path for GPU Sharing on Kubernetes', youtube: 'JA1wtMhhQCE' },
    { face: 'andrew-martin', name: 'Andrew Martin', affiliation: 'ControlPlane', title: 'Sandbox Breakouts: Rapid Unscheduled Agentic Assembly', youtube: 'mxU9pci8v5E' },
    { face: 'whitney-lee', name: 'Whitney Lee', affiliation: 'Datadog', title: 'Livin’ In the Future: Your Platform’s Next Interface Is an AI Agent', youtube: 'dtVy1lD6KiQ' },
  ],

  // The 2026 bill: every Speaker by surname, then the hosts (the Event Page's program).
  // The fitted-row classes (w desktop, m tablet, n phone) match the widths in src/styles/components/bill26.css.
  bill: {
    keynotes: ['Katie Gamanji', 'Jonathan Bryce', 'Ian Coldwater'],
    speakers: [
      ['Eric Anderson', 'w1 m1', 'n1'], ['Tyler Auerbeck', 'w1 m1', 'n1'], ['Graziano Casto', 'w1 m1', 'n1 ne'],
      ['Duffie Cooley', 'w1 m1 me', 'n2'], ['Abhinav Dahiya', 'w1 m2 we', 'n2'], ['Chris De La Garza', 'w2 m2', 'n2 ne'],
      ['Cesar Diaz', 'w2 m2', 'n3'], ['Engin Diri', 'w2 m2', 'n3'], ['Lucas Duarte', 'w2 m2 me', 'n3 ne'],
      ['Michael Forrester', 'w2 m3 we', 'n4'], ['Julia Furst Morgado', 'w3 m3', 'n4 ne'], ['Shravani Gunturu', 'w3 m3 me', 'n5'],
      ['Kedar Kulkarni', 'w3 m4', 'n5 ne'], ['Jooho Lee', 'w3 m4 we', 'n6'], ['Whitney Lee', 'w4 m4', 'n6'],
      ['Andrew Martin', 'w4 m4 me', 'n6 ne'], ['Jairo Martinez Mantilla', 'w4 m5', 'n7'], ['Myroslav Mishov', 'w4 m5 we', 'n7 ne'],
      ['Marina Moore', 'w5 m5 me', 'n8'], ['Peter O’Neill', 'w5 m6', 'n8'], ['Angel Ramirez', 'w5 m6', 'n8 ne'],
      ['Dolis Sharma', 'w5 m6', 'n9'], ['Lin Sun', 'w5 m6', 'n9'], ['Goutam Tadi', 'w5 m6 we me', 'n9 ne'],
    ] as [string, string, string][],
    hosts: ['Lisa-Marie Namphy', 'Hanna Busekrus', 'Nicole Pletka'],
  },

  organizers: [
    'Richard Boyd II', 'Harsha Thirimanna', 'Eddie Wassef', 'Mara Ruvalcaba', 'Cristobal Nevares', 'Srihari Nagaram', 'Jamie Prince',
    'Chad Crowell', 'Mars Toktonaliev', 'Rafael Brito', 'Cristher Castro', 'Vishwa Gandhi', 'Joel Hernandez',
  ],
} as const;

export const youtube = (id: string) => `https://www.youtube.com/watch?v=${id}`;

// Context figure, not a KCD figure: US Census Bureau, Vintage 2025 metro estimates.
export const dallasMetro = {
  text: 'KCD Texas 2027 moves to Dallas–Fort Worth, home to about 8.5 million people: the largest metro area in Texas and the fourth-largest in the US.',
  source: 'Census Bureau estimate for July 1, 2025; residents, not attendees.',
  sourceLong: 'US Census Bureau, metro area estimates for July 1, 2025',
};

// OpenStreetMap routing to downtown Dallas, checked 2026-10-03 (method in the private research notes).
export const drives = {
  rows: [
    { from: 'Austin', distance: '195 mi', time: 'about 3.5 h' },
    { from: 'Houston', distance: '240 mi', time: 'about 4 h' },
    { from: 'San Antonio', distance: '275 mi', time: 'about 5 h' },
  ],
  local: 'In Dallas–Fort Worth? No flight, no hotel.',
  source: 'To downtown Dallas without traffic (OpenStreetMap).',
};

export const pastEditions = [
  { year: 2026, label: 'Austin', href: '#last-year' },
  { year: 2025, label: 'Austin' },
  { year: 2024, label: 'Austin, with Texas Linux Fest' },
];
