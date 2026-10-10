// The sample ticket days the tests build with (scripts/build.sh --tickets-day), derived from the Edition's dates
// so no made-up sale day is written out anywhere: one in the CFP Phase, and one after the Schedule day for a
// Countdown build that comes before the sale. Both read with the site's own shortDate.
import { importTs } from '../scripts/lib/import-ts.mjs';

const { edition2027: e, shortDate } = await importTs(new URL('../src/data/edition-2027.ts', import.meta.url));

const plusDays = (day, n) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** A sale day in the CFP Phase, while the call is open. */
export const cfpSaleDay = plusDays(e.cfp.opens, 45);
/** A sale day in the Countdown, after the Schedule day. */
export const laterSaleDay = plusDays(e.schedule, 14);
/** The bill's words for the later sale day before it comes: "on sale" and its short date. */
export const laterOnSale = `on sale ${shortDate(laterSaleDay)}`;
