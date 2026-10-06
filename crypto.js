// Decrypts links.enc.json in the browser. The sheet links never sit in this
// repo as plain text: tools/encrypt_links.mjs writes them encrypted with the
// coach password (PBKDF2-SHA256 -> AES-256-GCM).
window.BSACrypto = (function () {
  function b64(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function decrypt(blob, password) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: b64(blob.salt), iterations: blob.iter, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      })
      .then(function (key) {
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(blob.iv) }, key, b64(blob.ct));
      })
      .then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); });
  }
  return { decrypt: decrypt };
})();
