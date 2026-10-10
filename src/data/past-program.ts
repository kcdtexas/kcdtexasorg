// The shape of a Past Edition's public program (program-2025.ts, program-2024.ts): Session titles, Speaker names
// and affiliations as printed, times (Central), rooms, formats and the YouTube video IDs of the recordings.
// No bios, abstracts or photos.

export type PastFormat = 'keynote' | 'talk' | 'workshop' | 'lightning';

export interface PastSpeaker {
  name: string;
  /** The affiliation lines as printed; empty when the source printed none. */
  printed: readonly string[];
}

export interface PastSession {
  title: string;
  speakers: readonly PastSpeaker[];
  /** Central local time, 'YYYY-MM-DDTHH:MM'. */
  start: string;
  end: string;
  room: string;
  format: PastFormat;
  /** The recording's YouTube video ID, or null when none is published. */
  youtube: string | null;
}

/** Every Speaker once, in program order. */
export const speakersOf = (sessions: readonly PastSession[]): PastSpeaker[] => {
  const seen = new Map<string, PastSpeaker>();
  for (const s of sessions) for (const p of s.speakers) if (!seen.has(p.name)) seen.set(p.name, p);
  return [...seen.values()];
};

/** The printed lines on one line. */
export const printedLine = (p: PastSpeaker) => p.printed.join(' · ');
