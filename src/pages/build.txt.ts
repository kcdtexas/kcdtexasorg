// /build.txt: the Central day this build was made for, as YYYY-MM-DD. The rebuild workflow reads the live one to
// make up a rebuild day that GitHub ran late, dropped, or whose build failed (docs/rebuilds.md, "Catch-up").
import type { APIRoute } from 'astro';
import { asOfDay } from '../data/edition-2027';

export const GET: APIRoute = () => new Response(`${asOfDay}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
