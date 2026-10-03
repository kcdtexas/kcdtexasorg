// Build-time images: photos, faces and logos go through Astro's image pipeline,
// so the pages only ever load resized files from our own domain (ADR 0007).
import type { ImageMetadata } from 'astro';

type Glob = Record<string, { default: ImageMetadata }>;
const byName = (files: Glob) =>
  Object.fromEntries(Object.entries(files).map(([path, mod]) => [path.split('/').pop()!.replace(/\.\w+$/, ''), mod.default]));

export const photos = byName(import.meta.glob('../assets/photos/*.jpg', { eager: true }));
export const keynotePhotos = byName(import.meta.glob('../assets/keynotes/*.jpg', { eager: true }));
export const faces = byName(import.meta.glob('../assets/faces/*.jpg', { eager: true }));
export const logos = byName(import.meta.glob('../assets/logos/*.svg', { eager: true }));
export { default as badge } from '../assets/brand/badge-2027-600.png';
export { default as recapPoster } from '../assets/video/recap-poster.jpg';
