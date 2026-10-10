// The Event Day page's words (Core Event Committee): /2027/today/. Announcements come from
// src/data/announcements-2027.yaml, added by fast-track on Event Day (ADR 0008, docs/event-day.md); the venue map
// and the day's info come once the venue is announced.
import { asOfDay, edition2027, programDataSample } from './edition-2027';
import { parseAnnouncements } from '../lib/announcements.mjs';
import announcementsYaml from './announcements-2027.yaml?raw';

const e = edition2027;

export interface Announcement {
  /** Central time, 'YYYY-MM-DDTHH:MM'. */
  at: string;
  text: string;
  /** An https address, or null. */
  link: string | null;
}

// Announcements, oldest first; the build stops on a bad entry (src/lib/announcements.mjs).
const announced: Announcement[] = parseAnnouncements(announcementsYaml, e.eventDay);
// build.sh --program-sample: two made-up announcements, to see the page in tests and design reviews.
const sample: Announcement[] = [
  { at: `${e.eventDay}T09:05`, text: 'Sample announcement: the keynote room is full. The overflow room shows the keynotes live.', link: null },
  { at: `${e.eventDay}T12:40`, text: 'Sample announcement: lunch runs 15 minutes late. Afternoon Sessions start on time.', link: null },
];

// The day's info, once the venue is announced; null keeps the placeholder.
const venue: {
  /** The venue map: an image in src/assets/ and its alt text. */
  map: { image: ImageMetadata; alt: string } | null;
  wifi: { network: string; password: string | null } | null;
  /** Where and when food is served, in a sentence. */
  food: string | null;
  /** Where to find help, in a sentence. */
  help: string | null;
} = { map: null, wifi: null, food: null, help: null };
const soon = 'Details come with the venue.';

// The time of day the build describes, in Central time: build.sh --clock HH:MM in test builds, else now.
const clockOverride = import.meta.env?.KCD_BUILD_CLOCK as string | undefined;
const clockNow = clockOverride ?? new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
/** The build's moment, Central local time, 'YYYY-MM-DDTHH:MM'. */
export const builtAt = `${asOfDay}T${clockNow}`;

export const today = {
  title: `Today at KCD Texas ${e.year}`,
  description: `What's on now and next at KCD Texas ${e.year} in ${e.city}, room by room, with the day's announcements.`,
  kicker: 'Event Day',
  updated: 'Updated',
  zone: 'CT',
  live: 'The page checks the time every minute and reloads every 5 minutes.',
  nowNext: 'Now and next',
  now: 'Now',
  next: 'Next',
  nothingNow: 'Nothing on right now.',
  nothingNext: 'Nothing more today in this room.',
  announcementsTitle: 'Announcements',
  /** Only those posted at or before the build's moment, newest last. */
  announcements: [...(programDataSample ? sample : []), ...announced].filter((a) => a.at <= builtAt).sort((a, b) => a.at.localeCompare(b.at)),
  noAnnouncements: 'No announcements yet.',
  mapTitle: 'Venue map',
  mapSoon: 'The venue map goes here once the venue is announced.',
  map: venue.map,
  infoTitle: 'Good to know',
  info: [
    { term: 'Wi-Fi', text: venue.wifi ? `Network: ${venue.wifi.network}.${venue.wifi.password ? ` Password: ${venue.wifi.password}.` : ''}` : soon },
    { term: 'Food', text: venue.food ?? soon },
    { term: 'Help', text: venue.help ?? soon },
  ],
  link: 'Details',
  conduct: 'Code of Conduct',
  conductText: 'Read the Code of Conduct and how to report a problem.',
  schedule: 'See the whole Schedule',
} as const;
