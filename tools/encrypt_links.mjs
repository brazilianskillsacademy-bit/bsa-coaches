// Re-encrypts the venue sheet links into links.enc.json.
// Reads the plain links and the coach password from ~/.bsa_secrets (never the repo).
//   node tools/encrypt_links.mjs            encrypt with the current password
//   node tools/encrypt_links.mjs --check    decrypt links.enc.json and list the venues
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto as crypto } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SECRETS = join(homedir(), '.bsa_secrets');
const OUT = join(ROOT, 'links.enc.json');
const ITER = 600000;
const enc = new TextEncoder();
const b64 = (u8) => Buffer.from(u8).toString('base64');

const password = readFileSync(join(SECRETS, 'coach_app_password.txt'), 'utf8').trim().toLowerCase();

async function key(salt, usage) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, [usage]);
}

if (process.argv.includes('--check')) {
  const blob = JSON.parse(readFileSync(OUT, 'utf8'));
  const k = await key(Buffer.from(blob.salt, 'base64'), 'decrypt');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(blob.iv, 'base64') }, k, Buffer.from(blob.ct, 'base64'));
  const links = JSON.parse(new TextDecoder().decode(pt));
  for (const [venue, url] of Object.entries(links)) console.log(venue.padEnd(12), url ? 'link ok' : 'NO LINK');
} else {
  const links = JSON.parse(readFileSync(join(SECRETS, 'coach_app_links.json'), 'utf8'));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await key(salt, 'encrypt');
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify(links))));
  writeFileSync(OUT, JSON.stringify({ v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) }) + '\n');
  console.log('wrote links.enc.json with', Object.keys(links).length, 'venues');
}
