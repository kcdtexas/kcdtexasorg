// Returning Speakers (CONTEXT.md) whose name differs between Editions. src/lib/loyalty.ts matches a Speaker by
// name against the public programs of earlier Editions; this list confirms a variant, so a guess never prints.
// Add a person only once they're known to be the same Speaker.

export interface SameSpeaker {
  /** The name in this Edition's program. */
  name: string;
  /** The same person's name in an earlier Edition's public program. */
  earlier: readonly string[];
}

export const returningSpeakers: readonly SameSpeaker[] = [];
