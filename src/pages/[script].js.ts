// /schedule.js and /sw.js: the program pages' script (src/scripts/schedule.js) and their offline worker
// (src/scripts/sw.js), built only while a program page exists, so a build with the gates closed ships neither.
// The worker carries this build's time as its version, so each build replaces it. From the day after Event Day the
// script registers nothing, and the worker clears its copies and removes itself (offlineCopy in src/lib/program.ts).
import type { APIRoute, GetStaticPaths } from 'astro';
import { offlineCopy, program } from '../lib/program';
import scheduleJs from '../scripts/schedule.js?raw';
import swJs from '../scripts/sw.js?raw';

/** `text` with `from` replaced by `to`; the build fails if `from` isn't there. */
function set(text: string, from: string, to: string): string {
  if (!text.includes(from)) throw new Error(`src/scripts: "${from}" is missing, so the build can't set it`);
  return text.replace(from, to);
}

const scripts: Record<string, string> = program
  ? {
    schedule: set(scheduleJs, 'var OFFLINE = true,', `var OFFLINE = ${offlineCopy},`),
    sw: set(swJs, "var VERSION = 'BUILD', OFF = false,", `var VERSION = '${new Date().toISOString()}', OFF = ${!offlineCopy},`),
  }
  : {};

export const getStaticPaths = (() => Object.keys(scripts).map((script) => ({ params: { script } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => new Response(scripts[params.script!], { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } });
