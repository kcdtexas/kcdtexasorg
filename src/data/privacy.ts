// The privacy page's words (Maintainer). The analytics section follows the same setting as the
// footer's privacy line, so the page never says more or less than the site does (ADR 0007). The same goes for My
// Schedule and the offline copy: their lines show only while the program pages have them (the stars come with the
// Schedule). From the day after Event Day, when the offline worker deletes its copy and removes itself
// (src/scripts/sw.js), the offline line says so.
import { analytics, contact } from './site';
import { offlineCopy, program } from '../lib/program';

const analyticsText = {
  on: [
    'We count page views with Cloudflare Web Analytics. Cloudflare, our host, adds its script to each page; the script loads from static.cloudflareinsights.com, measures how fast the page loaded, and sends the count back to kcdtexas.org. It sets no cookies, stores nothing in your browser, and Cloudflare says it doesn’t collect or use visitors’ personal data.',
    'The counts tell us whether people find what they came for.',
  ],
  off: [
    'This website runs no analytics. If that changes, this section changes in the same update.',
  ],
} as const;

export const privacy = {
  title: 'Privacy',
  description: analytics.enabled
    ? 'kcdtexas.org sets no cookies and has no forms. It counts visits with Cloudflare’s cookie-free Web Analytics. This page lists what it stores in your browser, and what loads from elsewhere.'
    : 'kcdtexas.org sets no cookies, has no forms and loads nothing from other companies’ servers until you play a recording. This page lists what it stores in your browser, and when.',
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
        ...(program?.schedulePublic ? ['If you star a Session, your browser keeps My Schedule in its local storage, on this device only. It isn’t sent to us.'] : []),
        ...(offlineCopy
          ? ['When you open a program page, such as a Session or a Speaker’s page, your browser keeps a copy so it opens without a connection. The copy stays in your browser. After Event Day, your browser deletes it the next time you open a 2027 page.']
          : program
            ? ['Until Event Day, your browser kept a copy of the program pages you opened. It deletes the copy the next time you open a 2027 page.']
            : []),
      ],
    },
    {
      id: 'loads',
      title: 'What loads when you open a page',
      text: [
        analytics.enabled
          ? 'The pages, fonts, images and logos all come from kcdtexas.org. The one script from elsewhere is Cloudflare’s Web Analytics, from static.cloudflareinsights.com (see Analytics, below).'
          : 'The pages, fonts, images and logos all come from kcdtexas.org. Opening a page here loads nothing from other companies’ servers.',
        // The video player (public/watch.js): the one thing from another company's servers, and only on a click.
        'When you play a recording here, YouTube’s player loads from youtube-nocookie.com, and YouTube’s privacy policy applies to it. Nothing from YouTube loads before you choose a recording.',
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
