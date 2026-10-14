// The program's small fake set, for tests and design reviews: made-up Sessions and Speakers ("Fixture Speaker 1"),
// in the raw shape a program platform hands over, extra fields included. src/lib/program.ts reads it only in a
// test build with --program-sample, next to the made-up sample Schedule (program-sample-schedule.ts).
//
// The planted marker (ADR 0009) sits in fields the allowlist drops: a Speaker's private notes and a Session's
// review notes. scripts/check-dist.mjs fails any build whose served files contain it, and the tests also check
// the logs and the sitemap. Every name is made up. Fixture Speaker 4 also appears in a made-up earlier Edition
// (fixtureEarlierSpeakers), which only --program-sample builds read, so the Returning Speaker credit gets tested.
import type { RawSession, RawSpeaker } from '../lib/program';

export const plantedMarker = 'kcd-planted-marker-q7x4v2';

// The fixture's own room, so its Sessions never overlap the sample Schedule's.
const room = 'Fixture Room';
const day = '2027-04-23';

export const fixtureSpeakers: readonly RawSpeaker[] = [
  { id: 'fx-1', name: 'Fixture Speaker 1', tagline: 'Platform Engineer, Fixture Company', bio: 'Fixture Speaker 1 is made up for tests. A real bio goes here, as the Speaker wrote it.', links: [{ kind: 'site', url: 'https://example.com/' }, { kind: 'tracker', url: 'https://example.com/track' }], email: 'speaker1@example.com', notes: plantedMarker },
  { id: 'fx-2', name: 'Fixture Speaker 2', tagline: 'Site Reliability Engineer', phone: '+1 555 0100', notes: plantedMarker },
  { id: 'fx-3', name: 'Fixture Speaker 3', tagline: null, notes: plantedMarker },
  // A Returning Speaker in the test history: shows "Speaker since 2026".
  { id: 'fx-4', name: 'Fixture Speaker 4', tagline: 'Developer Advocate, Fixture Company', notes: plantedMarker },
];

export const fixtureSessions: readonly RawSession[] = [
  { id: 'fx-s1', title: 'Fixture Session: How We Run Kubernetes for Our Own Business', abstract: 'A made-up abstract for tests. A real abstract goes here, as the Speaker wrote it, in one or two paragraphs.', format: 'talk', endUser: true, speakers: ['fx-1'], start: `${day}T10:00`, end: `${day}T10:30`, room, reviewNotes: plantedMarker, status: 'accepted' },
  { id: 'fx-s2', title: 'Fixture Session: A Returning Speaker’s Talk', format: 'talk', endUser: false, speakers: ['fx-4'], start: `${day}T11:00`, end: `${day}T11:30`, room, reviewNotes: plantedMarker, status: 'accepted' },
  { id: 'fx-s3', title: 'Fixture Session: A Hands-On Workshop', format: 'workshop', endUser: false, speakers: ['fx-2', 'fx-3'], start: `${day}T13:00`, end: `${day}T14:30`, room, reviewNotes: plantedMarker, status: 'accepted' },
  { id: 'fx-s4', title: 'Fixture Session: A Panel of Every Fixture Speaker', format: 'panel', endUser: true, speakers: ['fx-1', 'fx-2', 'fx-3', 'fx-4'], start: `${day}T15:00`, end: `${day}T15:45`, room, reviewNotes: plantedMarker, status: 'accepted' },
];

// The made-up earlier-Edition entry: Fixture Speaker 4 spoke in 2026. src/lib/loyalty.ts adds it to the 2026
// Speakers only in a --program-sample build; the 2026 page never reads it.
export const fixtureEarlierSpeakers = { year: 2026, names: ['Fixture Speaker 4'] } as const;
