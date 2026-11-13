// Geo kit core: one camera over one Mercator world, skins, country paths, flags, text, sprites.
export const W = 1080, H = 1920, FPS = 30;
export const CFG = { watermark: '' };

// ---------------- math ----------------
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => (t = clamp(t), t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t) => Math.pow(clamp(t), 3);
export const prog = (f, a, b) => b <= a ? (f >= a ? 1 : 0) : clamp((f - a) / (b - a));
export const my = (lat) => { lat = clamp(lat, -85, 85); return (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2; };
export const ux = (lon) => (lon + 180) / 360;
export const unMy = (y) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
export const pop = (f, s, n = 7) => { const t = (f - s) / n; if (t <= 0) return 0; if (t >= 1) return 1; return t < 0.7 ? easeOut(t / 0.7) * 1.15 : 1.15 - 0.15 * ease((t - 0.7) / 0.3); };
export const rnd = (s) => { const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
export function mix(a, b, t) { const pa = hex(a), pb = hex(b); return 'rgb(' + pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',') + ')'; }
export function hex(c) { if (c.startsWith('rgb')) return c.match(/[\d.]+/g).slice(0, 3).map(Number); return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); }

// Smooth camera: monotone cubic Hermite through keys [[f, lon, lat, ppd, rot]], zoom in log space, constant drift.
export function track(keys, f, drift = 1) {
  const n = keys.length; let out;
  if (n === 1 || f <= keys[0][0]) out = keys[0].slice(1); else if (f >= keys[n - 1][0]) out = keys[n - 1].slice(1);
  else {
    let i = 0; while (keys[i + 1][0] < f) i++; out = [];
    for (let d = 0; d < 4; d++) {
      const V = (k) => d === 2 ? Math.log(keys[k][d + 1]) : keys[k][d + 1], T = (k) => keys[k][0];
      const slope = (k) => (V(k + 1) - V(k)) / (T(k + 1) - T(k));
      const tan = (k) => { if (k === 0 || k === n - 1) return 0; const s0 = slope(k - 1), s1 = slope(k); if (s0 * s1 <= 0) return 0; const h0 = T(k) - T(k - 1), h1 = T(k + 1) - T(k); return 3 * (h0 + h1) / ((2 * h1 + h0) / s0 + (h1 + 2 * h0) / s1); };
      const h = T(i + 1) - T(i), t = (f - T(i)) / h, t2 = t * t, t3 = t2 * t;
      const v = (2 * t3 - 3 * t2 + 1) * V(i) + (t3 - 2 * t2 + t) * h * tan(i) + (-2 * t3 + 3 * t2) * V(i + 1) + (t3 - t2) * h * tan(i + 1);
      out.push(d === 2 ? Math.exp(v) : v);
    }
  }
  out[0] += drift * (Math.sin(f / 19) * 60 + Math.sin(f / 47) * 40) / out[2]; out[1] += drift * (Math.cos(f / 23) * 50 + Math.sin(f / 61) * 30) / out[2]; out[2] *= 1 + drift * (0.06 * Math.sin(f / 29) + 0.03 * Math.sin(f / 71));
  return out;
}

// ---------------- assets ----------------
export const A = { img: {}, C: {}, S: {}, places: [], seas: [], rivers: [], skins: {}, captions: [], masks: {} };
export function loadImg(name, src) { return new Promise((res) => { const i = new Image(); i.onload = () => { A.img[name] = i; res(i); }; i.onerror = () => { console.log('missing ' + src); res(null); }; i.src = src; }); }
const J = async (p) => (await fetch(p)).json();
export async function loadCore(opts = {}) {
  [A.C, A.S, A.places, A.seas, A.rivers, A.skins] = await Promise.all(['countries', 'states', 'places', 'seas', 'rivers'].map(n => J(`data/world/${n}.json`)).concat([J('data/skins/index.json')]));
  const fonts = [['Poppins-SemiBold', 'Poppins-SemiBold.ttf'], ['Poppins-Bold', 'Poppins-Bold.ttf'], ['Poppins-ExtraBold', 'Poppins-ExtraBold.ttf'], ['Poppins-Black', 'Poppins-Black.ttf'],
    ['Baskerville', 'LibreBaskerville-VF.ttf'], ['Baskerville-Italic', 'LibreBaskerville-Italic-VF.ttf'], ['Cinzel', 'Cinzel-VF.ttf']];
  await Promise.all(fonts.map(async ([n, f]) => { const ff = new FontFace(n, `url(fonts/${f})`); await ff.load(); document.fonts.add(ff); }));
  const regions = Object.keys(A.skins).filter(r => r === 'world' || !opts.regions || opts.regions.includes(r));
  await Promise.all(regions.flatMap(r => ['sat', 'atlas', 'relief', 'mask'].map(k => loadImg(`${k}_${r}`, `data/skins/${k}_${r}.${k === 'mask' ? 'png' : 'jpg'}`))));
  A.regions = regions.filter(r => r !== 'world').sort((a, b) => A.skins[a].ppd - A.skins[b].ppd);
  buildClouds(); buildPaper();
}

// ---------------- geometry ----------------
const PATH = {}, PCX = {};
export function shapeOf(key) { // ISO3, "ISO3:State", or group array
  if (PATH[key]) return PATH[key];
  const d = A.C[key] || A.S[key]; if (!d) return null;
  const p = new Path2D(); for (const r of d.rings) { r.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath(); }
  PATH[key] = p; PCX[key] = ux(d.c[0]); return p;
}
export function wrapOff(key) { const d = (PCX[key] ?? 0.5) - ux(cam.lon); return -Math.round(d); }
// name lookup -> {lon, lat, bbox?, key?}
const LOOK = {};
const ALIAS = { korea: 'PRK+KOR', 'korean peninsula': 'PRK+KOR', 'latin america': 'MEX+BRA+ARG+CHL+COL', europe: 'PRT+FIN+GRC+GBR', 'middle east': 'TUR+EGY+IRN+SAU+YEM', usa: 'USA', us: 'USA', uk: 'GBR', britain: 'GBR', 'united states': 'USA', 'soviet union': 'RUS', ussr: 'RUS' };
export function lookup(name) {
  if (Array.isArray(name)) return { lon: name[0], lat: name[1] };
  if (LOOK[name]) return LOOK[name]; const n = name.toLowerCase(); let r = null;
  if (ALIAS[n] && !A.C[name] && !A.S[name]) return (LOOK[name] = lookup(ALIAS[n]));
  if (name.includes('+')) { const parts = name.split('+').map(x => lookup(x.trim())).filter(x => x.bbox); const bb = [Math.min(...parts.map(p => p.bbox[0])), Math.min(...parts.map(p => p.bbox[1])), Math.max(...parts.map(p => p.bbox[2])), Math.max(...parts.map(p => p.bbox[3]))]; return (LOOK[name] = { lon: (bb[0] + bb[2]) / 2, lat: (bb[1] + bb[3]) / 2, bbox: bb }); }
  if (A.C[name]) r = { lon: A.C[name].c[0], lat: A.C[name].c[1], bbox: A.C[name].bbox, key: name };
  if (!r && A.S[name]) r = { lon: A.S[name].c[0], lat: A.S[name].c[1], bbox: A.S[name].bbox, key: name };
  if (!r) for (const [k, d] of Object.entries(A.C)) if (d.names.some(x => x.toLowerCase() === n)) { r = { lon: d.c[0], lat: d.c[1], bbox: d.bbox, key: k }; break; }
  if (!r) { const pl = A.places.filter(p => p[0].toLowerCase() === n).sort((a, b) => b[3] - a[3])[0]; if (pl) r = { lon: pl[1], lat: pl[2] }; }
  if (!r) { const s = A.seas.find(p => (p[0] || '').toLowerCase() === n); if (s) r = { lon: s[1], lat: s[2] }; }
  if (!r) for (const [k, d] of Object.entries(A.S)) if ((d.name || '').toLowerCase() === n) { r = { lon: d.c[0], lat: d.c[1], bbox: d.bbox, key: k }; break; }
  if (!r) { console.log('lookup failed: ' + name); r = { lon: 0, lat: 0 }; }
  return (LOOK[name] = r);
}
export const keyOf = (name) => { if (A.C[name] || A.S[name]) return name; const r = lookup(name); return r.key; };

// ---------------- camera ----------------
export const cam = { lon: 0, lat: 0, ppd: 10, rot: 0 };
export function setCam(lon, lat, ppd, rot = 0) { cam.lon = ((lon + 180) % 360 + 360) % 360 - 180; cam.lat = lat; cam.ppd = ppd; cam.rot = rot; }
export const K = () => 360 * cam.ppd;
export function toScreen(lon, lat) { const k = K(); let dx = ux(lon) - ux(cam.lon); dx -= Math.round(dx); const x = dx * k, y = (my(lat) - my(cam.lat)) * k; const c = Math.cos(cam.rot), s = Math.sin(cam.rot); return [W / 2 + x * c - y * s, H / 2 + x * s + y * c]; }
export function mapSpace(ctx) { const k = K(); ctx.translate(W / 2, H / 2); ctx.rotate(cam.rot); ctx.scale(k, k); ctx.translate(-ux(cam.lon), -my(cam.lat)); }
export const zoomScale = (base = 40, lo = 0.4, hi = 2) => clamp(cam.ppd / base, lo, hi);

// ---------------- skins ----------------
// sat / atlas are images; the rest are built from relief + mask with a palette.
export const PALETTES = {
  old: { sea: '#7FA9C9', land: '#E9DDB8', relief: 0.55 }, blueprint: { sea: '#3A63B8', land: '#3A63B8', relief: 0.0, grid: 'rgba(255,255,255,0.18)', diag: true },
  teal: { sea: '#11606C', land: '#11606C', relief: 0.0, grid: 'rgba(0,25,35,0.35)' }, war: { sea: '#1C2A44', land: '#6E5B3E', relief: 0.9 },
  minimal: { sea: '#BFE6F2', land: '#F7F7F2', relief: 0.0 }, paperwhite: { sea: '#D9EEF6', land: '#FFFFFF', relief: 0.25 },
};
const SKC = {};
function maskAlpha(r) { const k = 'ma_' + r; if (SKC[k]) return SKC[k]; const im = A.img['mask_' + r]; const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height); for (let i = 0; i < d.data.length; i += 4) { d.data[i + 3] = d.data[i]; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; } g.putImageData(d, 0, 0); return (SKC[k] = c); }
function skinCanvas(kind, r) {
  if (kind === 'sat' || kind === 'atlas') return A.img[`${kind}_${r}`];
  if (kind === 'grey') { const k = 'grey_' + r; if (SKC[k]) return SKC[k]; const s = A.img['atlas_' + r]; const c = document.createElement('canvas'); c.width = s.width; c.height = s.height; const g = c.getContext('2d'); g.filter = 'grayscale(1) brightness(0.92) contrast(0.9)'; g.drawImage(s, 0, 0); return (SKC[k] = c); }
  const k = kind + '_' + r; if (SKC[k]) return SKC[k]; const pal = PALETTES[kind]; const rel = A.img['relief_' + r]; const c = document.createElement('canvas'); c.width = rel.width; c.height = rel.height; const g = c.getContext('2d');
  g.fillStyle = pal.sea; g.fillRect(0, 0, c.width, c.height);
  const l = document.createElement('canvas'); l.width = c.width; l.height = c.height; const lg = l.getContext('2d'); lg.fillStyle = pal.land; lg.fillRect(0, 0, c.width, c.height); lg.globalCompositeOperation = 'destination-in'; lg.drawImage(maskAlpha(r), 0, 0); g.drawImage(l, 0, 0);
  if (pal.relief) { g.globalAlpha = pal.relief; g.globalCompositeOperation = 'overlay'; g.drawImage(rel, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  return (SKC[k] = c);
}
export function drawSkin(ctx, kind, alpha = 1) {
  if (alpha <= 0) return; ctx.save(); ctx.globalAlpha = alpha; mapSpace(ctx); ctx.imageSmoothingQuality = 'high';
  const wm = A.skins.world; const wy0 = my(wm.lat1), wy1 = my(wm.lat0); const wc = skinCanvas(kind, 'world');
  for (const off of [-1, 0, 1]) { const x = Math.floor(ux(cam.lon)) + off;
    // past the map's top/bottom edge, stretch the edge row so the camera never sees empty space
    ctx.drawImage(wc, 0, 0, wc.width, 2, x, wy0 - 3, 1, 3 + 1e-4); ctx.drawImage(wc, 0, wc.height - 2, wc.width, 2, x, wy1 - 1e-4, 1, 3);
    ctx.drawImage(wc, x, wy0, 1, wy1 - wy0); }
  for (const r of A.regions) { const m = A.skins[r]; if (cam.ppd < m.ppd * 0.25) continue; const x0 = ux(m.lon0), x1 = ux(m.lon1), y0 = my(m.lat1), y1 = my(m.lat0); const base = Math.round(ux(cam.lon) - (x0 + x1) / 2);
    ctx.drawImage(skinCanvas(kind, r), x0 + base, y0, x1 - x0, y1 - y0); }
  ctx.restore();
  const pal = PALETTES[kind]; if (pal && pal.grid) grid(ctx, pal.grid, pal.diag, alpha);
}
function grid(ctx, color, diag, alpha) { ctx.save(); ctx.globalAlpha = alpha; mapSpace(ctx); ctx.strokeStyle = color; ctx.lineWidth = 2 / K(); const st = (cam.ppd > 60 ? 1 : cam.ppd > 15 ? 3 : 10) / 360; const cx = ux(cam.lon), cy = my(cam.lat), R = 1.2 * W / K();
  ctx.beginPath(); for (let x = Math.floor((cx - R) / st) * st; x < cx + R; x += st) { ctx.moveTo(x, cy - R); ctx.lineTo(x + (diag ? R * 0.6 : 0), cy + R); } if (!diag) for (let y = Math.floor((cy - R) / st) * st; y < cy + R; y += st) { ctx.moveTo(cx - R, y); ctx.lineTo(cx + R, y); } ctx.stroke(); ctx.restore(); }
let PAPER; function buildPaper() { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(20,70,120,0.28)';
  for (let y = 0; y < H; y += 5) for (let x = (y / 5) % 2 ? 2.5 : 0; x < W; x += 5) { g.beginPath(); g.arc(x, y, 1.35, 0, 7); g.fill(); }
  const id = g.getImageData(0, 0, W, H); const d = id.data; let s = 1; for (let i = 0; i < d.length; i += 4) { s = (s * 16807) % 2147483647; const n = (s / 2147483647 - 0.5) * 22; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0); PAPER = c; }
export function paper(ctx, alpha) { if (alpha <= 0) return; ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(PAPER, 0, 0); ctx.restore(); }

// ---------------- fills ----------------
const HATCH = {}; function hatchPattern(ctx, kind, color) { const k = kind + color; if (!HATCH[k]) { const c = document.createElement('canvas'); c.width = c.height = 24; const g = c.getContext('2d'); g.strokeStyle = color; g.lineWidth = 4; g.beginPath();
  if (kind === 'diag') { g.moveTo(-6, 24); g.lineTo(24, -6); g.moveTo(6, 30); g.lineTo(30, 6); } else if (kind === 'vert') { g.moveTo(6, 0); g.lineTo(6, 24); } else { g.moveTo(0, 6); g.lineTo(24, 6); } g.stroke(); HATCH[k] = c; } return ctx.createPattern(HATCH[k], 'repeat'); }
export function fillShape(ctx, key, color, o = {}) {
  const p = shapeOf(key); if (!p) return; ctx.save(); mapSpace(ctx); ctx.translate(wrapOff(key), 0);
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur || 30; }
  ctx.globalAlpha = o.alpha ?? 1; ctx.fillStyle = color; ctx.fill(p, 'evenodd');
  if (o.hatch) { ctx.shadowBlur = 0; ctx.clip(p, 'evenodd'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = hatchPattern(ctx, o.hatch, o.hatchColor || 'rgba(0,0,0,0.16)'); ctx.fillRect(0, 0, W, H); ctx.restore(); ctx.save(); mapSpace(ctx); ctx.translate(wrapOff(key), 0); }
  if (o.stroke) { ctx.shadowBlur = o.strokeGlow || 0; ctx.shadowColor = o.stroke; ctx.globalAlpha = o.strokeAlpha ?? (o.alpha ?? 1); ctx.lineWidth = (o.strokeW || 3) / K(); ctx.strokeStyle = o.stroke; ctx.stroke(p); }
  ctx.restore();
}
export function clipShape(ctx, key) { const p = shapeOf(key); if (!p) return; mapSpace(ctx); ctx.translate(wrapOff(key), 0); ctx.clip(p, 'evenodd'); ctx.setTransform(1, 0, 0, 1, 0, 0); }
export function blobPath(ctx, cx, cy, r, sd = 1, n = 64, amp = 0.18) { for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; const rr = r * (1 + amp * (Math.sin(a * 3 + sd) * 0.5 + Math.sin(a * 7 + sd * 2) * 0.3 + Math.sin(a * 13 + sd * 5) * 0.2)); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); }

// ---------------- flags ----------------
const FL = {};
export async function loadFlag(code) { // ISO3, iso2, or custom (USSR, UN, ...)
  const c = String(code); if (FL[c]) return;
  if (CUSTOM[c]) { FL[c] = CUSTOM[c](); return; }
  const iso2 = (A.C[c] && A.C[c].iso2) || c.toLowerCase(); const im = await loadImg('flag_' + iso2, `flags/${iso2}.svg`);
  if (!im) { FL[c] = CUSTOM.BLANK(); return; } const cv = document.createElement('canvas'); cv.width = 300; cv.height = 200; cv.getContext('2d').drawImage(im, 0, 0, 300, 200); FL[c] = cv;
}
const mk = (f) => () => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; f(c.getContext('2d')); return c; };
const star = (g, x, y, r, col) => { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); };
const CUSTOM = {
  BLANK: mk(g => { g.fillStyle = '#ddd'; g.fillRect(0, 0, 300, 200); }),
  USSR: mk(g => { g.fillStyle = '#CC0000'; g.fillRect(0, 0, 300, 200); star(g, 55, 28, 14, '#FFD700'); g.strokeStyle = '#FFD700'; g.lineWidth = 9; g.beginPath(); g.arc(55, 82, 28, 3.6, 7.4); g.stroke(); g.lineWidth = 10; g.beginPath(); g.moveTo(35, 110); g.lineTo(78, 62); g.stroke(); g.fillStyle = '#FFD700'; g.fillRect(64, 52, 28, 12); }),
  UN: mk(g => { g.fillStyle = '#4B92DB'; g.fillRect(0, 0, 300, 200); g.strokeStyle = '#fff'; g.lineWidth = 6; for (const r of [45, 25]) { g.beginPath(); g.arc(150, 95, r, 0, 7); g.stroke(); } g.beginPath(); g.moveTo(105, 95); g.lineTo(195, 95); g.moveTo(150, 50); g.lineTo(150, 140); g.stroke(); }),
  UK_OLD: mk(g => { g.fillStyle = '#012169'; g.fillRect(0, 0, 300, 200); g.strokeStyle = '#fff'; g.lineWidth = 40; g.beginPath(); g.moveTo(0, 0); g.lineTo(300, 200); g.moveTo(300, 0); g.lineTo(0, 200); g.stroke(); g.strokeStyle = '#C8102E'; g.lineWidth = 14; g.stroke(); g.lineWidth = 60; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(150, 0); g.lineTo(150, 200); g.moveTo(0, 100); g.lineTo(300, 100); g.stroke(); g.lineWidth = 34; g.strokeStyle = '#C8102E'; g.stroke(); }),
  NAZI_FREE_GERMANY_1918: mk(g => { [['#000', 0], ['#fff', 1], ['#E00', 2]].forEach(([c, i]) => { g.fillStyle = c; g.fillRect(0, i * 67, 300, 67); }); }),
  AUSTRIA_HUNGARY: mk(g => { g.fillStyle = '#000'; g.fillRect(0, 0, 300, 100); g.fillStyle = '#FCDD09'; g.fillRect(0, 100, 300, 100); }),
};
export function flagCanvas(code) { return FL[String(code)] || CUSTOM.BLANK(); }
export function drawFlag(ctx, code, x, y, w, t, o = {}) {
  const src = flagCanvas(code); const h = w * 2 / 3, n = 30, sw = w / n;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.tilt || 0); ctx.scale(o.scale ?? 1, o.scale ?? 1); ctx.globalAlpha = o.alpha ?? 1;
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 6;
  for (let i = 0; i < n; i++) { const ph = i / n * Math.PI * 2.2 - t * 7; const dy = Math.sin(ph) * h * 0.07 * (i / n); const sh = Math.cos(ph) * 0.18 * (i / n);
    ctx.drawImage(src, i * 300 / n, 0, 300 / n + 0.5, 200, -w / 2 + i * sw, -h / 2 + dy, sw + 0.8, h);
    if (sh) { ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.fillStyle = sh > 0 ? `rgba(255,255,255,${sh})` : `rgba(0,0,0,${-sh})`; ctx.fillRect(-w / 2 + i * sw, -h / 2 + dy, sw + 0.8, h); } }
  ctx.restore();
}

// ---------------- text ----------------
export function typeText(ctx, text, x, y, start, f, o = {}) { // letters appear every `per` frames and grow in
  const size = o.size || 96, per = o.per ?? 3.4, font = o.font || 'Poppins-ExtraBold'; ctx.save(); ctx.font = `${size}px ${font}`; ctx.textBaseline = 'alphabetic';
  const total = ctx.measureText(text).width; let cx = o.align === 'left' ? x : x - total / 2; const alpha = o.alpha ?? 1; const kern = o.kern ? lerp(-0.35, 0, easeOut(prog(f, start, start + 12))) : 0;
  for (let i = 0; i < text.length; i++) { const ch = text[i]; const wch = ctx.measureText(ch).width; const t0 = start + i * per; const s = f < t0 ? 0 : 0.4 + 0.6 * easeOut((f - t0) / 3);
    if (s > 0 && ch !== ' ') { ctx.save(); ctx.translate(cx + wch / 2, y); ctx.scale(s, s); ctx.globalAlpha = alpha;
      ctx.shadowColor = o.shadow || 'rgba(20,20,30,0.75)'; ctx.shadowBlur = o.shadowBlur ?? 10; ctx.shadowOffsetX = o.shOff ?? 4; ctx.shadowOffsetY = o.shOff ?? 6;
      if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 26; ctx.shadowOffsetX = ctx.shadowOffsetY = 0; }
      if (o.stroke) { ctx.lineWidth = o.strokeW || 8; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(ch, -wch / 2, 0); }
      ctx.fillStyle = o.color || '#fff'; ctx.fillText(ch, -wch / 2, 0); ctx.restore(); }
    cx += wch * (1 + kern); }
  ctx.restore(); return total;
}
export function glowText(ctx, text, x, y, size, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(o.scale ?? 1, o.scale ?? 1); ctx.globalAlpha = o.alpha ?? 1;
  ctx.font = `${size}px ${o.font || 'Poppins-Black'}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; if (o.blur) ctx.filter = `blur(${o.blur}px)`;
  for (const [b, c] of o.glows || [[60, '#ff2a1a'], [25, '#ff6a00']]) { ctx.shadowColor = c; ctx.shadowBlur = b; ctx.fillStyle = c; ctx.fillText(text, 0, 0); }
  ctx.shadowBlur = 0; if (o.stroke) { ctx.lineWidth = o.strokeW || 10; ctx.strokeStyle = o.stroke; ctx.strokeText(text, 0, 0); }
  ctx.fillStyle = o.color || '#fff'; ctx.fillText(text, 0, 0); ctx.restore();
}
export function drawCaption(ctx, f) {
  const c = A.captions.find(([a, b]) => f >= a && f < b); if (!c) return;
  ctx.save(); ctx.font = '46px Poppins-Bold'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.strokeText(c[2], W / 2, 1490); ctx.fillStyle = '#fff'; ctx.fillText(c[2], W / 2, 1490); ctx.restore();
}
export function drawWatermark(ctx, f) { if (f < 6 || !CFG.watermark) return; ctx.save(); ctx.font = '40px Poppins-SemiBold'; ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 6; ctx.fillText(CFG.watermark, 34, 1880); ctx.restore(); }

// ---------------- sprites ----------------
export function sprite(ctx, name, x, y, h, o = {}) {
  const im = A.img[name]; if (!im) return; const s = (o.scale ?? 1); if (s <= 0) return; const w = h * im.width / im.height;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s * (o.flip ? -1 : 1), s); ctx.globalAlpha = o.alpha ?? 1; if (o.filter) ctx.filter = o.filter;
  if (o.shadow) { ctx.save(); ctx.translate(o.shadow[0], o.shadow[1]); ctx.filter = 'brightness(0) blur(6px)'; ctx.globalAlpha = (o.alpha ?? 1) * 0.35; ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore(); }
  else { ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 5; }
  ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
}

// ---------------- clouds ----------------
const CL = []; function buildClouds() { for (let k = 0; k < 6; k++) { const c = document.createElement('canvas'); c.width = 700; c.height = 420; const g = c.getContext('2d');
  for (let i = 0; i < 40; i++) { const x = 120 + rnd(k * 100 + i) * 460, y = 140 + rnd(k * 50 + i * 7) * 160, r = 50 + rnd(i * 13 + k) * 90; const gr = g.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.7)'); gr.addColorStop(0.55, 'rgba(240,244,250,0.45)'); gr.addColorStop(1, 'rgba(200,210,225,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } CL.push(c); } }
export function cloudDive(ctx, p) { if (p >= 1 || p < 0) return; ctx.save(); for (let i = 0; i < 26; i++) { const depth = 0.15 + rnd(i * 9.1) * 0.85; const z = depth - p * 1.05; if (z <= 0.02) continue; const s = 0.9 / z; const x = W / 2 + (rnd(i * 3.3) - 0.5) * 900 / z, y = H / 2 + (rnd(i * 5.7) - 0.5) * 1320 / z; ctx.globalAlpha = clamp((z - 0.02) * 4) * clamp((1.1 - z) * 2); const c = CL[i % CL.length]; ctx.drawImage(c, x - c.width * s / 2, y - c.height * s / 2, c.width * s, c.height * s); } ctx.restore(); }
