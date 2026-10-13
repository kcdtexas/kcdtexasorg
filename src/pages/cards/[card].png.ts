// The social cards, drawn at build time from the data files (src/lib/cards). Served from our domain. The program's
// Share Cards join them while a program gate is open (src/lib/cards/program-cards.ts).
import type { APIRoute, GetStaticPaths } from 'astro';
import { cards, renderCard, renderNode, type CardId } from '../../lib/cards/cards';
import { programCards } from '../../lib/cards/program-cards';

export const getStaticPaths = (() => [
  ...Object.keys(cards).map((card) => ({ params: { card } })),
  ...programCards.map((c) => ({ params: { card: c.id } })),
]) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
  const program = programCards.find((c) => c.id === params.card);
  const png = program ? await renderNode(await program.draw()) : await renderCard(params.card as CardId);
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
