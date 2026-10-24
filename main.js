// Bare(ly) — one pinned stage, every state derived from a smoothed scroll progress p ∈ [0,1].
// Timeline (fractions of the scroller):
//   hero text blurs out → hero photo dissolves into grey → thumbnails bloom into a ring →
//   manifesto words blur in (ink → wine) and out → ring flies outward → tiles land in a row →
//   "(faces)" + horizontal gallery driven by the rest of the scroll.

const data = await fetch('data/models.json').then(r => r.json());
const $ = id => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── helpers ───────────────────────────────────────────
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const span = (p, a, b) => clamp((p - a) / (b - a));              // 0→1 inside [a,b]
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// local file first, the generation URL as a fallback until assets are fetched
function img(src, remote, alt = '', focus){
  const el = new Image();
  el.alt = alt; el.decoding = 'async'; el.draggable = false;
  if (focus) el.style.objectPosition = focus;
  el.src = src || remote;
  if (src && remote) el.onerror = () => { el.onerror = null; el.src = remote; };
  return el;
}
const modelSrc = m => m.src || `assets/${m.id}.webp`;

// animated tile: muted loop, poster = the still, same local → remote fallback
function clip(m){
  const v = document.createElement('video');
  Object.assign(v, { muted: true, loop: true, autoplay: true, playsInline: true, preload: 'metadata' });
  v.poster = modelSrc(m);
  v.src = m.video;
  if (m.videoRemote) v.onerror = () => { v.onerror = null; v.src = m.videoRemote; v.play().catch(() => {}); };
  v.style.cssText = 'width:100%;height:100%;object-fit:cover';
  return v;
}

// ── build DOM ─────────────────────────────────────────
document.title = `${data.brand} — model agency`;
const [b1, b2] = data.brand.split('(');
$('mark').innerHTML = `${b1}<span class="paren">(</span>${b2.replace(')', '<span class="paren">)</span>')}`;
$('intro').textContent = data.intro;
$('edition').textContent = data.edition;
$('aboutBtn').textContent = `More about ${data.brand}`;
$('dockTag').textContent = `${data.brand}®`;
$('navNew').textContent = `New faces (${data.counts.newFaces})`;
$('navModels').textContent = `Models (${data.counts.models})`;

if (data.hero.video && !reduce){
  const v = Object.assign(document.createElement('video'), { src: data.hero.video, muted: true, loop: true, autoplay: true, playsInline: true });
  $('hero').replaceChildren(v);
} else {
  $('hero').replaceChildren(img(data.hero.src, data.hero.remote));
}

// ring: 8 thumbnails, each with its own resting tilt
const TILT = [-18, 14, -9, 22, -14, 9, -24, 16, -6, 12];
const ringCards = data.models.slice(0, 8).map((m, i) => {
  const c = document.createElement('div');
  c.className = 'card';
  c.append(img(modelSrc(m), m.remote, m.name, m.focus));
  $('ring').append(c);
  return { el: c, tilt: TILT[i % TILT.length] };
});

// manifesto: every word is its own span so it can blur in on its own beat
const words = [];
for (const group of data.manifesto){
  const g = document.createElement('div'); g.className = 'grp';
  for (const line of group){
    const l = document.createElement('span'); l.className = 'ln';
    line.split(' ').forEach((w, k) => {
      if (k) l.append(' ');
      const s = document.createElement('span'); s.className = 'w'; s.textContent = w;
      l.append(s); words.push(s);
    });
    g.append(l);
  }
  $('manifesto').append(g);
}

// gallery: the cast repeated so the row never runs dry
const REPEAT = 3;
const shortlist = new Set();
const tiles = [];
for (let r = 0; r < REPEAT; r++) data.models.forEach(m => {
  const t = document.createElement('figure');
  t.className = 'tile';
  t.dataset.id = m.id;
  const ph = document.createElement('div'); ph.className = 'ph';
  ph.append(m.video && !reduce ? clip(m) : img(modelSrc(m), m.remote, m.name, m.focus));
  const cap = document.createElement('figcaption'); cap.className = 'cap';
  cap.innerHTML = `<b>(${m.no})</b><span>${m.name}</span>`;
  t.append(ph, cap);
  t.addEventListener('click', () => toggle(m.id));
  $('row').append(t);
  tiles.push(t);
});
function toggle(id){
  shortlist.has(id) ? shortlist.delete(id) : shortlist.add(id);
  tiles.forEach(t => t.classList.toggle('picked', shortlist.has(t.dataset.id)));
  const n = $('navShort');
  n.textContent = `Shortlist (${shortlist.size})`;
  n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump');
}

// where each landing tile starts: scattered, tilted, small — as if thrown in from the ring
const SCATTER = [
  { x: -.30, y: -.05, r: -16, s: .42 }, { x: -.12, y: .30, r: 11, s: .46 },
  { x: .18, y: -.55, r: -7, s: .40 },  { x: .40, y: -.50, r: 14, s: .38 },
  { x: .75, y: .45, r: 19, s: .40 },   { x: .95, y: -.40, r: -12, s: .36 },
];

// ── layout metrics (recomputed on resize) ──────────────
let W, H, mobile, tileW, gap, rowTop, scrollMax;
function measure(){
  W = innerWidth; H = innerHeight; mobile = W <= 760;
  gap = W * (mobile ? .025 : .0055);
  tileW = mobile ? W * .62 : (W - gap * 3) / 4.12;
  rowTop = mobile ? H * .2 : H * .205;
  $('row').style.setProperty('--tw', tileW + 'px');
  const total = tiles.length * (tileW + gap);
  scrollMax = Math.max(0, total - W - (data.models.length * (tileW + gap)));   // stop before the last lap
  scroller.style.height = (mobile ? 1000 : 1100) + 'vh';
}
const scroller = $('scroller');
addEventListener('resize', measure);
measure();

// ── smoothed scroll → progress ─────────────────────────
let target = 0, current = 0, spin = 0, last = performance.now();
const progress = () => {
  const max = scroller.offsetHeight - innerHeight;
  return max > 0 ? clamp(scrollY / max) : 0;
};
addEventListener('scroll', () => { target = progress(); }, { passive: true });
target = current = progress();

const set = (el, o, blur, extra = '') => {
  el.style.opacity = o;
  el.style.filter = blur > .05 ? `blur(${blur}px)` : 'none';
  if (extra) el.style.transform = extra;
};

function frame(now){
  const dt = Math.min(64, now - last); last = now;
  current = reduce ? target : current + (target - current) * (1 - Math.pow(1 - .085, dt / 16.7));
  const p = current;
  spin += dt * .006;                              // idle ring drift, degrees

  // 1 · hero text blurs away, staggered: wordmark → paragraph → number
  const tMark = easeIn(span(p, .015, .085)), tIntro = easeIn(span(p, .035, .095)), tEd = easeIn(span(p, .05, .11));
  set($('mark'), 1 - tMark, tMark * 22);
  set($('intro'), 1 - tIntro, tIntro * 10);
  set($('edition'), 1 - tEd, tEd * 18);

  // 2 · photo dissolves into the grey fog
  const tFog = span(p, .09, .24);
  const hero = $('hero');
  hero.style.filter = tFog > 0 ? `blur(${easeInOut(tFog) * 46}px) saturate(${1 - tFog * .55})` : 'none';
  hero.style.opacity = 1 - easeIn(span(p, .14, .3));
  $('stage').style.background = mix('#f2f2f0', '#d9d9db', span(p, .1, .26));

  // 3 · ring blooms from the centre, drifts, then flings outward
  const bloom = easeOut(span(p, .17, .3));
  const fling = easeIn(span(p, .58, .7));
  const R0 = Math.min(W, H) * (mobile ? .4 : .41);
  const R = lerp(R0 * .08, R0, bloom) + fling * Math.max(W, H) * .95;
  const rot = spin + p * 260;
  const cx = W / 2, cy = H * .47;
  const cardW = ringCards[0].el.offsetWidth;
  ringCards.forEach((c, i) => {
    const a = (i / ringCards.length) * Math.PI * 2 + rot * Math.PI / 180;
    const x = cx + Math.cos(a) * R - cardW / 2, y = cy + Math.sin(a) * R * (mobile ? 1.15 : .98) - cardW / 2;
    const s = lerp(.35, 1, bloom) * (1 + fling * 1.6);
    c.el.style.transform = `translate3d(${x}px,${y}px,0) rotate(${c.tilt + rot * .35}deg) scale(${s})`;
    c.el.style.opacity = bloom * (1 - span(p, .66, .71));
    c.el.style.filter = bloom < 1 ? `blur(${(1 - bloom) * 10}px)` : 'none';
  });

  // 4 · manifesto: words arrive one by one (blurred ink → sharp wine), then the block blurs out
  const inA = .3, inB = .5, n = words.length;
  const out = easeIn(span(p, .54, .6));
  words.forEach((w, k) => {
    const a = inA + (inB - inA) * (k / n), t = span(p, a, a + (inB - inA) / n * 2.4);
    const e = easeOut(t);
    w.style.opacity = e * (1 - out);
    const blur = (1 - e) * 14 + out * 16;
    w.style.filter = blur > .05 ? `blur(${blur}px)` : 'none';
    w.style.color = mix('#111111', '#a3140f', span(t, .55, 1));
  });

  // 5 · tiles fly in from the scatter and lock into the row
  const land = span(p, .66, .8);
  const slide = easeInOut(span(p, .8, 1)) * scrollMax;
  const capO = span(p, .78, .83);
  $('facesTitle').style.opacity = capO;
  $('facesTitle').style.filter = capO < 1 ? `blur(${(1 - capO) * 10}px)` : 'none';
  tiles.forEach((t, i) => {
    const fx = i * (tileW + gap) + gap * .5 - slide, fy = rowTop;
    const sc = SCATTER[i];
    let x = fx, y = fy, r = 0, s = 1, o = 1;
    if (sc){
      const k = easeOut(span(land, i * .09, .55 + i * .09));
      x = lerp(fx + sc.x * W, fx, k); y = lerp(fy + sc.y * H, fy, k);
      r = lerp(sc.r, 0, k); s = lerp(sc.s, 1, k); o = span(land, i * .09, i * .09 + .12);
    } else {
      o = span(land, .7, 1);                    // later tiles simply wait off to the right
    }
    if (land <= 0) o = 0;
    t.style.transform = `translate3d(${x}px,${y}px,0) rotate(${r}deg) scale(${s})`;
    t.style.opacity = o;
    t.style.pointerEvents = land > .9 ? 'auto' : 'none';
    t.querySelector('.cap').style.opacity = capO;
  });

  requestAnimationFrame(frame);
}

// hex colour blend for the fog and the ink → wine words
function mix(a, b, t){
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = s => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

// dock + cta links jump to the matching beat of the sequence
const jump = p => scrollTo({ top: p * (scroller.offsetHeight - innerHeight), behavior: 'smooth' });
document.querySelector('.btn-red').addEventListener('click', e => { e.preventDefault(); jump(.82); });
$('navNew').addEventListener('click', e => { e.preventDefault(); jump(.82); });
$('navModels').addEventListener('click', e => { e.preventDefault(); jump(.3); });
$('dockTag').addEventListener('click', () => jump(0));

requestAnimationFrame(frame);
