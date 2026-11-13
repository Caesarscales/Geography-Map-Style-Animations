// node engine/render.js <project> [from] [to] [--frames f1,f2,..] [--scale 0.5]
// Renders projects/<project>/out/video_noaudio.mp4 (or stills) and writes out/sfx_events.json for the mixer.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http'); const { spawn } = require('child_process');
const args = process.argv.slice(2); const proj = args[0]; const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const root = path.join(__dirname, '..'); const outDir = path.join(root, 'projects', proj, 'out'); fs.mkdirSync(outDir, { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(0, async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('pageerror', e => console.log('PAGE ERROR', e.message)); p.on('console', m => { const t = m.text(); if (/error|failed|missing/i.test(t)) console.log('page:', t); });
  await p.goto(`http://localhost:${srv.address().port}/engine/page.html?p=${encodeURIComponent(proj)}`); await p.waitForFunction('window.ready', null, { timeout: 300000 });
  const total = await p.evaluate('window.total'); fs.writeFileSync(path.join(outDir, 'sfx_events.json'), JSON.stringify(await p.evaluate('window.sfx')));
  const frames = opt('--frames') ? opt('--frames').split(',').map(Number) : null; const A = +(args[1] && !args[1].startsWith('--') ? args[1] : 0), B = +(args[2] && !args[2].startsWith('--') ? args[2] : total); const scale = +opt('--scale', 1);
  if (frames) { const dir = path.join(outDir, 'stills'); fs.mkdirSync(dir, { recursive: true }); for (const f of frames) { const d = await p.evaluate(f => window.grab(f), f); fs.writeFileSync(path.join(dir, `f${String(f).padStart(4, '0')}.jpg`), Buffer.from(d.split(',')[1], 'base64')); } console.log('stills ->', dir); }
  else { const out = path.join(outDir, 'video_noaudio.mp4'); const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '30', '-i', '-', '-vf', `scale=${Math.round(1080 * scale / 2) * 2}:${Math.round(1920 * scale / 2) * 2}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now(); for (let f = A; f < B; f++) { const d = await p.evaluate(f => window.grab(f), f); if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r)); if (f % 150 === 0) console.log(`frame ${f}/${B} ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('video ->', out); }
  await b.close(); srv.close();
});
