// The program platform settings, in one place. src/lib/program.ts (the build) and scripts/program-check.mjs (the
// refresh workflow) both read them, so the published program version and the check's always agree.
//
// The program comes from Pretalx's public API, which needs no key (ADR 0014, docs/pretalx.md). The field names are
// the ones the 2027 call for proposals uses: change one here when the Session Committee renames a field.
// docs/program-csv.md has the CSV's format.
export const pretalx = {
  /** The API base. Only tests point it elsewhere (KCD_PROGRAM_TEST_BASE, src/lib/program-source/remote.mjs). */
  base: 'https://pretalx.com/api',
  /** The event's short form, as in its call for proposals, https://pretalx.com/kcd-texas-2027/cfp (src/data/cfp.ts). */
  event: 'kcd-texas-2027',
  /** Speaker photos come from this host or its subdomains, or from the event's custom domain when Pretalx names one; a
   *  photo anywhere else is dropped. */
  photoHost: 'pretalx.com',
  /** The public custom fields the site reads, by their label or identifier in Pretalx. Case, spaces and punctuation
   *  don't count, and "&" counts as "and". Each needs "Publish answers" turned on in Pretalx, and must stay active:
   *  Pretalx hides an inactive field's answers. */
  fields: {
    /** Yes/No, per proposal: marks an End-User Story. The build fails if no public field has one of these names. */
    endUser: ['End-User Story', 'Is this an End-User Story?'],
    /** Choose one, per proposal: the Session's Level, by its option (levelNames below). Without the field, no
     *  Session shows a Level. */
    level: ['Level'],
    /** Text, per speaker: the line under the Speaker's name. The build fails without it, like endUser. */
    tagline: ['Job title and company'],
    /** URL, per speaker: an address no other rule names (links.mjs) is the Speaker's website. */
    website: ['Website', 'Website or public profile, for example LinkedIn link'],
  },
  /** The most pages of 50 entries the reader follows in one list. */
  maxPages: 40,
};

/** Every request to a platform or a photo host names the site, and no email address. */
export const userAgent = 'kcdtexas.org program build (https://kcdtexas.org)';

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

/** Level names as a platform writes them (lowercased), to the site's levels: the 2027 call's options for its Level
 *  field are Beginner, Intermediate and Advanced. The allowlist (model.mjs) keeps only these, so a Session whose
 *  Level has another name shows none: add the name here. */
export const levelNames = {
  beginner: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced',
};

/** Answers that mean yes or no. */
export const yes = ['yes', 'y', 'true', '1', 'on', 'x', 'checked'];
export const no = ['no', 'n', 'false', '0', 'off', 'none', ''];

/** Speaker photos: the two sizes the pages use, square, as WebP. */
export const photoSizes = { small: 160, large: 400 };
export const photoQuality = 72;

/** The program version the live site publishes, compared by scripts/program-check.mjs. */
export const liveVersionUrl = 'https://kcdtexas.org/2027/program-version.txt';
