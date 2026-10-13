// /schedule.css: the program pages' styles (src/styles/components/schedule.css), processed like the shared
// stylesheet and built only while a program page exists, like /schedule.js. A build with the gates closed ships
// neither, and its pages load the shared stylesheet alone. The program pages link it (Base.astro's `schedule`).
import type { APIRoute, GetStaticPaths } from 'astro';
import { program } from '../lib/program';
import css from '../styles/components/schedule.css?inline';

export const getStaticPaths = (() => (program ? [{ params: { style: 'schedule' } }] : [])) satisfies GetStaticPaths;

export const GET: APIRoute = () => new Response(css, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
