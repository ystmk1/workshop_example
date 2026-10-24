// Vercel build: copy the static site into dist/ and self-host the generated assets.
// Every image/video in data/models.json is fetched from its Higgsfield URL once, resized and written next to
// the page (webp for stills, mp4 as-is for clips). Files already in assets/ (committed) are reused, so the
// build also works offline once the assets are checked in.
//   node tools/build.mjs            → dist/
import { mkdir, readFile, writeFile, cp, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const exists = p => access(p).then(() => true, () => false);

const data = JSON.parse(await readFile(join(ROOT, 'data/models.json'), 'utf8'));
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { console.warn('sharp missing: stills are copied as png'); }

// [local path, remote url, longest edge]
const jobs = [[data.hero.src, data.hero.remote, 2400]];
for (const m of data.models){
  jobs.push([m.src || `assets/${m.id}.webp`, m.remote, 1400]);
  if (m.video) jobs.push([m.video, m.videoRemote, 0]);
}
if (data.hero.video) jobs.push([data.hero.video, data.hero.videoRemote, 0]);

await mkdir(join(DIST, 'assets'), { recursive: true });
for (const f of ['index.html', 'style.css', 'main.js']) await cp(join(ROOT, f), join(DIST, f));
await cp(join(ROOT, 'data'), join(DIST, 'data'), { recursive: true });

let fetched = 0, reused = 0, failed = 0;
for (const [local, remote, edge] of jobs){
  const src = join(ROOT, local), out = join(DIST, local);
  await mkdir(dirname(out), { recursive: true });
  if (await exists(src)){ await cp(src, out); reused++; continue; }
  if (!remote){ failed++; continue; }
  try {
    const res = await fetch(remote);
    if (!res.ok) throw new Error(`${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (edge && sharp){
      await writeFile(out, await sharp(buf).resize(edge, edge, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer());
    } else {
      await writeFile(out, buf);
    }
    fetched++;
  } catch (e){
    failed++;
    console.warn(`could not fetch ${local}: ${e.message} (the page falls back to the remote url)`);
  }
}
console.log(`dist ready · ${fetched} fetched · ${reused} reused · ${failed} missing`);
