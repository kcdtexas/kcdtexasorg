// The Event Day page's words (Core Event Committee): /2027/today/. Announcements are added by fast-track on Event
// Day (ADR 0008); the venue map and info come once the venue is announced.
import { asOfDay, edition2027, programDataSample } from './edition-2027';

const e = edition2027;

export interface Announcement {
  /** Central time, 'HH:MM'. */
  at: string;
  text: string;
}

// Announcements, newest last. Empty until Event Day.
const announced: Announcement[] = [];
// build.sh --program-sample: two made-up announcements, to see the page in tests and design reviews.
const sample: Announcement[] = [
  { at: '09:05', text: 'Sample announcement: the keynote room is full. The overflow room shows the keynotes live.' },
  { at: '12:40', text: 'Sample announcement: lunch runs 15 minutes late. Afternoon Sessions start on time.' },
];

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
  announcements: programDataSample ? sample : announced,
  noAnnouncements: 'No announcements yet.',
  mapTitle: 'Venue map',
  mapSoon: 'The venue map goes here once the venue is announced.',
  infoTitle: 'Good to know',
  info: [
    { term: 'Wi-Fi', text: 'Details come with the venue.' },
    { term: 'Food', text: 'Details come with the venue.' },
    { term: 'Help', text: 'Details come with the venue.' },
  ],
  conduct: 'Code of Conduct',
  conductText: 'Read the Code of Conduct and how to report a problem.',
  schedule: 'See the whole Schedule',
} as const;
