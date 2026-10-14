// Build-time images: photos, faces and logos go through Astro's image pipeline,
// so the pages only ever load resized files from our own domain (ADR 0007).
import type { ImageMetadata } from 'astro';

type Glob = Record<string, { default: ImageMetadata }>;
const byName = (files: Glob) =>
  Object.fromEntries(Object.entries(files).map(([path, mod]) => [path.split('/').pop()!.replace(/\.\w+$/, ''), mod.default]));

export const photos = byName(import.meta.glob('../assets/photos/*.jpg', { eager: true }));
export const keynotePhotos = byName(import.meta.glob('../assets/keynotes/*.jpg', { eager: true }));
export const faces = byName(import.meta.glob('../assets/faces/*.jpg', { eager: true }));
export const organizerPhotos = byName(import.meta.glob('../assets/organizers/*.jpg', { eager: true }));
export const organizerPhotos2027 = byName(import.meta.glob('../assets/organizers/2027/*.jpg', { eager: true }));
export const logos = byName(import.meta.glob('../assets/logos/*.svg', { eager: true }));
export { default as badge } from '../assets/brand/badge-2027-600.png';
export { default as recapPoster } from '../assets/video/recap-poster.jpg';

/** A photo by its file name in one of the folders above; a name with no file fails the build, so a typo never shows
 *  initials in a photo's place. No file name: null, for initials. */
export const photoOf = (folder: Record<string, ImageMetadata>, file: string | undefined, who: string) => {
  if (!file) return null;
  if (!folder[file]) throw new Error(`No photo "${file}" for ${who}`);
  return folder[file];
};
