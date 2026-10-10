// /schedule.js: the program pages' one script (src/scripts/schedule.js), built only while a program page exists,
// so a build with the gates closed ships no program script at all.
import type { APIRoute, GetStaticPaths } from 'astro';
import { program } from '../lib/program';
import scheduleJs from '../scripts/schedule.js?raw';

const scripts: Record<string, string> = program ? { schedule: scheduleJs } : {};

export const getStaticPaths = (() => Object.keys(scripts).map((script) => ({ params: { script } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => new Response(scripts[params.script!], { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } });
