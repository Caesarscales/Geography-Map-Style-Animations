// node shoot.js specs.json outdir  -> renders each spec to a transparent PNG
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const [specFile, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const root = __dirname;
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(f).pipe(r); }).listen(0, async () => { const port = srv.address().port;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); p.on('console', m => console.log('page:', m.text())); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:' + port + '/render.html?w=' + (process.env.SW || 600)); await p.setViewportSize({ width: +(process.env.SW || 600), height: +(process.env.SW || 600) * 4 / 3 }); await p.waitForFunction('window.ready');
  const specs = JSON.parse(fs.readFileSync(specFile));
  for (const [name, spec] of Object.entries(specs)) {
    const d = await p.evaluate(s => window.renderSpec(s), spec);
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(d.split(',')[1], 'base64')); console.log('wrote', name);
  }
  await b.close(); srv.close();
});
