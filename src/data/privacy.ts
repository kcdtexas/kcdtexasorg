// The privacy page's words (Maintainer). The analytics section follows the same setting as the
// footer's privacy line, so the page never says more or less than the site does (ADR 0007). The same goes for My
// Schedule and the offline copy: their lines show only while the program pages have them.
import { analytics, contact } from './site';
import { offlineCopy, program } from '../lib/program';

const analyticsText = {
  on: [
    'We count page views, and clicks on the links to the call for proposals, the sponsor prospectus and tickets, with Umami, served from kcdtexas.org. It sets no cookies and doesn’t identify you.',
    'The counts tell us whether people find what they came for.',
  ],
  off: [
    'This website runs no analytics. If that changes, this section changes in the same update.',
  ],
} as const;

export const privacy = {
  title: 'Privacy',
  description: 'kcdtexas.org sets no cookies, has no forms and loads nothing from other companies’ servers. What it stores in your browser, and when.',
  kicker: 'This website',
  lead: program
    ? 'This website sets no cookies and has no forms. What it stores in your browser stays there.'
    : 'This website sets no cookies and has no forms. It stores one thing in your browser, and only if you choose it.',

  sections: [
    {
      id: 'stored',
      title: 'What this website stores',
      text: [
        'If you press the light or dark theme switch, your browser keeps that choice in its local storage, so the next page opens in the same theme. If you never press it, nothing is stored. If you switch back to your device’s own setting, the stored choice is removed.',
        'The choice stays in your browser. It isn’t sent to us.',
        ...(program ? ['If you star a Session for My Schedule, the list is kept only in this browser. It’s never sent to us.'] : []),
        ...(offlineCopy ? ['When you open the program or Event Day pages, your browser keeps a copy so they still open without a connection. The copy stays in your browser. It’s removed the next time you open a 2027 page after Event Day.'] : []),
      ],
    },
    {
      id: 'loads',
      title: 'What loads when you open a page',
      text: [
        'The pages, fonts, images and logos all come from kcdtexas.org. Opening a page here loads nothing from other companies’ servers.',
        'The 2026 recordings are plain links to YouTube. Nothing from YouTube loads on this website. When you follow one of those links, you are on YouTube, and YouTube’s privacy policy applies.',
      ],
    },
    {
      id: 'links',
      title: 'Links to other sites',
      text: [
        'Registration and the KCD Texas chapter are on the CNCF community site, the recordings are on YouTube, and the 2026 prospectus is on GitHub. Each of those sites has its own privacy policy.',
      ],
    },
    {
      id: 'host',
      title: 'Hosting',
      text: [
        'Our host serves these pages and keeps its usual request logs under its own privacy policy.',
      ],
    },
    {
      id: 'analytics',
      title: 'Analytics',
      text: analytics.enabled ? analyticsText.on : analyticsText.off,
    },
  ],

  questions: 'Questions about this page:',
  email: contact.email,
} as const;
