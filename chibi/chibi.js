// Geo chibi renderer — soft 3D clay-toy chibis built from parts.
// build(spec) -> THREE.Group. All sizes in "head units" (head radius = 1).
import * as THREE from './node_modules/three/build/three.module.js';

const C = (c) => new THREE.Color(c);
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color: C(color), roughness: o.r ?? 0.62, metalness: o.m ?? 0, map: o.map || null, bumpMap: o.bump || null, bumpScale: o.bumpScale ?? 0, flatShading: false });

// ---------- canvas textures ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function netTex(base, line) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // mottled clay
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 0, 7); g.fill(); }
    g.strokeStyle = line; g.lineWidth = 3;
    const s = 30;
    for (let k = -h; k < w + h; k += s) { const j=()=>(Math.random()-0.5)*8; g.beginPath(); g.moveTo(k+j(), 0); g.quadraticCurveTo(k + h*0.45+j()*2, h*0.5+j(), k + h * 0.9+j(), h); g.stroke(); g.beginPath(); g.moveTo(k+j(), h); g.quadraticCurveTo(k + h*0.45+j()*2, h*0.5+j(), k + h * 0.9+j(), 0); g.stroke(); }
  });
}
function fabricTex(base) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  });
}
function flagTex(stripes) { // stripes: [[color, fraction], ...] horizontal
  return canvasTex(96, 64, (g, w, h) => { let y = 0; for (const [c, f] of stripes) { g.fillStyle = c; g.fillRect(0, y, w, h * f + 1); y += h * f; } });
}

// ---------- geometry helpers ----------
function ellipsoid(rx, ry, rz, m, seg = 40) { const g = new THREE.SphereGeometry(1, seg, seg); const me = new THREE.Mesh(g, m); me.scale.set(rx, ry, rz); return me; }
function capsule(r, len, m) { return new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 12, 24), m); }
function lathe(profile, m, seg = 64) { const mm = m.clone(); mm.side = THREE.DoubleSide; return new THREE.Mesh(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), seg), mm); }
function limb(a, b, r, m) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const len = A.distanceTo(B); const c = capsule(r, Math.max(0.01, len - 2 * r * 0.6), m); c.position.copy(A).add(B).multiplyScalar(0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); return c; }
// place an object on the head surface at (yawDeg, pitchDeg), pushed out by `lift`
function onHead(obj, head, yaw, pitch, lift = 0) {
  const y = THREE.MathUtils.degToRad(yaw), p = THREE.MathUtils.degToRad(pitch);
  const dir = new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p));
  const s = head.scale; const pt = new THREE.Vector3(dir.x * s.x, dir.y * s.y, dir.z * s.z);
  const n = new THREE.Vector3(dir.x / s.x, dir.y / s.y, dir.z / s.z).normalize();
  obj.position.copy(head.position).add(pt).add(n.clone().multiplyScalar(lift));
  obj.lookAt(obj.position.clone().add(n));
  return obj;
}

// ---------- parts ----------
function buildHead(g, spec) {
  const skin = mat(spec.skin || '#F3C49E', { r: 0.55 });
  const head = ellipsoid(1.1, 0.96, 0.92, skin); head.position.set(0, 0, 0); g.add(head);
  // ears
  for (const sx of [-1, 1]) { const e = ellipsoid(0.16, 0.22, 0.12, skin); e.position.set(sx * 1.05, -0.12, 0.02); g.add(e); }
  const dark = mat('#1E1612', { r: 0.7 });
  const hairM = mat(spec.hair || '#3A2416', { r: 0.7 });
  // eyes: glossy black ovals with highlight
  for (const sx of [-1, 1]) {
    const eye = ellipsoid(0.1, 0.115, 0.045, dark); onHead(eye, head, sx * (spec.eyeYaw ?? 28), spec.eyePitch ?? -4, -0.012); g.add(eye);
    if (spec.eyeHighlight) { const hl = ellipsoid(0.028, 0.032, 0.015, mat('#FFFFFF', { r: 0.2 })); onHead(hl, head, sx * (spec.eyeYaw ?? 27) - 3, (spec.eyePitch ?? -2) + 4, 0.025); g.add(hl); }
    // brow
    if (spec.brows !== false) {
      const b = capsule(0.035, 0.16, hairM); onHead(b, head, sx * 25, 21, 0.01); b.rotateZ(Math.PI / 2 + sx * (spec.browTilt ?? 0.15)); g.add(b);
    }
    // cheek blush
    const ch = ellipsoid(0.13, 0.07, 0.03, new THREE.MeshStandardMaterial({ color: C('#F08C7E'), transparent: true, opacity: 0.22, roughness: 0.7 }));
    onHead(ch, head, sx * 40, -14, 0.0); g.add(ch);
  }
  // nose: tiny bump
  if (spec.nose) { const nose = ellipsoid(0.07, 0.055, 0.05, skin); onHead(nose, head, 0, -10, 0.0); g.add(nose); }
  // mustache: two fat curved lobes
  if (spec.mustache) {
    for (const sx of [-1, 1]) {
      const m = ellipsoid(0.2, 0.075, 0.035, hairM); onHead(m, head, sx * 10, -24, 0.005); m.rotateZ(sx * -0.3); const tip = ellipsoid(0.06, 0.045, 0.03, hairM); onHead(tip, head, sx * 20, -22, 0.008); g.add(tip); g.add(m);
    }
  }
  if (spec.glasses) { const gm = mat('#2A2420', { r: 0.4 }); for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 10, 32), gm); onHead(r, head, sx * 27, -3, 0.03); g.add(r); } const br = capsule(0.02, 0.18, gm); onHead(br, head, 0, -1, 0.04); br.rotateZ(Math.PI / 2); g.add(br); }
  if (spec.bald) { const top = ellipsoid(1.0, 0.5, 0.92, skin); top.position.y = 0.45; g.add(top); for (const sx of [-1, 1]) { const tuft = ellipsoid(0.28, 0.32, 0.5, hairM); tuft.position.set(sx * 0.95, 0.25, -0.15); g.add(tuft); } const back = ellipsoid(0.9, 0.5, 0.5, hairM); back.position.set(0, 0.35, -0.55); g.add(back); }
  if (spec.beard) { const bd = ellipsoid(0.55, 0.35, 0.3, hairM); bd.position.set(0, -0.78, 0.55); g.add(bd); }
  // mouth (small) when no mustache
  if (!spec.mustache) { const mo = capsule(0.025, 0.08, mat('#7A3B2E')); onHead(mo, head, 0, -28, 0.0); mo.rotateZ(Math.PI / 2); g.add(mo); }
  // sideburns / hair peeking under hat
  if (spec.sideburns !== false) for (const sx of [-1, 1]) { const sb = ellipsoid(0.16, 0.32, 0.3, hairM); sb.position.set(sx * 1.0, 0.12, 0.02); sb.rotation.z = sx * 0.15; g.add(sb); }
  return head;
}

function buildHat(g, spec) {
  const h = spec.hat; if (!h) return;
  if (h.type === 'helmet') {
    const tex = netTex(h.color || '#6E5E3B', h.net || 'rgba(40,30,15,0.55)');
    const m = mat('#ffffff', { r: 0.75, map: tex, bump: tex, bumpScale: 0.02 });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.56), m);
    shell.scale.set(1.22, 1.22, 1.22); shell.position.set(0, 0.38, -0.04); shell.rotation.x = 0.1; g.add(shell);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 16, 64), mat(h.color || '#6E5E3B', { r: 0.8 }));
    rim.scale.set(1.24, 1.24, 1); rim.position.set(0, 0.41, 0.0); rim.rotation.x = Math.PI / 2 + 0.1; g.add(rim);
    if (h.star) { const st = ellipsoid(0.16, 0.16, 0.03, mat('#F4F0E0')); st.position.set(0, 0.62, 1.05); g.add(st); }
  }
  if (h.type === 'fedora') {
    const m = mat(h.color || '#5B8CC0', { r: 0.6 });
    const crown = lathe([[0.84, 0], [0.82, 0.25], [0.72, 0.58], [0, 0.62]], m); crown.position.y = 0.55; g.add(crown);
    const brim = lathe([[0.8, -0.04], [1.5, -0.05], [1.45, 0.0], [0.8, 0.02]], m); brim.position.y = 0.55; brim.rotation.x = -0.12; g.add(brim);
    const band = lathe([[0.84, 0.16], [0.845, 0.0]], mat('#2D4F7A')); band.position.y = 0.56; g.add(band);
  }
  if (h.type === 'turban') {
    const m = mat(h.color || '#F1ECE0', { r: 0.8 });
    const dome = ellipsoid(1.12, 0.78, 1.08, m); dome.position.y = 0.42; g.add(dome);
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.0 - i * 0.14, 0.17, 16, 48), m); t.rotation.set(Math.PI / 2 + (i % 2 ? 0.18 : -0.12), 0, i * 0.4); t.position.y = 0.42 + i * 0.22; g.add(t); }
    const tail = ellipsoid(0.32, 0.55, 0.22, m); tail.position.set(0.95, -0.35, -0.25); tail.rotation.z = 0.2; g.add(tail);
  }
  if (h.type === 'tophat') {
    const m = mat(h.color || '#1C1C1F', { r: 0.45 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.08, 48), m); brim.position.y = 0.62; brim.rotation.x = -0.08; g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.78, 1.25, 48), m); crown.position.y = 1.25; crown.rotation.x = -0.08; g.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.79, 0.79, 0.18, 48), mat(h.band || '#3A2A20')); band.position.y = 0.76; band.rotation.x = -0.08; g.add(band);
  }
  if (h.type === 'ushanka') {
    const fur = new THREE.MeshStandardMaterial({ color: C(h.color || '#6B4A33'), roughness: 1, bumpMap: netTex('#777', 'rgba(0,0,0,0.6)'), bumpScale: 0.04 });
    const dome = ellipsoid(1.08, 0.7, 1.05, fur); dome.position.y = 0.55; g.add(dome);
    const front = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.24, 16, 48), fur); front.rotation.x = Math.PI / 2 - 0.15; front.position.y = 0.42; g.add(front);
    for (const sx of [-1, 1]) { const flap = ellipsoid(0.3, 0.55, 0.45, fur); flap.position.set(sx * 1.08, 0.0, -0.05); g.add(flap); }
  }
  if (h.type === 'shako') { // tall military hat (British redcoat / bearskin style)
    const m = mat(h.color || '#141416', { r: 0.9 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 1.7, 40), m); body.position.y = 1.2; g.add(body);
    const top = ellipsoid(0.85, 0.35, 0.85, m); top.position.y = 2.05; g.add(top);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.04, 8, 40), mat('#C9A23A', { m: 0.6, r: 0.3 })); strap.rotation.x = Math.PI / 2; strap.position.y = 0.42; g.add(strap);
  }
  if (h.type === 'officer') { // peaked military cap (tsar / generals)
    const m = mat(h.color || '#E8E8E0', { r: 0.6 });
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 0.98, 0.5, 48), m); crown.position.y = 0.72; g.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.2, 48), mat(h.band || '#C8102E')); band.position.y = 0.55; g.add(band);
    const visor = ellipsoid(0.62, 0.05, 0.38, mat('#111', { r: 0.3 })); visor.position.set(0, 0.48, 0.92); visor.rotation.x = 0.28; g.add(visor);
    const badge = ellipsoid(0.12, 0.12, 0.04, mat('#D4AF37', { m: 0.7, r: 0.3 })); badge.position.set(0, 0.62, 1.0); g.add(badge);
  }
  if (h.type === 'cap') {
    const m = mat(h.color || '#1F2633', { r: 0.6 });
    const crown = lathe([[0.88, 0.0], [1.05, 0.38], [0.95, 0.5], [0, 0.5]], m); crown.position.y = 0.5; g.add(crown);
    const visor = ellipsoid(0.6, 0.06, 0.35, mat('#111')); visor.position.set(0, 0.5, 0.95); visor.rotation.x = 0.25; g.add(visor);
  }
}

function buildBody(g, spec) {
  const b = spec.body || {};
  const tex = fabricTex(b.color || '#6C6B44');
  const m = mat('#ffffff', { r: 0.85, map: tex });
  // peg / bell body under the head
  const prof = [[0, -2.05], [0.98, -2.05], [1.06, -1.92], [1.06, -1.45], [0.92, -1.05], [0.66, -0.8], [0.4, -0.72], [0, -0.72]];
  const body = lathe(prof, m); g.add(body);
  // collar
  const col = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 12, 32), mat(b.collar || b.color || '#5E5D3A', { r: 0.85 })); col.rotation.x = Math.PI / 2; col.position.y = -0.78; g.add(col);
  // belt + pouches
  if (b.belt) {
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.06, 12, 48), mat(b.belt, { r: 0.7 })); belt.rotation.x = Math.PI / 2; belt.position.y = -1.6; belt.scale.set(1, 1, 1); g.add(belt);
    for (const a of [-40, -15, 15, 40]) {
      const r = THREE.MathUtils.degToRad(a); const p = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.12), mat(b.belt, { r: 0.75 }));
      p.position.set(Math.sin(r) * 0.97, -1.72, Math.cos(r) * 0.97); p.rotation.y = r; g.add(p);
    }
  }
  if (b.straps) for (const sx of [-1, 1]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.05), mat(b.belt || '#5A4E33')); s.position.set(sx * 0.42, -1.15, 0.72); s.rotation.set(-0.35, 0, sx * 0.15); g.add(s); }
  if (b.coat) {
    const cm = mat(b.coat, { r: 0.8 });
    for (const sx of [-1, 1]) { const panel = lathe([[0.99, -2.06], [1.08, -1.9], [1.08, -1.45], [0.94, -1.05], [0.68, -0.8]], cm, 48); panel.geometry = new THREE.LatheGeometry([[0.99,-2.06],[1.085,-1.9],[1.085,-1.45],[0.95,-1.05],[0.69,-0.8]].map(([x,y])=>new THREE.Vector2(x,y)), 24, sx > 0 ? 0.35 : Math.PI + 0.35 + 0.0, Math.PI * 0.62); panel.rotation.y = sx > 0 ? 0 : 0; g.add(panel); }
  }
  if (b.sash) { const sm = mat(b.sash, { r: 0.7 }); const sh = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.04, 0.28, 48, 1, true), sm); sh.material.side = THREE.DoubleSide; sh.position.y = -1.55; g.add(sh); }
  if (b.gear) {
    const gm = mat(b.gear, { r: 0.85 });
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.16), gm); p.position.set(sx * 0.42, -1.2, 0.86); p.rotation.set(-0.3, sx * 0.35, 0); g.add(p);
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.18), mat(b.belt || '#5C5233')); flap.position.set(sx * 0.42, -1.06, 0.9); flap.rotation.set(-0.3, sx * 0.35, 0); g.add(flap); }
  }
  if (b.epaulettes) for (const sx of [-1, 1]) { const ep = ellipsoid(0.32, 0.1, 0.28, mat(b.epaulettes, { m: 0.5, r: 0.35 })); ep.position.set(sx * 0.62, -0.86, 0.05); ep.rotation.z = sx * -0.35; g.add(ep); for (let i = -2; i <= 2; i++) { const fr = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6), mat(b.epaulettes, { m: 0.5 })); fr.position.set(sx * (0.72 + 0.06 * Math.abs(i)), -0.98, 0.05 + i * 0.09); g.add(fr); } }
  if (b.buttons) for (let i = 0; i < 4; i++) { const bt = ellipsoid(0.05, 0.05, 0.03, mat(b.buttons, { m: 0.6, r: 0.3 })); bt.position.set(0, -1.05 - i * 0.22, 0.93 + i * 0.02); g.add(bt); }
  if (b.medals) for (let i = 0; i < 3; i++) { const md = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 16), mat(['#D4AF37', '#C0C0C0', '#B0413E'][i], { m: 0.6 })); md.rotation.x = Math.PI / 2; md.position.set(-0.45 + i * 0.16, -1.15, 0.82); g.add(md); }
  if (b.crossbelts) for (const sx of [-1, 1]) { const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.25, 0.04), mat(b.crossbelts)); s2.position.set(0, -1.3, 0.86); s2.rotation.set(-0.3, 0, sx * 0.62); g.add(s2); }
  if (b.tie) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 12), mat(b.tie)); t.rotation.x = Math.PI; t.position.set(0, -1.0, 0.66); t.rotation.z = 0; g.add(t); }
  if (b.patch) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.19), new THREE.MeshStandardMaterial({ map: flagTex(b.patch), roughness: 0.7 })); p.position.set(0.86, -1.18, 0.42); p.rotation.y = 1.05; g.add(p); }
  return body;
}

function buildArms(g, spec) {
  const b = spec.body || {}; const sleeve = mat(b.color || '#6C6B44', { r: 0.8 }); const skin = mat(spec.skin || '#F3C49E', { r: 0.55 });
  const pose = spec.arms || 'down';
  const arm = (sx, rot, handPos) => {
    const a = capsule(0.17, 0.5, sleeve); a.position.set(sx * 0.82, -1.22, 0.25); a.rotation.set(rot[0], rot[1], rot[2]); g.add(a);
    const h = ellipsoid(0.17, 0.16, 0.17, skin); h.position.set(...handPos); g.add(h);
  };
  if (pose === 'rifle') {
    const L = [-0.45, -1.15, 1.12], R = [0.45, -1.65, 1.1];
    g.add(limb([-0.88, -1.0, 0.15], L, 0.17, sleeve)); g.add(limb([0.88, -1.0, 0.15], R, 0.17, sleeve));
    const wood = mat('#6E3B1E', { r: 0.55 }), metal = mat('#2B2B30', { r: 0.4, m: 0.5 });
    const rifle = new THREE.Group();
    const stock = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.17, 0.14), wood); stock.position.x = -0.2; rifle.add(stock);
    const butt = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.15), wood); butt.position.x = -0.95; butt.position.y = -0.05; rifle.add(butt);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.9, 12), metal); barrel.rotation.z = Math.PI / 2; barrel.position.set(0.95, 0.06, 0); rifle.add(barrel);
    const sling = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.03), mat('#3E3424')); sling.position.set(-0.1, -0.16, 0.02); rifle.add(sling);
    rifle.position.set(-0.05, -1.4, 1.2); rifle.rotation.set(0, -0.15, -0.55); g.add(rifle);
    const hL = ellipsoid(0.17, 0.16, 0.17, skin); hL.position.set(...L); g.add(hL);
    const hR = ellipsoid(0.17, 0.16, 0.17, skin); hR.position.set(...R); g.add(hR);
  } else if (pose === 'hold') { // holding a book/object at chest
    arm(-1, [-0.6, 0, -0.2], [-0.45, -1.2, 0.85]);
    arm(1, [0, 0, 0.25], [0.95, -1.75, 0.3]);
    if (spec.prop === 'bag') { const bag = ellipsoid(0.45, 0.42, 0.38, mat('#8A6A3A', { r: 0.8 })); bag.position.set(-0.45, -1.25, 0.95); g.add(bag); const knot = ellipsoid(0.16, 0.12, 0.12, mat('#6B4F28')); knot.position.set(-0.45, -0.85, 0.95); g.add(knot); }
    if (spec.prop === 'paper') { const pp = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.03), mat('#EFE3C4', { r: 0.9 })); pp.position.set(-0.4, -1.15, 0.95); pp.rotation.set(-0.15, 0.2, 0.1); g.add(pp); }
    if (spec.prop === 'book') { const bk = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.12), mat('#6B3A22')); bk.position.set(-0.4, -1.15, 0.92); bk.rotation.set(-0.1, 0.25, 0.08); g.add(bk); }
  } else {
    arm(-1, [0, 0, -0.25], [-0.95, -1.75, 0.3]);
    arm(1, [0, 0, 0.25], [0.95, -1.75, 0.3]);
  }
}

// Optional thin dark rim (inverted hull) for the soft outline seen in the reference
function addOutline(group, color = '#2B1A10', thickness = 0.04) {
  const om = new THREE.MeshBasicMaterial({ color: C(color), side: THREE.BackSide });
  const add = [];
  group.traverse((o) => { if (o.isMesh && !o.userData.noOutline) { const c = new THREE.Mesh(o.geometry, om); c.position.copy(o.position); c.quaternion.copy(o.quaternion); c.scale.copy(o.scale).multiplyScalar(1 + thickness / Math.max(0.15, Math.min(o.scale.x, o.scale.y, o.scale.z))); add.push([o.parent, c]); } });
  for (const [p, c] of add) p.add(c);
}

function buildPlane(spec) {
  const g = new THREE.Group(); const body = mat(spec.color || '#5E6B3A', { r: 0.55 }); const stripe = mat('#F2F0E6', { r: 0.6 }); const dark = mat('#2A2A2A', { r: 0.4 });
  const fus = capsule(0.32, 2.6, body); fus.rotation.x = Math.PI / 2; g.add(fus);
  const nose = ellipsoid(0.3, 0.3, 0.2, mat('#3A3A3A')); nose.position.z = 1.65; g.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 0.8), body); wing.position.set(0, -0.05, 0.35); g.add(wing);
  if (spec.stripes !== false) for (const x of [-1.3, -1.05, 1.05, 1.3]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.81), stripe); st.position.set(x, -0.04, 0.35); g.add(st); }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.45), body); tail.position.set(0, 0.05, -1.45); g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.45), body); fin.position.set(0, 0.32, -1.45); g.add(fin);
  const canopy = ellipsoid(0.2, 0.18, 0.42, mat('#8FB7CF', { r: 0.2 })); canopy.position.set(0, 0.28, 0.25); g.add(canopy);
  if (spec.roundel) for (const x of [-1.6, 1.6]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 24), mat(spec.roundel[0])); r.position.set(x, 0.0, 0.35); g.add(r); const r2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.13, 24), mat(spec.roundel[1])); r2.position.set(x, 0.0, 0.35); g.add(r2); }
  const prop = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.05), dark); prop.position.z = 1.86; prop.rotation.z = 0.4; g.add(prop);
  return g;
}
function buildShip(spec) {
  const g = new THREE.Group(); const hullM = mat(spec.color || '#7C8590', { r: 0.6 }); const deck = mat('#9AA1A8', { r: 0.7 });
  const sh = new THREE.Shape(); sh.moveTo(0, 2.6); sh.quadraticCurveTo(0.6, 1.2, 0.55, -1.8); sh.lineTo(0.4, -2.2); sh.lineTo(-0.4, -2.2); sh.lineTo(-0.55, -1.8); sh.quadraticCurveTo(-0.6, 1.2, 0, 2.6);
  const hg = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }); const hull = new THREE.Mesh(hg, hullM); hull.rotation.x = Math.PI / 2; hull.position.y = 0.35; g.add(hull);
  
  const sup = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 1.1), hullM); sup.position.set(0, 0.6, -0.2); g.add(sup);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), hullM); bridge.position.set(0, 1.0, 0.0); g.add(bridge);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.6, 16), mat('#5A5F66')); stack.position.set(0, 1.0, -0.7); g.add(stack);
  for (const z of [1.3, -1.6]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 16), hullM); t.position.set(0, 0.45, z); g.add(t); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), mat('#444')); b.rotation.x = Math.PI / 2; b.position.set(0, 0.5, z + (z > 0 ? 0.45 : -0.45)); g.add(b); }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), mat('#555')); mast.position.set(0, 1.6, 0.0); g.add(mast);
  if (spec.flag) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.33), new THREE.MeshStandardMaterial({ map: flagTex(spec.flag), side: THREE.DoubleSide })); f.position.set(0, 2.0, -0.25); f.rotation.y = Math.PI / 2; g.add(f); }
  return g;
}

function buildHowitzer(spec) {
  const g = new THREE.Group(); const ol = mat(spec.color || '#5D6236', { r: 0.6 }), dark = mat('#2C2C2C', { r: 0.5 }), tire = mat('#1E1E1E', { r: 0.8 });
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.28, 16, 32), tire); w.rotation.y = Math.PI / 2; w.position.set(sx * 1.1, -0.4, 0); g.add(w); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 20), ol); hub.rotation.z = Math.PI / 2; hub.position.set(sx * 1.1, -0.4, 0); g.add(hub); }
  const shield = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 0.12), ol); shield.position.set(0, 0.35, 0.3); g.add(shield);
  const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 2.2), ol); cradle.position.set(0, 0.3, 0.6); g.add(cradle);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 3.6, 20), ol); barrel.rotation.x = Math.PI / 2 - 0.35; barrel.position.set(0, 1.0, 2.0); g.add(barrel);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.35, 20), dark); muzzle.rotation.x = Math.PI / 2 - 0.35; muzzle.position.set(0, 1.6, 3.7); g.add(muzzle);
  for (const sx of [-1, 1]) { const trail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 3.0), ol); trail.position.set(sx * 0.5, -0.7, -1.6); trail.rotation.set(0.15, sx * 0.25, 0); g.add(trail); }
  return g;
}
function addLegs(g, spec) {
  const pants = mat((spec.body && spec.legColor) || '#5C5B3B', { r: 0.85 }), boot = mat('#4A2E1C', { r: 0.6 });
  const ph = spec.legPhase || 0;
  for (const sx of [-1, 1]) { const sw = Math.sin(ph + (sx > 0 ? 0 : Math.PI)) * 0.35; const leg = capsule(0.24, 0.55, pants); leg.position.set(sx * 0.42, -2.25, 0.1 + sw * 0.4); leg.rotation.x = sw; g.add(leg);
    const b = ellipsoid(0.3, 0.2, 0.42, boot); b.position.set(sx * 0.42, -2.75, 0.25 + sw * 0.8); g.add(b); }
}
function buildChair(spec) {
  const g = new THREE.Group(); const red = mat(spec.chair || '#A8322B', { r: 0.7 }), cream = mat('#EDE2C8', { r: 0.7 }), wood = mat('#5A3420', { r: 0.6 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.8), cream); seat.position.set(0, -2.0, 0.1); g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.45), red); back.position.set(0, -0.9, -0.9); g.add(back);
  const backTop = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.45, 32, 1, false, -Math.PI / 2, Math.PI), red); backTop.rotation.x = Math.PI / 2; backTop.position.set(0, 0.4, -0.9); g.add(backTop);
  for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 1.9), red); arm.position.set(sx * 1.35, -1.55, 0.1); g.add(arm); const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.95, 20), red); roll.rotation.x = Math.PI / 2; roll.position.set(sx * 1.35, -1.05, 0.1); g.add(roll);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), wood); leg.position.set(sx * 1.2, -2.45, 0.8); g.add(leg); }
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.3, 1.9), red); skirt.position.set(0, -2.32, 0.1); g.add(skirt);
  return g;
}

export function build(spec) {
  if (spec.chairIn) { const g = new THREE.Group(); const ch = buildChair(spec); const c = build({ ...spec, chairIn: false, outline: false }); c.scale.setScalar(0.92); c.position.set(0, 0.2, 0.25); g.add(ch); g.add(c); if (spec.outline !== false) addOutline(g, spec.outlineColor, spec.outlineWidth); return g; }
  if (spec.kind === 'howitzer') { const g = buildHowitzer(spec); addOutline(g, '#2B1A10', 0.03); return g; }
  if (spec.kind === 'plane' || spec.kind === 'ship') { const g = spec.kind === 'plane' ? buildPlane(spec) : buildShip(spec); if (spec.outline !== false) addOutline(g, spec.outlineColor, 0.03); return g; }
  const g = new THREE.Group();
  buildHead(g, spec); buildHat(g, spec); buildBody(g, spec); buildArms(g, spec); if (spec.legs) addLegs(g, spec);
  if (spec.outline !== false) addOutline(g, spec.outlineColor, spec.outlineWidth);
  return g;
}

export function stage(renderer, w, h, view) {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(24, w / h, 0.1, 100);
  if (view === 'top') { cam.position.set(0, 14, 0.01); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); } else if (view === 'top3q') { cam.position.set(0, 12, 6); cam.lookAt(0, 0, 0); } else { cam.position.set(1.6, 1.9, 11.5); cam.lookAt(0, -0.55, 0); }
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x6b5a48, 1.25));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4); key.position.set(-4, 6, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd29a, 2.2); rim.position.set(5, 3, -5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.6); fill.position.set(5, -1, 6); scene.add(fill);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
  return { scene, cam };
}
export { THREE };
