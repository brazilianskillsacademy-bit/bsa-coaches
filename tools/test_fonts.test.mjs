// The coach app must not send a coach's IP address to Google: Anton and Inter
// are served from this repo, cached by the service worker, and render offline.
//   node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP_EXT = new Set(['.html', '.css', '.js', '.webmanifest']);
const appFiles = readdirSync(ROOT).filter((f) => APP_EXT.has(extname(f)));
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

function fontFaces() {
  const css = read('app.css');
  return [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => ({
    family: /font-family:\s*['"]?([^'";]+)/.exec(m[1])[1],
    src: /url\(['"]?([^'")]+)/.exec(m[1])[1],
  }));
}

function shell() {
  const m = /const SHELL = \[([^\]]*)\]/.exec(read('sw.js'));
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

test('no app file references googleapis or gstatic', () => {
  assert.ok(appFiles.includes('index.html') && appFiles.includes('app.css'));
  for (const f of appFiles) assert.ok(!/googleapis|gstatic/.test(read(f)), `${f} still loads Google Fonts`);
});

test('app.css declares Anton and Inter from woff2 files in the repo', () => {
  const faces = fontFaces();
  for (const family of ['Anton', 'Inter']) {
    const face = faces.find((x) => x.family === family);
    assert.ok(face, `no @font-face for ${family}`);
    assert.doesNotMatch(face.src, /^(https?:)?\/\//, `${family} is not local`);
    const buf = readFileSync(join(ROOT, face.src));
    assert.equal(buf.subarray(0, 4).toString('latin1'), 'wOF2', `${face.src} is not woff2`);
  }
});

test('the service worker caches both fonts and every shell file exists', () => {
  const files = shell();
  for (const { src } of fontFaces()) assert.ok(files.includes(src), `${src} not in SHELL`);
  for (const f of files) if (f !== './') assert.ok(existsSync(join(ROOT, f)), `${f} missing`);
});

// Headless Chrome with every host but 127.0.0.1 unresolvable: both pages must
// load Anton and Inter and request nothing off the app's own origin.
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json' };
const PROBE = `<script>
document.fonts.ready.then(function () {
  return Promise.all([document.fonts.load('16px Anton'), document.fonts.load('700 16px Inter')]);
}).then(function () {
  var loaded = [];
  document.fonts.forEach(function (f) { if (f.status === 'loaded') loaded.push(f.family.replace(/["']/g, '')); });
  var off = performance.getEntriesByType('resource').filter(function (r) {
    return new URL(r.name).origin !== location.origin;
  }).length;
  document.body.setAttribute('data-probe', JSON.stringify({ loaded: loaded, off: off }));
});
</script>`;

test('both pages render Anton and Inter with the network off', { skip: !existsSync(CHROME) && 'Chrome not installed' }, async () => {
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    const file = join(ROOT, path === '/' ? 'index.html' : path.slice(1));
    if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
    let body = readFileSync(file);
    if (extname(file) === '.html') body = body.toString('utf8').replace('</body>', PROBE + '</body>');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const profile = mkdtempSync(join(tmpdir(), 'bsa-coach-fonts-'));
  try {
    for (const page of ['index.html', 'attendance.html']) {
      const dom = await new Promise((resolve, reject) => execFile(CHROME, [
        '--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`,
        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
        '--virtual-time-budget=8000', '--dump-dom',
        `http://127.0.0.1:${server.address().port}/${page}`,
      ], { timeout: 60000 }, (err, out) => (err ? reject(err) : resolve(out))));
      const m = /data-probe="([^"]*)"/.exec(dom);
      assert.ok(m, `${page}: probe did not run`);
      const probe = JSON.parse(m[1].replace(/&quot;/g, '"'));
      assert.ok(probe.loaded.includes('Anton'), `${page}: Anton not loaded`);
      assert.ok(probe.loaded.includes('Inter'), `${page}: Inter not loaded`);
      assert.equal(probe.off, 0, `${page}: requests left the origin`);
    }
  } finally {
    server.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
