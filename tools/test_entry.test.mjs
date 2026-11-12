// The Arena X entry tile: hidden until the decrypted links hold entry_arenax,
// then it opens that link. Every link here is invented; the real address is
// never written in this public repo.
//   node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

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
