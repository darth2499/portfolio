// Scans photos/<Country>/ folders, makes web-sized (optionally watermarked) copies,
// and writes the finished site to dist/. Originals are never copied to the site.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHOTOS = path.join(ROOT, 'photos');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const CACHE = path.join(ROOT, '.cache', 'img');

const config = JSON.parse(await fs.readFile(path.join(ROOT, 'site.config.json'), 'utf8'));
const img = { fullSize: 2000, thumbWidth: 900, quality: 82, watermark: '', ...config.images };
const IMAGE_RE = /\.(jpe?g|png|webp|tiff?|avif)$/i;
// Changing any image setting invalidates the cache automatically.
const settingsKey = JSON.stringify(img);

const slugify = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// "01 Iceland" -> "Iceland" (number prefixes let you control order)
const displayName = (s) => s.replace(/^\d+[\s._-]+/, '').trim();
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
const exists = (p) => fs.access(p).then(() => true, () => false);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

function watermarkSvg(text, w, h) {
  const size = Math.max(14, Math.round(w * 0.016));
  const pad = Math.round(size * 1.4);
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <text x="${w - pad}" y="${h - pad}" text-anchor="end"
        font-family="Helvetica, Arial, sans-serif" font-size="${size}" letter-spacing="${size * 0.12}"
        fill="#fff" fill-opacity="0.55" stroke="#000" stroke-opacity="0.12" stroke-width="1">${esc(text)}</text>
    </svg>`);
}

async function makeVariant(buf, width, height, withWatermark) {
  const base = sharp(buf, { failOn: 'none' }).rotate() // honour camera orientation
    .resize({ width, height, fit: 'inside', withoutEnlargement: true });
  // sharp drops EXIF/GPS by default — location data never reaches the site.
  if (!withWatermark || !img.watermark) {
    const { data, info } = await base.webp({ quality: img.quality }).toBuffer({ resolveWithObject: true });
    return { data, w: info.width, h: info.height };
  }
  const { data: raw, info } = await base.toBuffer({ resolveWithObject: true });
  const data = await sharp(raw)
    .composite([{ input: watermarkSvg(img.watermark, info.width, info.height) }])
    .webp({ quality: img.quality }).toBuffer();
  return { data, w: info.width, h: info.height };
}

async function processPhoto(file) {
  const buf = await fs.readFile(file);
  const hash = crypto.createHash('sha1').update(buf).update(settingsKey).digest('hex').slice(0, 14);
  const metaPath = path.join(CACHE, `${hash}.json`);
  if (await exists(metaPath)) return { hash, ...JSON.parse(await fs.readFile(metaPath, 'utf8')) };

  const full = await makeVariant(buf, img.fullSize, img.fullSize, true);
  const thumb = await makeVariant(buf, img.thumbWidth, img.thumbWidth * 2, false);
  await fs.writeFile(path.join(CACHE, `${hash}-f.webp`), full.data);
  await fs.writeFile(path.join(CACHE, `${hash}-t.webp`), thumb.data);
  const meta = { w: full.w, h: full.h };
  await fs.writeFile(metaPath, JSON.stringify(meta));
  return { hash, ...meta };
}

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) { const n = i++; out[n] = await fn(items[n], n); }
  }));
  return out;
}

async function main() {
  const t0 = Date.now();
  await fs.mkdir(CACHE, { recursive: true });
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(path.join(DIST, 'img'), { recursive: true });

  const folders = (await fs.readdir(PHOTOS, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !/^[._]/.test(d.name))
    .map((d) => d.name).sort(natural);

  const destinations = [];
  let total = 0;
  for (const folder of folders) {
    const files = (await fs.readdir(path.join(PHOTOS, folder)))
      .filter((f) => IMAGE_RE.test(f) && !f.startsWith('.')).sort(natural);
    if (!files.length) continue;

    const name = displayName(folder);
    const slug = slugify(name);
    const outDir = path.join(DIST, 'img', slug);
    await fs.mkdir(outDir, { recursive: true });

    const photos = await pool(files, 4, async (f) => {
      const p = await processPhoto(path.join(PHOTOS, folder, f));
      for (const v of ['f', 't']) {
        await fs.copyFile(path.join(CACHE, `${p.hash}-${v}.webp`), path.join(outDir, `${p.hash}-${v}.webp`));
      }
      return { f: `img/${slug}/${p.hash}-f.webp`, t: `img/${slug}/${p.hash}-t.webp`, w: p.w, h: p.h, cover: /^_?cover/i.test(f) };
    });

    const coverIdx = Math.max(0, photos.findIndex((p) => p.cover));
    const cover = photos[coverIdx];
    destinations.push({ name, slug, cover: { t: cover.t, w: cover.w, h: cover.h }, photos: photos.map(({ cover, ...p }) => p) });
    total += photos.length;
    console.log(`  ${name.padEnd(24)} ${photos.length} photo${photos.length === 1 ? '' : 's'}`);
  }

  const site = {
    name: config.name, tagline: config.tagline, about: config.about,
    email: config.email, instagram: config.instagram, home: config.home,
  };
  await fs.writeFile(path.join(DIST, 'data.json'), JSON.stringify({ site, destinations }));

  for (const f of await fs.readdir(SRC)) {
    let body = await fs.readFile(path.join(SRC, f));
    if (f === 'index.html') {
      body = body.toString()
        .replaceAll('{{NAME}}', esc(config.name))
        .replaceAll('{{DESCRIPTION}}', esc(config.description || ''));
    }
    await fs.writeFile(path.join(DIST, f), body);
  }
  await fs.writeFile(path.join(DIST, '.nojekyll'), '');
  if (config.cname) await fs.writeFile(path.join(DIST, 'CNAME'), config.cname.trim() + '\n');

  console.log(`\nBuilt ${destinations.length} destinations, ${total} photos in ${((Date.now() - t0) / 1000).toFixed(1)}s → dist/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
