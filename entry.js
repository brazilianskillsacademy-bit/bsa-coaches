// The Arena X attendance entry tile. Its link is one more key in the encrypted
// links file; the address is never written in this repo. With no https link
// under the tile's key, the tile and its section label stay hidden.
window.BSAEntry = (function () {
  function pick(links, key) {
    var v = links && links[key];
    if (typeof v !== 'string' || !v || /\s/.test(v)) return null;
    try {
      return new URL(v).protocol === 'https:' ? v : null;
    } catch (e) { return null; }
  }
  function show(doc, links, open) {
    Array.prototype.forEach.call(doc.querySelectorAll('[data-entry]'), function (tile) {
      var link = pick(links, tile.getAttribute('data-entry'));
      if (!link) return;
      var label = doc.getElementById(tile.getAttribute('data-entry-label'));
      tile.hidden = false;
      if (label) label.hidden = false;
      tile.onclick = function () { open(link, '_blank', 'noopener'); };
    });
  }
  return { pick: pick, show: show };
})();
