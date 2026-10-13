// /2027/schedule.ics: the whole Schedule as a calendar file, once the Schedule is public.
import type { APIRoute, GetStaticPaths } from 'astro';
import { icsResponse, scheduleIcs, timed } from '../../lib/program-ics';

export const getStaticPaths = (() => (timed().length ? [{ params: { file: 'schedule' } }] : [])) satisfies GetStaticPaths;

export const GET: APIRoute = () => icsResponse(scheduleIcs());
