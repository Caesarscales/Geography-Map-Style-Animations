// Beat-list interpreter: turns a project's beats.json into frames. See docs/BEATS.md for every beat type.
import * as G from './core.js';
const { W, H, FPS, clamp, lerp, ease, easeOut, easeIn, prog, pop, rnd, toScreen, track, mix } = G;

export const P = { meta: {}, words: [], beats: [], camKeys: [], scenes: [], sfx: [], total: 0 };

// ---------- time & position helpers ----------
function sec(v, words) { // number (s) | "w12" (start of word 12) | "w12+0.3" | "w12e" (end of word 12)
  if (typeof v === 'number') return v; if (v == null) return null; const m = String(v).match(/^w(\d+)(e?)([+-][\d.]+)?$/); if (!m) return parseFloat(v);
  const w = words[Math.min(+m[1], words.length - 1)]; return (m[2] ? w[1] : w[0]) + (m[3] ? parseFloat(m[3]) : 0);
}
const fr = (s) => Math.round(s * FPS);
function pos(at, f) { // -> [x,y] screen
  if (at == null) return [W / 2, H / 2];
  if (at.screen) return at.screen; if (at.follow) { const b = P.byId[at.follow]; return b && b._pos ? b._pos : [W / 2, H / 2]; }
  const r = G.lookup(at.place || at); let [x, y] = toScreen(r.lon + (at.dlon || 0), r.lat + (at.dlat || 0)); if (at.dx) x += at.dx; if (at.dy) y += at.dy; return [x, y];
}
const geo = (at) => { const r = G.lookup(at.place || at); return [r.lon + (at.dlon || 0), r.lat + (at.dlat || 0)]; };
const sizeAt = (b, base) => (b.size || base) * (b.scaleWithZoom === false ? 1 : G.zoomScale(b.zoomRef || 40, b.minScale ?? 0.45, b.maxScale ?? 1.8));

// ---------- load ----------
export async function load(project) {
  const J = async (p) => (await fetch(p)).json();
  const spec = await J(`${project}/beats.json`); P.meta = spec.meta || {}; P.words = await J(`${project}/${P.meta.words || 'words.json'}`).catch(() => []);
  G.CFG.watermark = P.meta.watermark ?? '';
  await G.loadCore({ regions: P.meta.regions });
  // captions
  try { G.A.captions = await J(`${project}/captions.json`); } catch { G.A.captions = []; }
  P.total = fr(P.meta.duration || (P.words.length ? P.words[P.words.length - 1][1] + 1.2 : 60));
  // beats
  P.byId = {}; let idn = 0;
  P.beats = (spec.beats || []).map((b, i) => { b = { ...b }; b.id = b.id || `b${idn++}`; b.s = fr(sec(b.t, P.words) ?? 0);
    const end = b.until != null ? fr(sec(b.until, P.words)) : b.dur != null ? b.s + fr(b.dur) : null; b.e = end ?? (PERSIST.has(b.type) ? P.total + 99 : b.s + fr(DEFAULT_DUR[b.type] ?? 2.2)); b.order = i; P.byId[b.id] = b; return b; });
  P.scenes = P.beats.filter(b => b.type === 'scene');
  // assets
  const sprites = new Set(); const flags = new Set(); const imgs = new Set();
  for (const b of P.beats) { if (b.sprite) sprites.add(b.sprite); if (b.chibi) sprites.add(b.chibi); if (b.flag) flags.add(b.flag); if (b.flags) b.flags.forEach(x => flags.add(x.code || x)); if (b.image) imgs.add(b.image); if (b.icon && /\.(png|jpg|svg)$/.test(b.icon)) imgs.add(b.icon); }
  await Promise.all([...sprites].map(s => G.loadImg(s, `${project}/sprites/${s}.png`).then(r => r || G.loadImg(s, `../chibi/library/${s}.png`))));
  await Promise.all([...flags].map(c => G.loadFlag(c))); await Promise.all([...imgs].map(i => G.loadImg(i, `${project}/${i}`)));
  // camera
  buildCamera(spec.camera || []);
  P.sfx = collectSfx();
}
const PERSIST = new Set(['fill', 'skin', 'label', 'flag', 'pin', 'line', 'front', 'chibi', 'sprite', 'maplabel', 'hatch', 'cutout']);
const DEFAULT_DUR = { date: 1.9, title: 2.4, firetitle: 2.6, neon: 2.0, bubble: 2.2, badge: 2.4, document: 2.6, calendar: 2.0, stamp: 1.6, whip: 0.6, flash: 0.5, explosions: 2.0, ring: 1.4, lens: 1.8, scribble: 2.0, arrow: 2.2, reticle: 1.0, googly: 3.0, vignette: 2.0, focus: 3.0, clouds: 0.8, endcard: 2.0, fire: 3.0, scene: 5.0, tag: 3.0, emblem: 3.0, question: 1.8 };

// ---------- camera ----------
function fitPpd(bbox, frac = 0.78) { const [x0, y0, x1, y1] = bbox; const wdeg = Math.max(x1 - x0, 0.3); const hfrac = Math.max(my2(y0) - my2(y1), 0.0005); return Math.min(W * frac / wdeg, H * 0.55 / (hfrac * 360)); }
const my2 = (lat) => G.my(lat);
function buildCamera(keys) {
  let prevLon = null; P.camKeys = keys.map(k => { const f = fr(sec(k.t, P.words)); const r = G.lookup(k.at.place || k.at); let lon = r.lon + (k.dlon || 0), lat = r.lat + (k.dlat || 0);
    if (prevLon != null) lon += 360 * Math.round((prevLon - lon) / 360); prevLon = lon;
    let ppd = k.zoom || (r.bbox ? fitPpd(r.bbox, k.fit || 0.78) : 40); return [f, lon, lat, ppd, (k.rot || 0) * Math.PI / 180]; }).sort((a, b) => a[0] - b[0]);
  P.camFollow = keys.filter(k => k.follow).map(k => ({ s: fr(sec(k.t, P.words)), e: fr(sec(k.until, P.words)), id: k.follow, ppd: k.zoom }));
  if (!P.camKeys.length) P.camKeys = [[0, 0, 20, 4, 0]];
}
export function camera(f) {
  let [lon, lat, ppd, rot] = track(P.camKeys, f, P.meta.drift ?? 1);
  for (const c of P.camFollow) if (f >= c.s - 12 && f <= c.e + 12) { const b = P.byId[c.id]; if (!b || !b._geo) continue; const k = Math.min(prog(f, c.s - 12, c.s), 1 - prog(f, c.e, c.e + 12)); lon = lerp(lon, b._geo[0], k); lat = lerp(lat, b._geo[1], k); if (c.ppd) ppd = Math.exp(lerp(Math.log(ppd), Math.log(c.ppd), k)); }
  return [lon, lat, ppd, rot];
}

// ---------- frame ----------
const LAYER = { ghost: 3, skin: 0, clouds: 9, fill: 1, cutout: 1, hatch: 1, front: 2, focus: 2, line: 3, arrow: 3, ring: 4, pin: 4, flag: 4, sprite: 4, chibi: 4, explosions: 4, fire: 4, reticle: 5, lens: 5, scribble: 5, googly: 5, label: 5, maplabel: 5, tag: 5, emblem: 6, bubble: 6, badge: 6, date: 7, title: 7, firetitle: 7, neon: 7, document: 7, calendar: 7, stamp: 7, question: 6, endcard: 8, vignette: 8, flash: 9, whip: 10 };
export function drawFrame(ctx, f) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); const t = f / FPS;
  const [lon, lat, ppd, rot] = camera(f); G.setCam(lon, lat, ppd, rot);
  // pre-pass: positions of moving things (for camera follow / tags)
  for (const b of P.beats) if (b.type === 'sprite' && b.path && f >= b.s - 15 && f <= b.e + 15) { const g = pathGeo(b, f); b._geo = g; }
  const scene = P.scenes.find(s => f >= s.s && f < s.e);
  if (scene) { drawScene(ctx, scene, f, t); } else {
    const active = P.beats.filter(b => b.type !== 'scene' && !b.inScene && f >= b.s && f < b.e + (b.out ?? 8)).sort((a, b) => (a.layer ?? LAYER[a.type] ?? 5) - (b.layer ?? LAYER[b.type] ?? 5) || a.order - b.order);
    drawSkins(ctx, f);
    for (const b of active) { const fn = FX[b.type]; if (fn && b.type !== 'skin') { ctx.save(); try { fn(ctx, b, f, t); } catch (e) { console.log('beat error', b.type, e.message); } ctx.restore(); } }
  }
  // scene transitions (zoom blur in/out etc.)
  for (const s of P.scenes) sceneTransition(ctx, s, f);
  G.drawCaption(ctx, f); G.drawWatermark(ctx, f);
}

// ---------- skins ----------
function drawSkins(ctx, f) { drawSkinsInner(ctx, f); ctx.save(); ctx.fillStyle = 'rgba(25,45,70,0.09)'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
function drawSkinsInner(ctx, f) {
  const sk = P.beats.filter(b => b.type === 'skin' && b.s <= f).sort((a, b) => a.s - b.s); if (!sk.length) { G.drawSkin(ctx, 'atlas', 1); G.paper(ctx, 0.55); return; }
  const cur = sk[sk.length - 1], prev = sk[sk.length - 2]; const dur = fr(cur.trans_dur ?? 0.35); const p = cur.transition === 'cut' ? 1 : easeOut(prog(f, cur.s, cur.s + dur));
  const paperA = (k) => (k === 'atlas' || k === 'old' || k === 'minimal' || k === 'paperwhite' ? 0.55 : k === 'grey' ? 0.35 : 0);
  if (prev && p < 1) { G.drawSkin(ctx, prev.kind, 1); G.paper(ctx, paperA(prev.kind)); }
  if (p >= 1 || !prev) { G.drawSkin(ctx, cur.kind, 1); G.paper(ctx, paperA(cur.kind)); return; }
  ctx.save(); ctx.beginPath(); const tr = cur.transition || 'fade';
  if (tr === 'fade') { ctx.restore(); G.drawSkin(ctx, cur.kind, p); G.paper(ctx, paperA(cur.kind) * p); return; }
  if (tr === 'wipe') { const a = (cur.angle ?? 135) * Math.PI / 180, d = Math.hypot(W, H); const e = (p * 1.2 - 0.6) * d; ctx.translate(W / 2 + Math.cos(a) * e, H / 2 + Math.sin(a) * e); ctx.rotate(a); ctx.rect(-d * 3, -d * 2, d * 3, d * 4); ctx.setTransform(1, 0, 0, 1, 0, 0); }
  if (tr === 'blob') { const o = cur.origin ? pos(cur.origin, f) : [W * 0.2, H * 0.8]; const blobs = [[0, 0, 1], [W * 0.18, H * 0.08, 0.8], [-W * 0.12, -H * 0.15, 0.7], [W * 0.22, -H * 0.12, 0.6]]; for (const [dx, dy, br] of blobs) G.blobPath(ctx, o[0] + dx, o[1] + dy, br * p * 2100, dx + 3, 64, 0.12); }
  if (tr === 'iris') { const o = cur.origin ? pos(cur.origin, f) : [W / 2, H / 2]; ctx.arc(o[0], o[1], p * 2200, 0, 7); }
  if (tr === 'shrink') { const o = cur.origin ? pos(cur.origin, f) : [W / 2, H / 2]; ctx.restore(); G.drawSkin(ctx, cur.kind, 1); G.paper(ctx, paperA(cur.kind)); ctx.save(); ctx.beginPath(); G.blobPath(ctx, o[0], o[1], (1 - p) * 2100 + 10, 4.2, 64, 0.16); ctx.clip(); G.drawSkin(ctx, prev.kind, 1); G.paper(ctx, paperA(prev.kind)); ctx.restore(); return; }
  ctx.clip(); G.drawSkin(ctx, cur.kind, 1); G.paper(ctx, paperA(cur.kind)); ctx.restore();
  if (tr === 'wipe') { ctx.save(); const g = ctx.createLinearGradient(0, 0, W, H); const k = p; g.addColorStop(clamp(k - 0.1), 'rgba(255,255,255,0)'); g.addColorStop(clamp(k), `rgba(255,250,235,${0.4 * Math.sin(p * Math.PI)})`); g.addColorStop(clamp(k + 0.1), 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}

// ---------- effects ----------
const exitP = (b, f, n = 8) => 1 - prog(f, b.e, b.e + (b.out ?? n));
const FX = {
  clouds(ctx, b, f) { G.cloudDive(ctx, prog(f, b.s, b.e)); },
  fill(ctx, b, f, t) { // style: fade | flash | spread | wipe ; recolor by adding a later fill on the same target
    const keys = [].concat(b.target).map(G.keyOf).filter(Boolean); const a = (b.alpha ?? 0.92) * exitP(b, f, 8); const st = b.style || 'flash';
    // a later fill on the same target replaces this one once its own flash reaches white
    const later = P.beats.find(o => o.type === 'fill' && o.s > b.s && o.s <= f - 5 && [].concat(o.target).some(x => keys.includes(G.keyOf(x)))); if (later) return;
    const o = { alpha: a, hatch: b.hatch, hatchColor: b.hatchColor, glow: b.glow, glowBlur: b.glowBlur, stroke: b.stroke, strokeW: b.strokeW, strokeGlow: b.strokeGlow };
    for (const k of keys) {
      if (st === 'fade') { G.fillShape(ctx, k, b.color, { ...o, alpha: a * easeOut(prog(f, b.s, b.s + fr(b.in ?? 0.3))) }); continue; }
      if (st === 'flash') { const d = f - b.s; // border trace -> white -> pale -> color (~14 f)
        if (d < 5) { G.fillShape(ctx, k, '#ffffff', { alpha: 0.25 + d * 0.12, stroke: b.traceColor || '#FFE34A', strokeW: 5, strokeGlow: 18 }); continue; }
        if (d < 9) { G.fillShape(ctx, k, '#ffffff', { alpha: 0.96, glow: 'rgba(255,255,255,0.9)', glowBlur: 40 }); continue; }
        const p = easeOut(prog(d, 9, 15)); G.fillShape(ctx, k, mix('#ffffff', b.color, 0.35 + 0.65 * p), o); continue; }
      if (st === 'spread') { const p = easeOut(prog(f, b.s, b.s + fr(b.in ?? 0.8))); const og = b.origin ? pos(b.origin, f) : pos(k, f); ctx.save(); ctx.beginPath(); G.blobPath(ctx, og[0], og[1], p * (b.radius || 1500), (b.order || 1) * 1.7, 72, 0.22); ctx.clip(); G.fillShape(ctx, k, b.color, o); ctx.restore(); continue; }
      if (st === 'wipe') { const p = easeOut(prog(f, b.s, b.s + fr(b.in ?? 0.5))); const a2 = (b.angle ?? 90) * Math.PI / 180; ctx.save(); ctx.beginPath(); const d = Math.hypot(W, H); const e = (p * 1.2 - 0.6) * d; ctx.translate(W / 2 + Math.cos(a2) * e, H / 2 + Math.sin(a2) * e); ctx.rotate(a2); ctx.rect(-d * 3, -d * 2, d * 3, d * 4); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clip(); G.fillShape(ctx, k, b.color, o); ctx.restore(); continue; }
      if (st === 'pulse') { const p = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / (b.period || 0.8)); G.fillShape(ctx, k, mix(b.color, b.color2 || '#ffffff', p), o); continue; }
    }
  },
  cutout(ctx, b, f) { // land piece as a lifted satellite cutout (blueprint scenes)
    const k = G.keyOf(b.target); const a = easeOut(prog(f, b.s, b.s + 8)) * exitP(b, f); const lift = (b.lift ?? 14) * a;
    ctx.save(); ctx.globalAlpha = a * 0.45; ctx.filter = 'blur(10px)'; ctx.translate(lift, lift * 1.6); G.fillShape(ctx, k, '#000', {}); ctx.restore();
    ctx.save(); ctx.translate(-lift * 0.3, -lift * 0.6); ctx.beginPath(); G.clipShape(ctx, k); G.drawSkin(ctx, b.skin || 'sat', a); if (b.color) G.fillShape(ctx, k, b.color, { alpha: (b.alpha ?? 0.5) * a, stroke: b.stroke || '#ffffff', strokeW: 3, strokeGlow: b.strokeGlow ?? 16, hatch: b.hatch }); ctx.restore();
  },
  front(ctx, b, f) { // color bleeding into a target from a direction (moving front line). progress keyframes: [[t, 0..1], ...]
    const k = G.keyOf(b.target); const ks = (b.progress || [[b.t, 0], [b.until ?? b.t + 2, 1]]).map(([tt, v]) => [fr(sec(tt, P.words)), v]); let p = ks[0][1];
    for (let i = 0; i < ks.length - 1; i++) if (f >= ks[i][0]) p = lerp(ks[i][1], ks[i + 1][1], ease(prog(f, ks[i][0], ks[i + 1][0]))); const [ax, ay] = pos(b.from, f), [bx, by] = pos(b.to, f);
    const fx = lerp(ax, bx, p), fy = lerp(ay, by, p); ctx.save(); ctx.beginPath(); G.clipShape(ctx, k); const g = ctx.createLinearGradient(ax, ay, fx + (bx - ax) * 0.12, fy + (by - ay) * 0.12);
    g.addColorStop(0, b.color); g.addColorStop(0.85, b.color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = (b.alpha ?? 0.92) * exitP(b, f); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  },
  focus(ctx, b, f) { // grey out everything except the targets, plus vignette
    const a = prog(f, b.s, b.s + 10) * exitP(b, f, 10); const k = 360 * G.cam.ppd; const clip = new Path2D(); clip.rect(0, 0, W, H);
    for (const tg of [].concat(b.target || [])) { const key = G.keyOf(tg); const p = G.shapeOf(key); if (!p) continue; const m = new DOMMatrix().translate(W / 2, H / 2).rotate(G.cam.rot * 57.2958).scale(k, k).translate(-G.ux(G.cam.lon) + G.wrapOff(key), -G.my(G.cam.lat)); clip.addPath(p, m); }
    ctx.save(); ctx.clip(clip, 'evenodd'); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(20,25,35,${0.25 * a})`; ctx.fillRect(0, 0, W, H); ctx.restore(); vign(ctx, a * 0.7);
  },
  line(ctx, b, f) { // draw-on glowing line along points / river name; ring at the tip
    let pts = b.points ? b.points.map(p => geo(p)) : riverGeo(b.river); if (!pts.length) return; const p = ease(prog(f, b.s, b.s + fr(b.in ?? 1.2))); const a = exitP(b, f);
    const n = Math.max(2, Math.ceil(pts.length * p)); const sp = pts.slice(0, n).map(g => toScreen(...g)); if (b.curve) { /* smooth path */ }
    ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowColor = b.glow || b.color || '#fff'; ctx.shadowBlur = 16; ctx.strokeStyle = b.color || '#ffffff'; ctx.lineWidth = b.width || 7;
    if (b.dash) ctx.setLineDash(b.dash); ctx.beginPath(); sp.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.restore();
    if (p < 1 || b.tipRing) { const [x, y] = sp[sp.length - 1]; G.cam && ring(ctx, x, y, 24 + 6 * Math.sin(f / 3), b.tipColor || '#FFE34A', a, 6); }
  },
  arrow(ctx, b, f) { // curved arrow from -> to, head-first draw, comet tail
    const p = easeOut(prog(f, b.s, b.s + fr(b.in ?? 0.7))); const a = exitP(b, f, 10); const g0 = geo(b.from), g1 = geo(b.to); const bend = b.bend ?? 0.25; const tail = b.tail ?? 1;
    const L = (q) => { const x = lerp(g0[0], g1[0], q), y = lerp(g0[1], g1[1], q); const dx = g1[0] - g0[0], dy = g1[1] - g0[1]; return [x - dy * bend * Math.sin(q * Math.PI), y + dx * bend * Math.sin(q * Math.PI)]; };
    const q0 = Math.max(0, p - tail), mid = (p + q0) / 2; arrowDraw(ctx, [toScreen(...L(q0)), toScreen(...L(mid)), toScreen(...L(p))], { width: b.width || 24, alpha: a, color: b.color || '#ffffff' });
  },
  ring(ctx, b, f) { const [x, y] = pos(b.at, f); const n = b.count || 2; const R = b.radius || 160; for (let i = 0; i < n; i++) { const rp = prog(f, b.s + i * 7, b.s + i * 7 + fr(b.grow ?? 0.9)); ring(ctx, x, y, 14 + rp * R, b.color || '#ff2a2a', (1 - rp) * 0.95, 10 * (1 - rp) + 3); } },
  pin(ctx, b, f) { const [x, y] = pos(b.at, f); const s = sizeAt(b, 1.1) * exitP(b, f); pinDraw(ctx, x, y, s, b.s, f, b.color); if (b.label) G.typeText(ctx, b.label, x + (b.labelDx || 0), y - 105 * s, b.s + 3, f, { size: b.labelSize || 62, per: 2, stroke: b.labelStroke, color: b.labelColor || '#fff' }); if (b.rings !== false) FX.ring(ctx, { ...b, s: b.s + 4, count: 2, radius: 120 * s }, f); },
  flag(ctx, b, f, t) { const [x, y] = pos(b.at, f); const w = sizeAt(b, 120); const tilt = lerp((b.tilt ?? -20) * Math.PI / 180, 0, ease(prog(f, b.s, b.s + 16))); G.drawFlag(ctx, b.flag, x, y, w, t + b.order, { tilt, scale: pop(f, b.s, 7) * (b.exit === 'shrink' ? 1 - easeIn(prog(f, b.e, b.e + 5)) : 1), alpha: b.exit === 'shrink' ? 1 : exitP(b, f) }); },
  label(ctx, b, f, t) { // country label: flag above + typed heavy white text; follows the map
    const [x, y] = pos(b.at, f); const sc = G.zoomScale(b.zoomRef || 40, b.minScale ?? 0.4, b.maxScale ?? 1.25) * (b.scale || 1); const a = exitP(b, f, 6);
    if (b.flag) G.drawFlag(ctx, b.flag, x, y - 150 * sc, 190 * sc, t + b.order, { tilt: lerp(-0.35, 0, ease(prog(f, b.s, b.s + 16))), scale: pop(f, b.s - 2, 7), alpha: a });
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); G.typeText(ctx, b.text, 0, 0, b.s, f, { size: b.fontSize || 124, per: b.per ?? 3.4, alpha: a, color: b.color || '#fff', font: b.font, kern: b.kern, stroke: b.stroke }); ctx.restore();
  },
  maplabel(ctx, b, f) { // sea / region name lying on the map (serif italic, curved optional)
    const [x, y] = pos(b.at, f); const sc = G.zoomScale(b.zoomRef || 40, 0.35, 3); const a = easeOut(prog(f, b.s, b.s + 10)) * exitP(b, f);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate((b.rot || 0) * Math.PI / 180); ctx.scale(sc, sc); ctx.font = `${b.fontSize || 54}px ${b.font || 'Baskerville-Italic'}`; ctx.textAlign = 'center';
    if (b.curve) { curved(ctx, b.text, 0, b.curve, b.fontSize || 54, b.color || '#2B4A66', Math.floor((f - b.s) / (b.per ?? 1.5)), b.stroke); } else { if (b.stroke) { ctx.lineWidth = 6; ctx.strokeStyle = b.stroke; ctx.strokeText(b.text, 0, 0); } ctx.fillStyle = b.color || '#2B4A66'; ctx.fillText(b.text.slice(0, Math.floor((f - b.s) / (b.per ?? 1.2)) + 1), 0, 0); }
    ctx.restore();
  },
  tag(ctx, b, f) { const [x, y] = pos(b.at, f); tagDraw(ctx, b.text, x + (b.dx || 0), y + (b.dy || 0), b.s, f, b.side === 'left' ? -1 : 1, { bg: b.bg, fg: b.fg, size: b.fontSize || 40, alpha: exitP(b, f) }); },
  sprite(ctx, b, f) { // prop: planes, ships, guns... at a place or moving along a path
    let x, y, rot = (b.rot || 0) * Math.PI / 180; if (b.path) { const g = b._geo || pathGeo(b, f); [x, y] = toScreen(...g); if (b.faceMotion !== false) { const g2 = pathGeo(b, f + 1); const [x2, y2] = toScreen(...g2); if (Math.hypot(x2 - x, y2 - y) > 0.2) rot = Math.atan2(y2 - y, x2 - x) + (b.headingOffset ?? 90) * Math.PI / 180; } } else [x, y] = pos(b.at, f);
    b._pos = [x, y]; const h = sizeAt(b, 160); const ent = b.entrance === 'none' ? 1 : pop(f, b.s, 7); const ex = b.exit === 'fly' ? 1 + easeIn(prog(f, b.e, b.e + 8)) * 3 : 1 - easeIn(prog(f, b.e, b.e + 5));
    const alt = b.altitude ? b.altitude * h / 160 : 0; G.sprite(ctx, b.sprite, x, y, h, { scale: ent * ex, rot, flip: b.flip, shadow: alt ? [alt, alt * 1.4] : null, alpha: ex > 1 ? 2 - ex / 2 : 1 });
  },
  chibi(ctx, b, f, t) { // squad of chibi characters popping in one by one
    const [x, y] = pos(b.at, f); const h = sizeAt(b, 150); const n = b.count || 1; const gap = b.gap ?? 0.55; const step = b.step ?? 2; const ex = 1 - easeIn(prog(f, b.e, b.e + 6));
    for (let i = 0; i < n; i++) { const bob = Math.sin(t * 5 + i * 1.3) * h * 0.02; const sx = x + (i - (n - 1) / 2) * h * gap + (b.rows ? 0 : 0), sy = y + (i % 2) * h * 0.04 + bob;
      let sc = 1; if (b.entrance === 'slide') { const p = easeOut(prog(f, b.s + i * step, b.s + i * step + 10)); G.sprite(ctx, b.chibi, lerp(W + 200, sx, p), sy, h, { flip: b.flip, scale: ex }); continue; }
      sc = pop(f, b.s + i * step, 6) * ex; G.sprite(ctx, b.chibi, sx, sy, h, { scale: sc, flip: b.flip }); }
    b._pos = [x, y];
  },
  emblem(ctx, b, f, t) { const [x, y] = pos(b.at, f); const s = sizeAt(b, 120) * pop(f, b.s, 7) * exitP(b, f); if (b.icon === 'un') unEmblem(ctx, x, y, s, Math.sin(t * 2) * 0.15); else G.sprite(ctx, b.icon, x, y, s * 2, {}); },
  bubble(ctx, b, f) { const [x, y] = pos(b.at, f); const s = pop(f, b.s, 6) * exitP(b, f, 6) * (b.scale || 1); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 12;
    const lines = [].concat(b.text); ctx.font = `${b.fontSize || 46}px Poppins-Bold`; const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 80, h = lines.length * 58 + 60;
    ctx.beginPath(); ctx.ellipse(0, 0, w / 2 + 20, h / 2 + 10, 0, 0, 7); ctx.fill(); ctx.beginPath(); const sd = b.tail === 'right' ? 1 : -1; ctx.moveTo(sd * w * 0.25, h * 0.3); ctx.lineTo(sd * w * 0.42, h * 0.75); ctx.lineTo(sd * w * 0.05, h * 0.42); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#111'; ctx.textAlign = 'center'; let n = Math.floor((f - b.s - 2) * (b.cps ?? 1.1)); lines.forEach((l, i) => { ctx.fillText(l.slice(0, Math.max(0, n)), 0, -h / 2 + 70 + i * 58); n -= l.length; }); },
  badge(ctx, b, f) { const [x, y] = pos(b.at, f); badgeDraw(ctx, x, y, b.scale || 1, b.icon, b.number, b.s, f, b.label, exitP(b, f, 6), b.crossAfter != null ? { crossAfter: fr(b.crossAfter) } : null); },
  explosions(ctx, b, f) { const [cx, cy] = pos(b.at, f); const R = b.radius || 200; const n = b.count || 8; for (let i = 0; i < n; i++) { const s0 = b.s + i * (b.stagger ?? 3.5); const ex = cx + (rnd(i * 11 + b.order) - 0.5) * 2 * R, ey = cy + (rnd(i * 5 + b.order) - 0.5) * 2 * R * 0.8; explosion(ctx, ex, ey, (b.size || 90) * (0.7 + rnd(i) * 0.6), (f - s0) / 30); } },
  fire(ctx, b, f, t) { // flames along points/area + rising embers + bottom smoke band
    const pts = b.points ? b.points.map(p => pos(p, f)) : [pos(b.at, f)]; const a = prog(f, b.s, b.s + 8) * exitP(b, f, 10);
    for (const [i, [x, y]] of pts.entries()) flame(ctx, x, y, (b.size || 60), t + i, a);
    if (b.embers !== false) { ctx.save(); ctx.globalAlpha = a; for (let i = 0; i < 40; i++) { const ex = (rnd(i) * W + f * (2 + rnd(i * 2) * 3)) % W, ey = (rnd(i * 3) * H - f * (3 + rnd(i * 5) * 4)) % H; ctx.fillStyle = `rgba(255,${80 + rnd(i) * 80},40,${0.5 + rnd(i * 4) * 0.4})`; ctx.fillRect(ex, (ey + H) % H, 4, 4); } ctx.restore(); }
    if (b.smoke) { ctx.save(); const g = ctx.createLinearGradient(0, H * 0.7, 0, H); g.addColorStop(0, 'rgba(40,30,30,0)'); g.addColorStop(1, `rgba(40,30,30,${0.75 * a})`); ctx.fillStyle = g; ctx.fillRect(0, H * 0.7, W, H * 0.3); ctx.restore(); }
  },
  lens(ctx, b, f) { const [x, y] = pos(b.at, f); const p = easeOut(prog(f, b.s, b.s + 15)) * exitP(b, f, 8); const r = p * (b.radius || 120); ctx.save(); ctx.shadowColor = '#ff3030'; ctx.shadowBlur = 40; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore(); },
  scribble(ctx, b, f) { const [x, y] = pos(b.at, f); const p = easeOut(prog(f, b.s, b.s + 12)); const a = exitP(b, f); const R = sizeAt(b, 140); ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = b.color || '#FFD21F'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 6;
    ctx.beginPath(); for (let i = 0; i <= 80 * p; i++) { const a2 = i / 80 * Math.PI * 4.1 + f * 0.02; const rr = R * (1 + 0.06 * Math.sin(i * 0.7)); ctx.lineTo(x + Math.cos(a2) * rr * 1.25, y + Math.sin(a2) * rr * 0.8); } ctx.stroke(); ctx.restore(); },
  reticle(ctx, b, f) { const [x, y] = pos(b.at, f); const s = pop(f, b.s, 6) * exitP(b, f, 6); const r = 70 * s; ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.shadowColor = '#000'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.beginPath(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(x + dx * r * 0.55, y + dy * r * 0.55); ctx.lineTo(x + dx * r * 1.3, y + dy * r * 1.3); } ctx.stroke(); ctx.restore(); },
  googly(ctx, b, f, t) { const [x, y] = pos(b.at, f); const s = sizeAt(b, 46) * pop(f, b.s, 6) * exitP(b, f); for (const sx of [-1, 1]) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#222'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x + sx * s * 1.1, y, s, 0, 7); ctx.fill(); ctx.stroke(); const lx = Math.sin(t * 3 + sx) * s * 0.3 + (b.look ? b.look[0] * s * 0.35 : 0), ly = Math.cos(t * 2.3) * s * 0.2 + (b.look ? b.look[1] * s * 0.35 : 0); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + sx * s * 1.1 + lx, y + ly, s * 0.45, 0, 7); ctx.fill(); } },
  question(ctx, b, f, t) { const [x, y] = pos(b.at, f); const s = pop(f, b.s, 7) * exitP(b, f); for (let i = 0; i < 3; i++) G.glowText(ctx, '?', x + (i - 1) * 70 * s, y + Math.sin(t * 6 + i) * 10 - (i === 1 ? 30 : 0), 150 * s, { glows: [[10, 'rgba(0,0,0,0.4)']], color: '#E42D2D', stroke: '#fff', strokeW: 10, rot: (i - 1) * 0.25 }); },
  date(ctx, b, f) { // big date slam: digits zoom in from the lens one by one, hold, fly past the camera
    const st = DATE_STYLES[b.style || 'neon']; const txt = String(b.text); const per = b.per ?? 3; const out = easeIn(prog(f, b.e - 10, b.e)); const drift = prog(f, b.s + txt.length * per + 4, b.e - 10);
    const y0 = b.y ?? 430; ctx.save(); ctx.translate(W / 2 - 30 * drift, y0 - 40 * drift - out * 800); ctx.rotate(((b.tilt ?? -3) * Math.PI / 180) * drift - out * 0.3); ctx.scale(1 + out * 2.4, 1 + out * 2.4); ctx.globalAlpha = 1 - out * 0.6;
    const size = b.fontSize || 210; ctx.font = `${size}px ${st.font}`; let x = -ctx.measureText(txt).width / 2;
    for (let i = 0; i < txt.length; i++) { const w = ctx.measureText(txt[i]).width; const s0 = b.s + i * per; const p = easeOut(prog(f, s0, s0 + 6)); if (f >= s0) G.glowText(ctx, txt[i], x + w / 2 + (1 - p) * (-220 + i * 40), (1 - p) * 140, size, { scale: lerp(3.2, 1, p), blur: (1 - p) * 8, glows: st.glows, color: st.color, stroke: st.stroke, strokeW: st.strokeW, font: st.font }); x += w; }
    ctx.restore();
  },
  title(ctx, b, f) { // stacked two-tone heavy title (e.g. [["Here's The","#fff"],["Twist","#E42D2D"]]), typed, letters scatter out
    const lines = b.lines; const y0 = b.y ?? 330; const size = b.fontSize || 110; const out = prog(f, b.e, b.e + 10); let start = b.s;
    ctx.save(); ctx.translate(W / 2, y0); ctx.rotate((b.tilt ?? -4) * Math.PI / 180); ctx.transform(1, 0, (b.skew ?? -0.05), 1, 0, 0);
    lines.forEach(([text, color], li) => { ctx.font = `${size}px Poppins-Black`; const tw = ctx.measureText(text).width; let cx = -tw / 2;
      for (let i = 0; i < text.length; i++) { const ch = text[i]; const w = ctx.measureText(ch).width; const t0 = start + i * (b.per ?? 1.6); const p = easeOut(prog(f, t0, t0 + 5)); if (f >= t0 && ch !== ' ') { const sx = out * (300 + rnd(i + li * 9) * 500), sy = out * (rnd(i * 3 + li) - 0.5) * 300;
        ctx.save(); ctx.translate(cx + w / 2 + sx, li * size * 0.98 + sy); ctx.scale(lerp(1.8, 1, p), lerp(1.8, 1, p)); ctx.globalAlpha = p * (1 - out); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 8; ctx.lineWidth = 12; ctx.strokeStyle = color === '#ffffff' || color === '#fff' ? '#3A3A3A' : '#ffffff'; ctx.lineJoin = 'round'; ctx.strokeText(ch, -w / 2, 0); ctx.shadowOffsetX = ctx.shadowOffsetY = 0; ctx.fillStyle = color; ctx.fillText(ch, -w / 2, 0); ctx.restore(); }
        cx += w; } start += text.length * (b.per ?? 1.6); });
    ctx.restore();
  },
  firetitle(ctx, b, f) { const pin = easeOut(prog(f, b.s, b.s + 15)); const out = easeIn(prog(f, b.e - 8, b.e)); const y = lerp(-180, b.y ?? 330, pin) - out * 600; G.glowText(ctx, b.text, W / 2, y, b.fontSize || 150, { scale: lerp(2.2, 1, pin) + out, glows: [[70, '#ff4a10'], [24, '#ffb04a']], color: '#F6E7C8', stroke: '#5A1E08', strokeW: 6, font: 'Cinzel', alpha: 1 - out * 0.8 }); },
  neon(ctx, b, f) { const n = Math.floor((f - b.s) / (b.per ?? 2)) + 1; const out = prog(f, b.e, b.e + 8); const [x, y] = b.at ? pos(b.at, f) : [W / 2, b.y ?? 360]; G.glowText(ctx, String(b.text).slice(0, n), x + 30 * prog(f, b.s, b.e), y, b.fontSize || 110, { rot: lerp(-0.08, -0.17, prog(f, b.s, b.e)), glows: [[50, b.color || '#2AD4FF'], [18, b.color || '#2AD4FF']], color: '#fff', alpha: 1 - out }); },
  document(ctx, b, f) { docDraw(ctx, b, f); },
  ghost(ctx, b, f) { // move a country/state shape to another place at TRUE size (Mercator-corrected), e.g. Texas over Alaska
    const key = G.keyOf(b.target); const p = G.shapeOf(key); if (!p) return; const d = G.A.C[key] || G.A.S[key]; const src = b.from ? geo(b.from) : d.c; const dst = geo(b.to);
    const q = ease(prog(f, b.s, b.s + fr(b.in ?? 0.9))); const lon = lerp(src[0], dst[0], q), lat = lerp(src[1], dst[1], q); const sc = Math.cos(src[1] * Math.PI / 180) / Math.cos(lat * Math.PI / 180);
    const a = (b.alpha ?? 0.85) * prog(f, b.s, b.s + 4) * exitP(b, f); const k = 360 * G.cam.ppd; const off = -Math.round(G.ux(lon) - G.ux(G.cam.lon));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(G.cam.rot); ctx.scale(k, k); ctx.translate(-G.ux(G.cam.lon) + off, -G.my(G.cam.lat)); ctx.translate(G.ux(lon), G.my(lat)); ctx.scale(sc, sc); ctx.translate(-G.ux(src[0]), -G.my(src[1]));
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8; ctx.globalAlpha = a; ctx.fillStyle = b.color || '#F28C28'; ctx.fill(p, 'evenodd'); ctx.shadowColor = 'transparent'; ctx.lineWidth = 3 / (k * sc); ctx.strokeStyle = '#ffffff'; ctx.stroke(p); ctx.restore();
    if (b.label) { const [x, y] = toScreen(lon, lat); G.typeText(ctx, b.label, x, y + 20, b.s + 6, f, { size: b.fontSize || 54, per: 1.2, alpha: a / (b.alpha ?? 0.85) }); }
  },
  calendar(ctx, b, f) { calDraw(ctx, b, f); },
  stamp(ctx, b, f) { const [x, y] = b.at ? pos(b.at, f) : [W / 2, 900]; const p = easeOut(prog(f, b.s, b.s + 4)); const a = exitP(b, f); ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(-0.18); ctx.scale(lerp(2.5, 1, p), lerp(2.5, 1, p)); ctx.strokeStyle = '#D21F2B'; ctx.fillStyle = '#D21F2B'; ctx.lineWidth = 12; ctx.font = `${b.fontSize || 120}px Poppins-Black`; const w = ctx.measureText(b.text).width; ctx.strokeRect(-w / 2 - 30, -95, w + 60, 140); ctx.textAlign = 'center'; ctx.fillText(b.text, 0, 30); ctx.restore(); },
  vignette(ctx, b, f) { vign(ctx, prog(f, b.s, b.s + 10) * exitP(b, f, 10) * (b.strength ?? 0.8)); },
  flash(ctx, b, f) { const d = b.e - b.s; const p = f < b.s + d * 0.4 ? prog(f, b.s, b.s + d * 0.4) : 1 - prog(f, b.s + d * 0.4, b.e); const [x, y] = b.at ? pos(b.at, f) : [W / 2, H / 2]; const g = ctx.createRadialGradient(x, y, 10, x, y, b.radius || 900); g.addColorStop(0, `rgba(255,255,255,${0.95 * p})`); g.addColorStop(1, `rgba(255,255,255,${b.full ? 0.9 * p : 0})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); },
  whip(ctx, b, f) { const p = prog(f, b.s, b.e); const amt = Math.sin(p * Math.PI) * (b.strength || 70); whipBlur(ctx, amt); },
  endcard(ctx, b, f) { const p = easeOut(prog(f, b.s, b.s + 10)); const x = lerp(-120, 150, p), y = 1700; ctx.save(); ctx.translate(x, y); ctx.rotate((1 - p) * -3); unEmblem(ctx, 0, 0, 70, 0); ctx.restore(); const n = Math.floor((f - b.s - 10) / 1.5); if (n > 0) { ctx.save(); const tw = 330 * clamp(n / 9); ctx.fillStyle = '#E32626'; ctx.beginPath(); ctx.roundRect(230, 1655, tw, 90, 45); ctx.fill(); ctx.font = '58px Poppins-Black'; ctx.fillStyle = '#fff'; ctx.fillText((b.text || 'Subscribe').slice(0, n), 262, 1720); ctx.restore(); } },
};
FX.skin = () => {};

// ---------- painted scenes ----------
function drawScene(ctx, s, f, t) {
  const p = prog(f, s.s, s.e); const z = easeOut(prog(f, s.s, s.s + 10)); const push = 1 + (s.push ?? 0.25) * p; const sc = lerp(s.entry === 'zoomblur' ? 1.9 : 1, 1, z) * push * (1 + 0.02 * Math.sin(f / 31));
  const im = s.image ? G.A.img[s.image] : codeScene(s.code || 'mountains'); if (im) { const cover = Math.max(W / im.width, H / im.height) * sc; ctx.save(); ctx.translate(W / 2 - (s.pan ?? -120) * -p + Math.sin(f / 23) * 20, H / 2); ctx.scale(cover, cover); ctx.drawImage(im, -im.width / 2, -im.height / 2); ctx.restore(); }
  const inside = P.beats.filter(b => b.inScene === s.id && f >= b.s && f < b.e + 10).sort((a, b) => (LAYER[a.type] ?? 5) - (LAYER[b.type] ?? 5) || a.order - b.order);
  for (const b of inside) { const fn = FX[b.type]; if (fn) { ctx.save(); try { fn(ctx, b, f, t); } catch (e) { console.log('scene beat error', b.type, e.message); } ctx.restore(); } }
  if (s.guns) gunLine(ctx, s, f); if (s.embers !== false) FX.fire(ctx, { s: s.s, e: s.e, points: [], embers: true, order: 0 }, f, t);
}
function sceneTransition(ctx, s, f) {
  if (f >= s.s && f < s.s + 9 && s.entry !== 'cut') { const z = prog(f, s.s, s.s + 9); const tmp = snap(ctx); ctx.save(); ctx.globalAlpha = 0.18; for (let i = 1; i < 7; i++) { const k = 1 + i * 0.05 * (1 - z); ctx.drawImage(tmp, W / 2 - W * k / 2, H / 2 - H * k / 2, W * k, H * k); } ctx.restore(); }
  if (f >= s.e - 6 && f < s.e + 6 && s.exit !== 'cut') { const tmp = snap(ctx); const z = 1 - Math.abs(f - s.e) / 6; ctx.save(); ctx.globalAlpha = 0.2; for (let i = 1; i < 6; i++) { const k = 1 - i * 0.04 * z; ctx.drawImage(tmp, W / 2 - W * k / 2, H / 2 - H * k / 2, W * k, H * k); } ctx.restore(); }
}
let SNAP; function snap(ctx) { if (!SNAP) { SNAP = document.createElement('canvas'); SNAP.width = W; SNAP.height = H; } const g = SNAP.getContext('2d'); g.clearRect(0, 0, W, H); g.drawImage(ctx.canvas, 0, 0); return SNAP; }
const CODESC = {}; function codeScene(kind) { if (CODESC[kind]) return CODESC[kind]; const c = document.createElement('canvas'); c.width = 1400; c.height = 2400; const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 1100); sky.addColorStop(0, '#5B4A6E'); sky.addColorStop(0.45, '#D98A55'); sky.addColorStop(1, '#F3C58A'); g.fillStyle = sky; g.fillRect(0, 0, 1400, 2400);
  const ridge = (base, amp, col, sd) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, 2400); for (let x = 0; x <= 1400; x += 8) g.lineTo(x, base - amp * (0.55 * Math.sin(x / 260 + sd) + 0.3 * Math.sin(x / 110 + sd * 2) + 0.15 * Math.sin(x / 37 + sd * 3))); g.lineTo(1400, 2400); g.fill(); };
  ridge(820, 260, '#8D6E8A', 1.1); ridge(1050, 300, '#9B6A55', 2.3); ridge(1350, 280, '#7E4E3A', 3.7); ridge(1700, 220, '#6B3E2C', 5.1); ridge(2050, 160, '#5A3324', 6.3);
  return (CODESC[kind] = c); }
function gunLine(ctx, s, f) { const gi = easeOut(prog(f, s.s + 10, s.s + 18)); for (let i = 0; i < 3; i++) { const gx = lerp(-400, 160 + i * 40, gi), gy = 1150 + i * 330; const shot = (f - s.s - 20 - i * 9) % 26; const rec = shot >= 0 && shot < 5 ? (5 - shot) * 6 : 0; G.sprite(ctx, s.guns, gx - rec, gy, 420); if (shot >= 0 && shot < 8) burst(ctx, gx + 240, gy - 110, 1.6, shot / 8); } }

// ---------- drawing helpers ----------
function ring(ctx, x, y, r, color, alpha, width = 10) { if (alpha <= 0) return; ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.shadowColor = color; ctx.shadowBlur = 25; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.restore(); }
function vign(ctx, a) { if (a <= 0) return; ctx.save(); const g = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.25, W / 2, H * 0.5, H * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(15,20,30,${0.8 * a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); }
function pinDraw(ctx, x, y, s, t0, f, color = '#E21B2D') { const p = easeOut(prog(f, t0, t0 + 6)); if (p <= 0) return; ctx.save(); ctx.translate(x, y - (1 - p) * 70); ctx.scale(s, s); ctx.fillStyle = color; ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-30, -40, -34, -70, 0, -72); ctx.bezierCurveTo(34, -70, 30, -40, 0, 0); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -48, 12, 0, 7); ctx.fill(); ctx.restore(); }
function tagDraw(ctx, text, x, y, start, f, dir, o = {}) { ctx.save(); ctx.globalAlpha = o.alpha ?? 1; ctx.font = `${o.size || 40}px Poppins-Bold`; const tw = ctx.measureText(text).width + 30; const h = (o.size || 40) * 1.35; const wp = easeOut(prog(f, start, start + 5)); if (wp <= 0) { ctx.restore(); return; } const w = tw * wp; const x0 = dir < 0 ? x - w : x;
  ctx.fillStyle = o.bg || '#F6E534'; ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4; ctx.fillRect(x0, y - h / 2, w, h); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; const n = Math.floor(clamp((f - start - 5) / text.length * 1.4) * text.length);
  ctx.fillStyle = o.fg || '#111'; ctx.textBaseline = 'middle'; ctx.beginPath(); ctx.rect(x0, y - h / 2, w, h); ctx.clip(); ctx.fillText(text.slice(0, n), (dir < 0 ? x - tw : x) + 15, y + 2); ctx.restore(); }
function badgeDraw(ctx, x, y, s, icon, num, t0, f, label, alpha, b2) { const sc = pop(f, t0, 7); if (sc <= 0) return; ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(sc * s, sc * s); ctx.fillStyle = '#2A1E19'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(0, 0, 80, 0, 7); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.fillStyle = '#fff';
  if (icon === 'skull') { ctx.beginPath(); ctx.arc(0, -12, 34, 0, 7); ctx.fill(); ctx.fillRect(-20, 10, 40, 22); ctx.fillStyle = '#2A1E19'; ctx.beginPath(); ctx.arc(-13, -12, 9, 0, 7); ctx.arc(13, -12, 9, 0, 7); ctx.fill(); }
  if (icon === 'medic') { ctx.fillStyle = '#E8333A'; ctx.fillRect(-12, -40, 24, 80); ctx.fillRect(-40, -12, 80, 24); }
  if (icon === 'missing') { ctx.beginPath(); ctx.arc(0, -22, 18, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, 22, 30, 26, 0, Math.PI, 0); ctx.fill(); ctx.strokeStyle = '#E8333A'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-40, -40); ctx.lineTo(40, 40); ctx.moveTo(40, -40); ctx.lineTo(-40, 40); ctx.stroke(); }
  if (icon === 'people') { for (const dx of [-24, 0, 24]) { ctx.beginPath(); ctx.arc(dx, -14, 13, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(dx, 22, 18, 20, 0, Math.PI, 0); ctx.fill(); } }
  if (icon === 'otter') { ctx.fillStyle = '#8A5A36'; ctx.beginPath(); ctx.arc(0, 0, 50, 0, 7); ctx.fill(); for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 40, -38, 13, 0, 7); ctx.fill(); } ctx.fillStyle = '#E8D2B0'; ctx.beginPath(); ctx.ellipse(0, 18, 30, 22, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#1A1A1A'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 20, -8, 7, 0, 7); ctx.fill(); } ctx.beginPath(); ctx.ellipse(0, 10, 9, 6, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 2; for (const sx of [-1, 1]) for (const dy of [-4, 4]) { ctx.beginPath(); ctx.moveTo(sx * 14, 18 + dy); ctx.lineTo(sx * 46, 14 + dy * 2); ctx.stroke(); }
    if (b2 && f >= t0 + (b2.crossAfter ?? 9999)) { const cp = clamp((f - t0 - b2.crossAfter) / 5); ctx.strokeStyle = '#E8333A'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(-55, -55); ctx.lineTo(-55 + 110 * cp, -55 + 110 * cp); if (cp > 0.5) { ctx.moveTo(55, -55); ctx.lineTo(55 - 110 * (cp - 0.5) * 2, -55 + 110 * (cp - 0.5) * 2); } ctx.stroke(); } }
  if (icon === 'gold') { const g = ctx.createLinearGradient(-40, -40, 40, 40); g.addColorStop(0, '#FFE680'); g.addColorStop(1, '#C8901E'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-45, 20); ctx.lineTo(-20, -35); ctx.lineTo(25, -40); ctx.lineTo(48, 5); ctx.lineTo(20, 38); ctx.lineTo(-30, 40); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(-8, -18, 7, 0, 7); ctx.fill(); }
  if (icon === 'oil') { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(0, -55); ctx.bezierCurveTo(30, -10, 42, 15, 0, 45); ctx.bezierCurveTo(-42, 15, -30, -10, 0, -55); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-12, 8, 6, 12, 0.3, 0, 7); ctx.fill(); }
  if (icon === 'money') { ctx.font = '96px Poppins-Black'; ctx.textAlign = 'center'; ctx.fillStyle = '#4CD964'; ctx.fillText('$', 0, 34); }
  if (num != null) { const d = String(num); const n = clamp(Math.floor((f - t0 - 3) / 2) + 1, 0, d.length); ctx.font = '110px Poppins-Black'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 6; ctx.fillText(d.slice(0, n), 0, 190); }
  if (label) { ctx.font = '34px Poppins-Bold'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(label, 0, 120); } ctx.restore(); }
function explosion(ctx, x, y, size, t) { if (t <= 0 || t >= 1) return; ctx.save(); for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + x; const d = size * 0.35 * easeOut(t) * (0.6 + rnd(i + x) * 0.6); const r = size * (0.25 + 0.35 * easeOut(t)) * (0.7 + rnd(i * 3 + y) * 0.5); const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d - t * size * 0.3;
  const g = ctx.createRadialGradient(px, py, 0, px, py, r); const fire = 1 - t; g.addColorStop(0, t < 0.2 ? `rgba(255,255,240,${1 - t})` : t < 0.4 ? `rgba(255,${200 - t * 300},80,${1 - t})` : `rgba(${120 + 100 * fire},${80 + 60 * fire},60,${(1 - t) * 0.95})`); g.addColorStop(1, 'rgba(90,60,40,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); } ctx.restore(); }
function flame(ctx, x, y, s, t, a) { ctx.save(); ctx.globalAlpha = a; for (let i = 0; i < 5; i++) { const h = s * (1 + 0.35 * Math.sin(t * 9 + i * 1.7)); const g = ctx.createRadialGradient(x, y - h * 0.3, 2, x, y - h * 0.3, h * 0.6); g.addColorStop(0, 'rgba(255,240,170,0.95)'); g.addColorStop(0.45, 'rgba(255,140,30,0.8)'); g.addColorStop(1, 'rgba(200,40,10,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x + (i - 2) * s * 0.18, y - h * 0.35, s * 0.28, h * 0.55, 0, 0, 7); ctx.fill(); } ctx.restore(); }
function burst(ctx, x, y, s, t) { if (t <= 0 || t >= 1) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.strokeStyle = `rgba(255,230,60,${1 - t})`; ctx.lineWidth = 4; ctx.shadowColor = '#ffd23a'; ctx.shadowBlur = 12; const r = 30 + t * 40; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, 7); ctx.stroke(); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); ctx.lineTo(Math.cos(a) * r * 1.6, Math.sin(a) * r * 1.6); ctx.stroke(); } ctx.restore(); }
let ARW; function arrowDraw(ctx, pts, o) { const n = 60, path = []; for (let i = 0; i <= n; i++) { const t = i / n; const [a, b, c] = pts; path.push([(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]]); }
  const width = o.width; const draw = (g, dx, dy, col) => { g.save(); g.translate(dx, dy); g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'; for (let i = 1; i < path.length; i++) { g.lineWidth = width * (0.15 + 0.85 * i / path.length); g.globalAlpha = o.alpha * (0.25 + 0.75 * i / path.length); g.beginPath(); g.moveTo(...path[i - 1]); g.lineTo(...path[i]); g.stroke(); }
    const [hx, hy] = path[n], [px, py] = path[n - 1]; g.globalAlpha = o.alpha; g.translate(hx, hy); g.rotate(Math.atan2(hy - py, hx - px)); g.beginPath(); g.moveTo(width * 1.4, 0); g.lineTo(-width * 0.6, -width * 1.15); g.lineTo(-width * 0.6, width * 1.15); g.closePath(); g.fill(); g.restore(); };
  if (!ARW) { ARW = document.createElement('canvas'); ARW.width = W; ARW.height = H; } const ac = ARW.getContext('2d'); ac.clearRect(0, 0, W, H); draw(ac, 10, 30, 'rgba(0,0,0,0.45)'); ctx.save(); ctx.filter = 'blur(8px)'; ctx.drawImage(ARW, 0, 0); ctx.restore(); draw(ctx, 0, 0, o.color); }
function whipBlur(ctx, amt) { if (amt <= 1) return; const tmp = snap(ctx); ctx.save(); ctx.globalAlpha = 1 / 7; for (let i = -3; i <= 3; i++) ctx.drawImage(tmp, i * amt, 0); ctx.restore(); }
function curved(ctx, text, x, R, size, color, n, stroke) { let a = -Math.PI / 2 - (text.length * size * 0.55) / R / 2; for (const ch of text.slice(0, Math.max(0, n))) { const w = ctx.measureText(ch).width; const da = w / R; ctx.save(); ctx.rotate(a + da / 2 + Math.PI / 2); ctx.translate(0, -R); if (stroke) { ctx.lineWidth = 6; ctx.strokeStyle = stroke; ctx.strokeText(ch, 0, R); } ctx.fillStyle = color; ctx.fillText(ch, 0, R); ctx.restore(); a += da; } }
let EMB; function unEmblem(ctx, x, y, r, rot) { if (!EMB) { const c = document.createElement('canvas'); c.width = c.height = 800; const g = c.getContext('2d'); g.translate(400, 400); g.strokeStyle = g.fillStyle = '#4B92DB'; g.lineWidth = 16; for (const rr of [150, 105, 60]) { g.beginPath(); g.arc(0, 0, rr, 0, 7); g.stroke(); } g.beginPath(); g.moveTo(-150, 0); g.lineTo(150, 0); g.moveTo(0, -150); g.lineTo(0, 150); g.stroke(); for (const sx of [-1, 1]) for (let i = 0; i < 11; i++) { const a = Math.PI / 2 + sx * (0.35 + i * 0.24); g.save(); g.translate(Math.cos(a) * 250, Math.sin(a) * 250); g.rotate(a + sx * 0.9); g.beginPath(); g.ellipse(0, 0, 46, 18, 0, 0, 7); g.fill(); g.restore(); } EMB = c; }
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 20; ctx.drawImage(EMB, -r, -r, 2 * r, 2 * r); ctx.restore(); }
function docDraw(ctx, b, f) { const p = easeOut(prog(f, b.s, b.s + 16)); const out = easeIn(prog(f, b.e - 10, b.e)); const w = 760, h = 980; ctx.save(); ctx.translate(lerp(-300, W / 2, p) - out * 900, lerp(200, 880, p) - out * 600); ctx.rotate(lerp(-0.35, -0.06, p)); ctx.scale(lerp(0.3, 1, p), lerp(0.3, 1, p));
  if (b.style === 'unroll') { const u = easeOut(prog(f, b.s, b.s + 14)) * (1 - out); ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h * u); ctx.clip(); }
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 18; ctx.fillStyle = '#EFE3C4'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; const g = ctx.createRadialGradient(0, 0, 200, 0, 0, 700); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(120,80,30,0.35)'); ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = '#2B2116'; ctx.textAlign = 'center'; ctx.font = '44px Baskerville'; (b.title ? [].concat(b.title) : []).forEach((l, i) => ctx.fillText(l, 0, -h / 2 + 110 + i * 56)); ctx.font = '30px Baskerville'; ctx.textAlign = 'left';
  const body = b.lines || ['Lorem ipsum dolor sit amet, consectetur', 'adipiscing elit, sed do eiusmod tempor']; let yy = -h / 2 + 260; for (let i = 0; i < 14; i++) { const l = body[i % body.length]; ctx.globalAlpha = 0.85; ctx.fillText(l, -w / 2 + 70, yy); yy += 44; }
  if (b.highlight != null) { const hp = easeOut(prog(f, b.s + 18, b.s + 30)); ctx.globalAlpha = 0.45; ctx.fillStyle = '#FFE600'; ctx.fillRect(-w / 2 + 60, -h / 2 + 260 + b.highlight * 44 - 34, (w - 120) * hp, 44); }
  ctx.globalAlpha = 1; if (b.seal !== false) { ctx.fillStyle = '#A3261E'; ctx.beginPath(); ctx.arc(w / 2 - 120, h / 2 - 120, 55, 0, 7); ctx.fill(); } ctx.restore(); }
function calDraw(ctx, b, f) { const years = [].concat(b.text); const p = easeOut(prog(f, b.s, b.s + 12)); const out = easeIn(prog(f, b.e - 8, b.e)); const flipAt = (i) => b.s + 14 + i * fr(b.flipEvery ?? 0.6);
  ctx.save(); ctx.translate(lerp(-200, 540, p) - out * 900, lerp(1500, 860, p) + out * 300); ctx.rotate(lerp(-0.6, -0.08, p) + Math.sin(f / 20) * 0.02); const w = 460, h = 420; ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 40; ctx.shadowOffsetX = 30; ctx.shadowOffsetY = 40; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 24); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#E23B32'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, 110, [24, 24, 0, 0]); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '62px Poppins-Bold'; ctx.textAlign = 'center'; ctx.fillText(b.header || 'Year', 0, -h / 2 + 78);
  let i = 0; while (i < years.length - 1 && f >= flipAt(i) + 6) i++; const flipping = i < years.length - 1 && f >= flipAt(i); const fp = flipping ? prog(f, flipAt(i), flipAt(i) + 6) : 0;
  ctx.fillStyle = '#E23B32'; ctx.font = '170px Poppins-Black'; ctx.save(); if (flipping) { ctx.scale(1, Math.abs(Math.cos(fp * Math.PI))); } ctx.fillText(String(flipping && fp > 0.5 ? years[i + 1] : years[i]), 0, 120); ctx.restore();
  ctx.fillStyle = '#222'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.roundRect(sx * 120 - 14, -h / 2 - 40, 28, 80, 14); ctx.fill(); } ctx.restore(); }
function riverGeo(name) { const all = G.A.rivers.filter(x => (x[0] || '').toLowerCase() === String(name).toLowerCase()).flatMap(x => x[1]); if (!all.length) return []; const pts = all.sort((a, b) => b.length - a.length)[0]; return pts.map(([x, y]) => [x * 360 - 180, G.unMy(y)]); }
function pathGeo(b, f) { const pts = b.path.map(geo); const p = (b.easing === 'linear' ? (x) => x : ease)(prog(f, b.s + fr(b.delay ?? 0), b.s + fr(b.delay ?? 0) + fr(b.travel ?? Math.max(0.5, (b.e - b.s) / FPS - 0.3)))); const seg = (pts.length - 1) * p; const i = Math.min(Math.floor(seg), pts.length - 2); const q = seg - i; const a = pts[i], c = pts[i + 1]; const bend = (b.arc ?? 0) * Math.sin(p * Math.PI); return [lerp(a[0], c[0], q), lerp(a[1], c[1], q) + bend]; }
const DATE_STYLES = { neon: { font: 'Poppins-Black', color: '#ffffff', glows: [[70, '#ff2d55'], [25, '#ff6b81']] }, gold: { font: 'Poppins-Black', color: '#ffffff', glows: [[60, '#FFB300'], [20, '#FFD54F']] },
  white: { font: 'Poppins-Black', color: '#ffffff', glows: [[16, 'rgba(0,0,0,0.6)']] }, cream: { font: 'Cinzel', color: '#EADBB4', glows: [[14, 'rgba(40,20,10,0.8)']], stroke: '#4A3A22', strokeW: 4 }, fire: { font: 'Cinzel', color: '#F6E7C8', glows: [[60, '#ff4a10'], [20, '#ffb04a']] } };

// ---------- SFX events (picked up by tools/mix.py) ----------
const SFXMAP = { ghost: () => [['whoosh', 0, -13]], fill: (b) => b.style === 'flash' ? [['shimmer', 0, -12]] : b.style === 'spread' ? [['whoosh', 0, -14]] : [], flag: () => [['pop', 0, -10]], label: (b) => [['pop', -2, -12], ...b.text.split('').filter((c, i) => i % 3 === 0 && c !== ' ').map((_, i) => ['type', i * 3 * (b.per ?? 3.4), -24])],
  pin: () => [['pop', 2, -9]], ring: () => [['impact', 0, -16]], chibi: (b) => Array.from({ length: Math.min(b.count || 1, 6) }, (_, i) => ['pop', i * (b.step ?? 2), -11]), sprite: (b) => /plane/.test(b.sprite) ? [['plane', 0, -14]] : [['pop', 0, -11]],
  tag: () => [['whip', 0, -18]], emblem: () => [['pop', 0, -10]], bubble: () => [['pop', 0, -9]], badge: () => [['impact', 0, -9]], explosions: (b) => Array.from({ length: Math.min(b.count || 8, 10) }, (_, i) => ['boom', i * (b.stagger ?? 3.5), -10 - (i % 3) * 2]), fire: () => [['fire', 0, -20]],
  lens: () => [['shimmer', 0, -14]], scribble: () => [['paper', 0, -18]], reticle: () => [['impact', 0, -16]], googly: () => [['pop', 0, -11]], question: () => [['pop', 0, -9]], date: (b) => [['riser', -40, -20], ['impact', 4, -8], ['whoosh', b.e - b.s - 10, -12]],
  title: () => [['whoosh', 0, -14]], firetitle: () => [['boom', 6, -10]], neon: () => [['shimmer', 0, -14]], document: () => [['paper', 0, -9]], calendar: () => [['paper', 0, -12]], stamp: () => [['stamp', 2, -6]], flash: () => [['shimmer', 0, -12]], whip: () => [['whip', 0, -8]], arrow: () => [['whoosh', 0, -15]], line: () => [['whoosh', 0, -18]], clouds: () => [['whoosh', 0, -10]], endcard: () => [['pop', 10, -10]],
  scene: (b) => [['whoosh', 0, -8]].concat(b.guns ? Array.from({ length: Math.floor((b.e - b.s - 20) / 26) * 3 }, (_, i) => ['artillery', 20 + Math.floor(i / 3) * 26 + (i % 3) * 9, -12]) : []) };
function collectSfx() { const ev = []; for (const b of P.beats) { if (b.sfx === false) continue; const fn = SFXMAP[b.type]; if (!fn) continue; for (const [cat, off, gain] of (b.sfx || fn(b))) ev.push({ f: Math.max(0, Math.round(b.s + off)), cat, gain }); }
  // whoosh on fast camera moves
  let prev = camera(0), fast = false; for (let f = 1; f < P.total; f++) { const c = camera(f); G.setCam(prev[0], prev[1], prev[2], prev[3]); const [x, y] = toScreen(c[0], c[1]); const sp = Math.hypot(x - W / 2, y - H / 2) + Math.abs(Math.log(c[2] / prev[2])) * 1500; if (sp > 38 && !fast) ev.push({ f: Math.max(0, f - 4), cat: 'whoosh', gain: -11 }); fast = sp > 38; prev = c; }
  return ev.sort((a, b) => a.f - b.f); }
