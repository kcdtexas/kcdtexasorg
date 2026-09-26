# Project brief: the KCD Texas website

kcdtexas.org is the official, permanent home of KCD Texas, the community-run Kubernetes Community Day for Texas. It presents the Current Edition (2027 in Dallas, April 2027) and keeps every Past Edition as a record. See `CONTEXT.md` for the vocabulary and `docs/adr/` for the decisions behind this brief.

## Goals, in order

1. **Complete.** Every attendee, speaker and sponsor question is answered on our own domain. The CNCF Event Page is used only for registration and checkout.
2. **Distinctive.** A custom identity with real Texas personality (our own photos, the KCD Texas badge) inside a clean, CNCF-aligned frame.
3. **Handover-proof.** Any Organizer can update content without a developer, and next year's team inherits a working site with docs.

A baseline applies to all three: fast, accessible (aiming at WCAG 2.2 AA), open source, and changed only through reviewed pull requests.

## Who it serves

- **Phases** set whom the homepage serves first:
  - **CFP Phase:** Sponsors, then prospective Speakers.
  - **Countdown:** Attendees.
  - **Event Day:** Attendees on site.
  - **Recap:** next year's Sponsors, then past attendees.
- **Growth focus:** Texas End Users (platform and SRE teams at companies that run cloud native rather than sell it), then Returning Attendees.

## What the site includes

- **Core:**
  - A phase-aware homepage.
  - CFP guide, and sponsor pitch with audience data from CNCF transparency reports.
  - About (the Organizers and Committees), Code of Conduct, accessibility and privacy pages.
  - Tickets and travel.
  - Past Editions.
  - Short Links that keep working across years.
- **Program**, from Sessionize:
  - Schedule with filters, Session and Speaker pages.
  - An End-User Story badge.
  - My Schedule, kept in the visitor's browser, with a calendar feed.
  - Event Day mode (now/next, map, announcements, offline).
- **Extras**, each behind an on/off switch:
  - First-time speaker support and a "Convince your manager" kit.
  - A travel guide by starting city, and a volunteer page.
  - KCD Texas in numbers.
  - An End-User Stories collection.
  - Speaker and sponsor kits with share cards.
  - Site search and open data (schedule as YAML, JSON and iCal).
  - Optional sponsor profiles.
- **Not included:**
  - User accounts, comments or chat.
  - A native app.
  - Ticket sales on our domain.
  - A live-stream platform.
  - A job board or attendee matchmaking.

## How it's run

- **Content lives in this repository.** Organizers edit through a git-based editor, and every change arrives as a pull request with a preview. The owning Committee approves it.
- **Pushing is announcing** (ADR 0009). Only facts the Organizers have announced go into git. The program appears only after the Organizers flip the `speakersPublic` and `schedulePublic` gates.
- **The site collects no personal data** (ADR 0007). Analytics is cookie-free and can be switched off.
- **Hosting:** Netlify, deploying only when something meaningful changes (ADR 0010).
- **Built with** Astro and TypeScript (ADR 0005).
- **Built with AI assistance.** Organizers review all content.
