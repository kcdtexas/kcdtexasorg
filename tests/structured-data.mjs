// The schema check for the home page's JSON-LD (src/lib/structured-data.ts): the fields search engines
// need are there, the dates and place match the Edition file, and nothing unannounced is (no venue, and an
// offer only with the ticket link, never a price). tests/smoke.mjs runs it on the home page.
import { readFileSync } from 'node:fs';
import { importTs } from '../scripts/lib/import-ts.mjs';

const { edition2027 } = await importTs(new URL('../src/data/edition-2027.ts', import.meta.url));

// site.ts needs Astro to load, so the social links are read from its text: the social: [...] list.
const socialBlock = readFileSync(new URL('../src/data/site.ts', import.meta.url), 'utf8').match(/social: \[([\s\S]*?)\]/)?.[1] ?? '';
const socialUrls = [...socialBlock.matchAll(/url: '([^']+)'/g)].map((m) => m[1]);

/** Returns a list of problems with the JSON-LD in a page's HTML; empty when it passes. */
export function checkJsonLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (blocks.length !== 1) return [`expected one JSON-LD block, found ${blocks.length}`];
  let data;
  try { data = JSON.parse(blocks[0][1]); } catch (err) { return [`the JSON-LD is not valid JSON: ${err.message}`]; }
  const problems = [];
  const need = (ok, message) => { if (!ok) problems.push(message); };
  const graph = data['@graph'] ?? [];
  need(data['@context'] === 'https://schema.org', '@context is not https://schema.org');
  const event = graph.find((n) => n['@type'] === 'Event');
  const org = graph.find((n) => n['@type'] === 'Organization');
  need(event, 'no Event');
  need(org, 'no Organization');
  if (event) {
    for (const key of ['name', 'startDate', 'eventStatus', 'eventAttendanceMode', 'location', 'organizer', 'image', 'url', 'description']) need(event[key], `Event has no ${key}`);
    need(event.name === `KCD Texas ${edition2027.year}`, `Event name is ${event.name}`);
    need(event.startDate === edition2027.eventDay, `Event startDate ${event.startDate} is not the Edition's Event Day ${edition2027.eventDay}`);
    need(!event.endDate || event.endDate === edition2027.eventDay, `Event endDate ${event.endDate} is not Event Day`);
    need(event.eventStatus === 'https://schema.org/EventScheduled', `eventStatus is ${event.eventStatus}`);
    need(event.eventAttendanceMode === 'https://schema.org/OfflineEventAttendanceMode', `eventAttendanceMode is ${event.eventAttendanceMode}`);
    const address = event.location?.address ?? {};
    need(event.location?.['@type'] === 'Place', 'location is not a Place');
    need(address.addressLocality === edition2027.city && address.addressRegion === 'TX' && address.addressCountry === 'US', `the address is not ${edition2027.city}, TX, US`);
    need(!address.streetAddress && !address.postalCode, 'the address names a venue, and none is announced');
    // An offer only once there's a ticket link (CNCF's, or a test build's stand-in), and never a price until one is announced.
    const offers = event.offers;
    need(!offers || (offers['@type'] === 'Offer' && /^https:\/\//.test(offers.url ?? '') && (!edition2027.tickets.url || offers.url === edition2027.tickets.url)), `Event offers is ${JSON.stringify(offers)}, not just the ticket link`);
    need(!offers || !['price', 'lowPrice', 'highPrice', 'priceCurrency', 'priceSpecification'].some((k) => k in offers), 'Event offers has a price, and prices are not announced');
    need(event.organizer?.name === 'KCD Texas' && event.organizer?.url === 'https://kcdtexas.org', 'the organizer is not KCD Texas, https://kcdtexas.org');
    need(event.image === 'https://kcdtexas.org/cards/default.png', `Event image is ${event.image}`);
  }
  if (org) {
    need(org.name === 'KCD Texas' && org.url === 'https://kcdtexas.org', 'Organization is not KCD Texas, https://kcdtexas.org');
    need(/^https:\/\/kcdtexas\.org\/brand\/badge-[\w-]+\.png$/.test(org.logo ?? ''), `Organization logo is ${org.logo}`);
    need(JSON.stringify(org.sameAs) === JSON.stringify(socialUrls) && socialUrls.length > 0, 'Organization sameAs is not the social links in src/data/site.ts');
  }
  return problems;
}
