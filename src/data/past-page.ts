// The words and data of an earlier Edition's page (page-2025.ts, page-2024.ts), as PastEdition.astro lays them out:
// the 2026 page's sections in the same order, each one only when the Edition has something for it.
import type { PastTier } from './edition-2025';
import type { PastSession, PastSpeaker } from './past-program';

export interface Link { text: string; href: string }
export interface LogoCredit { title: string; author: string; source: Link; license: Link }

export interface PastPage {
  year: 2024 | 2025;
  title: string;
  description: string;
  kicker: string;
  heading: string;
  lead: string;
  facts: readonly { term: string; text: string }[];
  factsSources: readonly Link[];
  keynotes: { title: string; sessions: readonly PastSession[]; noRecording: string };
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
  /** `photos`: each name's file in src/assets/organizers/; a name with none shows initials. */
  organizers: { title: string; names: readonly string[]; photos: Readonly<Record<string, string>>; note: string; source: Link };
  lookBack: { title: string; links: readonly (Link & { note: string })[] };
}

/** The Sessions that aren't keynotes, recorded ones first, each group in program order. */
export const splitProgram = (sessions: readonly PastSession[]) => {
  const rest = sessions.filter((s) => s.format !== 'keynote');
  return { recorded: rest.filter((s) => s.youtube), others: rest.filter((s) => !s.youtube) };
};
