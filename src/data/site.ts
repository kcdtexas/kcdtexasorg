// Facts shown on the site. Every number needs a public source (see CLAUDE.md).

export const contact = {
  email: 'organizers@kcdtexas.org',
  chapterUrl: 'https://community2.cncf.io/kcd-texas/',
  communityUrl: 'https://cloudnativetexas.com',
  githubUrl: 'https://github.com/kcdtexas',
  social: [
    { label: 'X', handle: '@KCDTexas', url: 'https://x.com/KCDTexas' },
    { label: 'LinkedIn', handle: 'KCD Texas', url: 'https://www.linkedin.com/company/kcdtexas/' },
    { label: 'Instagram', handle: '@TexasKCD', url: 'https://www.instagram.com/texaskcd/' },
  ],
} as const;

export const currentEdition = {
  year: 2027,
  city: 'Dallas',
  when: 'April 2027',
} as const;

export const legal = {
  codeOfConductUrl: 'https://www.cncf.io/conduct/',
  lfTrademarksUrl: 'https://www.linuxfoundation.org/legal/trademark-usage',
} as const;

// Source: KCD Texas 2026 transparency report (CNCF), published June 2026.
export const edition2026 = {
  reportUrl: 'https://www.cncf.io/reports/kcd-texas-2026/',
  talksUrl: 'https://www.youtube.com/playlist?list=PL4UW_RgvzVcgZfg1SBz6_J6L8jchHvoX7',
  photosUrl: 'https://photos.kcdtexas.org/',
  stats: [
    { value: '207', label: 'attendees checked in' },
    { value: '27', label: 'speakers' },
    { value: '3', label: 'hands-on workshops' },
    { value: '14', label: 'sponsors' },
  ],
  // Pre-registration survey respondents, same report.
  audience: [
    { value: '26%', label: 'DevOps, SRE and sysadmins' },
    { value: '23%', label: 'developers' },
    { value: '20%', label: 'architects' },
    { value: '79%', label: 'based in Texas' },
  ],
  sponsors: [
    'Solo.io', 'vCluster', 'WSO2',
    'Chainguard', 'CloudBolt', 'Diagrid', 'Elastic', 'Grafana Labs', 'Isovalent', 'Plural', 'Teleport',
    'Akamai', 'Komodor', 'Synadia',
  ],
} as const;
