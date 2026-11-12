// The Arena X entry tile: hidden until the decrypted links hold entry_arenax,
// then it opens that link. Every link here is invented; the real address is
// never written in this public repo.
//   node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const LINK = 'https://example.test/entry';

function loadEntry() {
  const ctx = { window: {}, URL };
  vm.runInNewContext(read('entry.js'), ctx);
  return ctx.window.BSAEntry;
}

// A stand-in document: one tile and the section label it names.
function standIn() {
  const el = (attrs) => ({ hidden: true, onclick: null, getAttribute: (k) => (k in attrs ? attrs[k] : null) });
  const label = el({ id: 'entryLabel' });
  const tile = el({ 'data-entry': 'entry_arenax', 'data-entry-label': 'entryLabel' });
  const doc = {
    querySelectorAll: (sel) => (sel === '[data-entry]' ? [tile] : []),
    getElementById: (id) => (id === 'entryLabel' ? label : null),
  };
  return { doc, tile, label };
}

test('BSAEntry.pick keeps only an https link and show un-hides the tile only with one', () => {
  const E = loadEntry();
  assert.equal(E.pick({ entry_arenax: LINK }, 'entry_arenax'), LINK);
  for (const v of [undefined, '', '   ', 'http://example.test/entry', 'javascript:alert(document.domain)',
    'https://example.test/ entry', ' https://example.test/entry', 'not a link', 42, { href: LINK }, [LINK], null]) {
    assert.equal(E.pick({ entry_arenax: v }, 'entry_arenax'), null, `accepted ${JSON.stringify(v)}`);
  }
  assert.equal(E.pick({}, 'entry_arenax'), null);
  assert.equal(E.pick(null, 'entry_arenax'), null);

  const on = standIn();
  const calls = [];
  E.show(on.doc, { entry_arenax: LINK, arenax: 'https://example.test/sheet' }, (...a) => calls.push(a));
  assert.equal(on.tile.hidden, false);
  assert.equal(on.label.hidden, false);
  assert.equal(typeof on.tile.onclick, 'function');
  on.tile.onclick();
  assert.deepEqual(calls, [[LINK, '_blank', 'noopener']]);

  const off = standIn();
  E.show(off.doc, { arenax: 'https://example.test/sheet' }, () => assert.fail('opened with no link'));
  assert.equal(off.tile.hidden, true);
  assert.equal(off.label.hidden, true);
  assert.equal(off.tile.onclick, null);
});

// The tile's own markup: the button carrying data-entry and the label it names.
function entryMarkup(html) {
  const tiles = [...html.matchAll(/<button\b[^>]*\sdata-entry="[^"]*"[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]);
  const labels = tiles.map((t) => {
    const id = /\sdata-entry-label="([^"]+)"/.exec(t)[1];
    return new RegExp(`<[a-z]+\\b[^>]*\\sid="${id}"[^>]*>[\\s\\S]*?</[a-z]+>`).exec(html)[0];
  });
  return { tiles, labels };
}

test('attendance.html carries one hidden entry tile and the six sheet buttons of today', () => {
  const html = read('attendance.html');
  assert.equal((html.match(/\sdata-entry="/g) || []).length, 1);
  const { tiles: [tile], labels: [label] } = entryMarkup(html);
  assert.match(tile, /\sdata-entry="entry_arenax"/);
  assert.match(tile, /^<button\b[^>]*\shidden[\s>]/);
  assert.match(label, /^<[a-z]+\b[^>]*\shidden[\s>]/);
  assert.match(label, /class="section"/);
  assert.doesNotMatch(tile, /data-key/);
  assert.match(label, />Arena X coaches</);
  assert.match(tile, /<span class="t">Attendance entry<\/span>/);
  assert.match(tile, /<span class="d">Arena X: enter who came, after your session<\/span>/);
  assert.doesNotMatch(tile, /class="n"/);
  const venues = html.indexOf('<section id="venues"');
  assert.ok(venues < html.indexOf(label) && html.indexOf(tile) < html.indexOf('<div class="section">Skills</div>'));
  const entryJs = html.indexOf('<script src="entry.js"></script>');
  assert.ok(html.indexOf('<script src="crypto.js"></script>') < entryJs && entryJs < html.indexOf('<script>\n'));
  assert.match(html, /BSAEntry\.show\(document, links, window\.open\)/);
  assert.deepEqual([...html.matchAll(/\sdata-key="([^"]+)"/g)].map((m) => m[1]),
    ['sunningdale', 'tafelberg', 'arenax', 'fgm', 'hp', 'kids']);
});

test('the service worker caches entry.js under a new cache name', () => {
  const sw = read('sw.js');
  const shell = [.../const SHELL = \[([^\]]*)\]/.exec(sw)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(shell.includes('entry.js'), 'entry.js not in SHELL');
  for (const f of shell) if (f !== './') assert.ok(existsSync(join(ROOT, f)), `${f} missing`);
  assert.match(sw, /const CACHE = 'bsa-coaches-v4';/);
});

test('the home page drops the roll call placeholder and gains no entry tile', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /Roll call/i);
  assert.equal((html.match(/class="tile off"/g) || []).length, 1);
  assert.deepEqual([...html.matchAll(/<span class="n">([^<]*)<\/span>/g)].map((m) => m[1]), ['1', '2']);
  assert.doesNotMatch(html, /entry\.js|data-entry/);
});

// The repo is public: no tracked file names the academy's own web domain (the
// entry page's address lives only in the encrypted links), and the tile and
// its script carry no number a PIN could hide in.
test('no tracked file holds the academy domain and the tile holds no digit', () => {
  const domain = ['brazilianskills', 'academy.com'].join('');
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  assert.ok(tracked.includes('entry.js') && tracked.includes('attendance.html'));
  for (const f of tracked) {
    assert.ok(!readFileSync(join(ROOT, f), 'latin1').toLowerCase().includes(domain), `${f} holds the academy domain`);
  }
  const { tiles, labels } = entryMarkup(read('attendance.html'));
  for (const [name, text] of [['entry.js', read('entry.js')], ...tiles.map((t) => ['tile', t]), ...labels.map((l) => ['label', l])]) {
    assert.doesNotMatch(text, /[0-9]/, `${name} holds a digit`);
  }
});
