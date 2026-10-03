// The Code of Conduct page's words (Core Event Committee). CNCF owns the Code of Conduct's text:
// this page links it and never restates its rules.

export const conduct = {
  title: 'Code of Conduct',
  description: 'KCD Texas follows the CNCF Code of Conduct. How to report a problem at the event or by email.',
  kicker: 'KCD Texas',
  lead: 'KCD Texas follows the CNCF Code of Conduct, and everyone at the event agrees to it.',
  read: 'Read the CNCF Code of Conduct',
  readNote: 'CNCF keeps the text on its own site.',

  report: {
    title: 'Report a problem',
    danger: 'If you’re in danger, call 911 first.',
    atEvent: 'At the event',
    atEventSoon: 'The people who take reports at the event are named here before Event Day.',
    byEmail: 'By email',
    toCncf: 'To CNCF directly',
  },
  // The incident contacts at the event. Empty until the Core Event Committee names them;
  // while empty, the page shows the "soon" line above. Never fill this without their OK.
  contacts: [] as { name: string; how: string }[],
};
