// /2027/program-version.txt: the hash of the public program, only while a program gate is open. The refresh
// workflow's check (scripts/program-check.mjs) compares it with the platform's to rebuild only on a change.
import type { APIRoute, GetStaticPaths } from 'astro';
import { programVersion } from '../../lib/program';

export const getStaticPaths = (() => (programVersion ? [{ params: { file: 'program-version' } }] : [])) satisfies GetStaticPaths;

export const GET: APIRoute = () => new Response(`${programVersion}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
