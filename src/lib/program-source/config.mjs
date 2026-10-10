// The program platform settings, in one place. src/lib/program.ts (the build) and scripts/program-check.mjs (the
// refresh workflow) both read them, so the published program version and the check's always agree.
//
// The Sessionize names are the ones the CFP and the API endpoint use (docs/program-csv.md has the CSV's). Change a
// name here when the Session Committee names a category or a question differently.
export const sessionize = {
  /** The API v2 base. Only tests point it elsewhere (KCD_PROGRAM_TEST_BASE, src/lib/program-source/remote.mjs). */
  base: 'https://sessionize.com/api/v2',
  /** Speaker photos come from this host or its subdomains (cdn.sessionize.com); a photo anywhere else is dropped. */
  photoHost: 'sessionize.com',
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

/** The program version the live site publishes, compared by scripts/program-check.mjs. */
export const liveVersionUrl = 'https://kcdtexas.org/2027/program-version.txt';
