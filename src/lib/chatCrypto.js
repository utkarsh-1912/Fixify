// Chat encryption: AES-256-GCM with a key derived from the room passphrase via PBKDF2-SHA256.
//
//  - Authenticated: a tampered or wrongly-keyed message fails to decrypt instead of yielding garbage.
//  - Fresh random 96-bit IV per message (crypto.getRandomValues, never Math.random).
//  - The room id is bound in as AAD, so a ciphertext cannot be replayed into another room.
//  - Wire format: "v2." + base64url(iv || ciphertext || tag).
//
// Messages written by the old home-made cipher (no "v2." prefix) can still be READ, but are flagged
// `legacy: true` because that format had no authentication.

import { decryptMessage as decryptLegacy } from './cipher';

export const MIN_PASSPHRASE_LENGTH = 8;
export const PBKDF2_ITERATIONS = 310000;
const PREFIX = 'v2.';
const enc = new TextEncoder();
const dec = new TextDecoder();
const keyCache = new Map();

const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('WebCrypto is unavailable (secure context required).');
  return s;
};

const toB64Url = (bytes) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64Url = (str) => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export function validatePassphrase(p) {
  if (!p || p.trim().length < MIN_PASSPHRASE_LENGTH) {
    return `Use a secret key of at least ${MIN_PASSPHRASE_LENGTH} characters.`;
  }
  return null;
}

export async function deriveRoomKey(passphrase, roomId, iterations = PBKDF2_ITERATIONS) {
  const cacheKey = `${iterations}|${roomId}|${passphrase}`;
  if (!keyCache.has(cacheKey)) {
    keyCache.set(
      cacheKey,
      (async () => {
        const material = await subtle().importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
        return subtle().deriveKey(
          { name: 'PBKDF2', salt: enc.encode(`fixify-chat-v2:${roomId}`), iterations, hash: 'SHA-256' },
          material,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
      })()
    );
    if (keyCache.size > 20) keyCache.delete(keyCache.keys().next().value);
  }
  return keyCache.get(cacheKey);
}

export async function encryptMessage(plaintext, passphrase, roomId, iterations) {
  const problem = validatePassphrase(passphrase);
  if (problem) throw new Error(problem);
  const key = await deriveRoomKey(passphrase, roomId, iterations);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(roomId) }, key, enc.encode(plaintext))
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return PREFIX + toB64Url(out);
}

/** Returns { ok, text, legacy }. Never throws. */
export async function decryptMessage(payload, passphrase, roomId, iterations) {
  const failed = { ok: false, text: '[Decryption Failed: Invalid Key or Corrupted Data]', legacy: false };
  if (typeof payload !== 'string') return failed;
  try {
    if (!payload.startsWith(PREFIX)) {
      const text = decryptLegacy(payload, passphrase);
      return /^\[Decryption Failed/.test(text) ? failed : { ok: true, text, legacy: true };
    }
    const bytes = fromB64Url(payload.slice(PREFIX.length));
    if (bytes.length < 12 + 16) return failed;
    const key = await deriveRoomKey(passphrase, roomId, iterations);
    const pt = await subtle().decrypt(
      { name: 'AES-GCM', iv: bytes.subarray(0, 12), additionalData: enc.encode(roomId) },
      key,
      bytes.subarray(12)
    );
    return { ok: true, text: dec.decode(pt), legacy: false };
  } catch {
    return failed;
  }
}
