// Speaker photos, downloaded at build time and served from our domain (ADR 0007): each one is cropped square,
// resized to the two sizes the pages use, and re-encoded as WebP, which also drops its metadata. A photo that
// can't be downloaded or read fails the build, like the program itself.
import sharp from 'sharp';
import { photoQuality, photoSizes } from './config.mjs';
import { fetchBytes, ProgramSourceError } from './remote.mjs';

/**
 * @param {string} url the photo's source address (allowlisted: https, or a local test server)
 * @param {string} label names the photo in errors, such as "Speaker 3"
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<{ small: Buffer, large: Buffer }>}
 */
export async function downloadPhoto(url, label, env) {
  const { body, type } = await fetchBytes(url, { env, what: `${label}'s photo`, maxBytes: 15 * 1024 * 1024, accept: 'image/*' });
  if (type && !/^image\//i.test(type)) throw new ProgramSourceError(`${label}'s photo: the response is not an image`, env);
  try {
    const sized = (px) => sharp(body, { failOn: 'error' }).rotate().resize(px, px, { fit: 'cover', position: 'attention' }).webp({ quality: photoQuality }).toBuffer();
    const [small, large] = await Promise.all([sized(photoSizes.small), sized(photoSizes.large)]);
    return { small, large };
  } catch {
    throw new ProgramSourceError(`${label}'s photo: the image could not be read`, env);
  }
}

/**
 * Downloads every photo, a few at a time, in the order given.
 * @param {{ key: string, url: string, label: string }[]} jobs
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<Map<string, { small: Buffer, large: Buffer }>>}
 */
export async function downloadPhotos(jobs, env, concurrency = 6) {
  const out = new Map();
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next];
      next += 1;
      out.set(job.key, await downloadPhoto(job.url, job.label, env));
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return out;
}
