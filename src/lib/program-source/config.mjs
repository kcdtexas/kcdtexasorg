// The program platform settings, in one place, for src/lib/program.ts and the scripts.
//
// The Sessionize names are the ones the Call for Speakers and the API endpoint use. Change a name here when the
// Session Committee names a category or a question differently.
export const sessionize = {
  /** The API v2 base. Only tests point it elsewhere (KCD_PROGRAM_TEST_BASE, src/lib/program-source/remote.mjs). */
  base: 'https://sessionize.com/api/v2',
  /** The category whose item names the Session's format. */
  formatCategory: 'Session format',
  /** A category of this name (any item but a "no"), an item of this name in any category, or a question of this
   *  name answered yes, marks an End-User Story. */
  endUserCategory: 'End-User Story',
  endUserQuestion: 'End-User Story',
};

/** Format names as a platform writes them (lowercased), to the site's formats. */
export const formatNames = {
  keynote: 'keynote',
  talk: 'talk',
  session: 'talk',
  'lightning talk': 'talk',
  workshop: 'workshop',
  'hands-on workshop': 'workshop',
  panel: 'panel',
  'panel discussion': 'panel',
};

/** Answers and category items that mean yes or no. */
export const yes = ['yes', 'y', 'true', '1', 'on', 'x', 'checked'];
export const no = ['no', 'n', 'false', '0', 'off', 'none', ''];

/** Speaker photos: the two sizes the pages use, square, as WebP. */
export const photoSizes = { small: 160, large: 400 };
export const photoQuality = 72;
