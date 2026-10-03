// The social cards, drawn at build time from the data files (src/lib/cards). Served from our domain.
import type { APIRoute, GetStaticPaths } from 'astro';
import { cards, renderCard, type CardId } from '../../lib/cards/cards';

export const getStaticPaths = (() => Object.keys(cards).map((card) => ({ params: { card } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) =>
  new Response(new Uint8Array(await renderCard(params.card as CardId)), { headers: { 'Content-Type': 'image/png' } });
