# The Website collects no personal data, and analytics is the one exception

The Website sets no cookies and has no forms on its own domain. Forms live on external services under Organizer-owned accounts. Images (including Sessionize headshots), fonts and video thumbnails are downloaded at build time and served from our own domain. YouTube loads only after a click, through our own facade that uses youtube-nocookie.

The one exception is cookie-free analytics (Umami). It sits behind a switch and is disclosed on the privacy page. It lets the Organizers count what the site is for: CFP submissions, sponsor inquiries and Register clicks.

## Considered Options

- **Forms on our own site** (for example Netlify Forms). Convenient, but personal data would sit in a hosting account that changes hands every year.
- **Standard YouTube and Google Maps embeds.** They set cookies, which means a consent banner, and they slow pages down.
- **No analytics at all.** The cleanest option, but the Organizers couldn't tell whether the site does its job.

## Consequences

- `lite-youtube-embed` is not used. On Safari and mobile it falls back to youtube.com, which sets cookies.
- EU guidance (EDPB Guidelines 2/2023) says even cookie-free tracking scripts may need consent. That's one reason analytics has an off switch.
- The privacy page has to say exactly this: the site stores nothing about you until you press play on a video or follow a link off the site.
