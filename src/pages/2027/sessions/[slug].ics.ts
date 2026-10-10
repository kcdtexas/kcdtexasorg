// /2027/sessions/<slug>.ics: "Add to calendar" for one Session, once the Schedule is public.
import type { APIRoute, GetStaticPaths } from 'astro';
import { icsResponse, sessionIcs, timed } from '../../../lib/program-ics';
import type { Session } from '../../../lib/program';

export const getStaticPaths = (() => timed().map((s) => ({ params: { slug: s.slug }, props: { session: s } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => icsResponse(sessionIcs((props as { session: Session }).session));
