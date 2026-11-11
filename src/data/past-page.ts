// The words and data of an earlier Edition's page (page-2025.ts, page-2024.ts), as PastEdition.astro lays them out:
// the 2026 page's sections in the same order, each one only when the Edition has something for it.
import type { PastTier } from './edition-2025';
import type { PastSession, PastSpeaker } from './past-program';

export interface Link { text: string; href: string }
export interface LogoCredit { title: string; author: string; source: Link; license: Link }
/** A photo: its file name in src/assets/ (the folder depends on its use), and its alt text. */
export interface Photo { file: string; alt: string }
/** One of the three timed photos of a day at an Edition (DayPhotos.astro): its file in src/assets/photos/, the time
 *  it was taken (Central), its caption and its alt text. */
export interface DayPhoto { id: string; time: string; caption: string; alt: string }

export interface PastPage {
  year: 2024 | 2025;
  title: string;
  description: string;
  kicker: string;
  heading: string;
  lead: string;
  facts: readonly { term: string; text: string }[];
  factsSources: readonly Link[];
  /** A day at the Edition in three timed photos, after the figures, with their credit (the photographer's, or the
   *  team's). `widths`: the sizes each photo is offered in, never wider than its file. */
  day?: { title: string; photos: readonly DayPhoto[]; credit: string; widths: number[] };
  /** `photos`: a stage photo of each keynote's Speaker, by name, from src/assets/keynotes/, and `photoCredit` names
   *  the photographer. The keynotes show photos, as on /2026/, only when every one has a photo. */
  keynotes: { title: string; sessions: readonly PastSession[]; noRecording: string; photos?: Readonly<Record<string, Photo>>; photoCredit?: string };
  program: {
    title: string;
    intro: string;
    recordedTitle: string;
    recorded: readonly PastSession[];
    otherTitle: string;
    otherNote: string;
    others: readonly PastSession[];
    hostsTitle: string;
    hosts: readonly PastSpeaker[];
    asPrinted: string;
    sources: readonly Link[];
    watch: string;
    more: readonly Link[];
  };
  sponsors: {
    title: string;
    tiers: readonly PastTier[];
    note: string;
    source: Link;
    /** The attribution a logo's license asks for, shown under the wall: title, author, source and license. */
    logoCredits?: readonly LogoCredit[];
    partnersTitle: string;
    partnerGroups: readonly { type: string; names: readonly string[] }[];
  };
  /** `photos`: each name's file in src/assets/organizers/; a name with none shows initials. `group`: the team's
   *  photo above the cards, from src/assets/photos/, with its caption and the photographer's credit. */
  organizers: {
    title: string; names: readonly string[]; photos: Readonly<Record<string, string>>; note: string; source: Link;
    group?: Photo & { caption: string; credit: string };
  };
  lookBack: { title: string; links: readonly (Link & { note: string })[] };
}

/** The Sessions that aren't keynotes, recorded ones first, each group in program order. */
export const splitProgram = (sessions: readonly PastSession[]) => {
  const rest = sessions.filter((s) => s.format !== 'keynote');
  return { recorded: rest.filter((s) => s.youtube), others: rest.filter((s) => !s.youtube) };
};
