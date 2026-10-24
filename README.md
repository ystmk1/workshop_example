# Bare(ly)

Model agency landing page: one pinned stage driven by scroll —
hero → blur-out → ring of thumbnails → manifesto → tiles land → horizontal `(faces)` gallery.

- `data/models.json` — brand, copy, cast (Higgsfield Soul 2.0 job ids + URLs), clips
- `main.js` — the scroll timeline · `style.css` — layout
- `tools/build.mjs` — Vercel build: copies the site to `dist/` and self-hosts the generated assets as webp/mp4

Local: `python -m http.server 4173` → http://localhost:4173
Vercel: import the repo, framework "Other"; `vercel.json` sets the build and output.
