// /2027/speakers/<slug>-small.webp and -large.webp: the Speaker photos, downloaded and resized at build time
// (src/lib/program.ts), so the pages load them from our own domain.
import type { APIRoute, GetStaticPaths } from 'astro';
import { speakerPhotos } from '../../../lib/program';

export const getStaticPaths = (() => [...speakerPhotos].flatMap(([slug, files]) => (['small', 'large'] as const).map((size) => ({
  params: { photo: `${slug}-${size}` },
  props: { body: files[size] },
})))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => new Response(new Uint8Array((props as { body: Buffer }).body), { headers: { 'Content-Type': 'image/webp' } });
