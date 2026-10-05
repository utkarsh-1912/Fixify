import { describe, it, expect } from 'vitest';
import { encryptMessage, decryptMessage, validatePassphrase } from '@/lib/chatCrypto';
import { encryptMessage as legacyEncrypt } from '@/lib/cipher';

const IT = 1000; // fast iteration count for tests; production uses PBKDF2_ITERATIONS
const KEY = 'correct horse battery';

describe('chatCrypto (AES-GCM)', () => {
  it('round-trips unicode and FIX payloads', async () => {
    const msg = '8=FIX.4.4\x019=5\x0135=0\x0110=000\x01 héllo ✓ 🔒';
    const ct = await encryptMessage(msg, KEY, 'room1', IT);
    expect(ct.startsWith('v2.')).toBe(true);
    expect(ct).not.toContain('FIX');
    expect(await decryptMessage(ct, KEY, 'room1', IT)).toEqual({ ok: true, text: msg, legacy: false });
  });

  it('uses a fresh random IV: same plaintext never encrypts the same way twice', async () => {
    const a = await encryptMessage('same', KEY, 'r', IT);
    const b = await encryptMessage('same', KEY, 'r', IT);
    expect(a).not.toBe(b);
  });

  it('fails closed on a wrong key, wrong room, tampering and garbage', async () => {
    const ct = await encryptMessage('secret', KEY, 'room1', IT);
    expect((await decryptMessage(ct, 'another passphrase', 'room1', IT)).ok).toBe(false);
    expect((await decryptMessage(ct, KEY, 'room2', IT)).ok).toBe(false); // AAD binds the room
    const flipped = ct.slice(0, -3) + (ct.at(-3) === 'A' ? 'B' : 'A') + ct.slice(-2);
    expect((await decryptMessage(flipped, KEY, 'room1', IT)).ok).toBe(false);
    expect((await decryptMessage('v2.AAAA', KEY, 'room1', IT)).ok).toBe(false);
    expect((await decryptMessage('v2.!!!', KEY, 'room1', IT)).ok).toBe(false);
    expect((await decryptMessage(null, KEY, 'room1', IT)).ok).toBe(false);
  });

  it('requires a real passphrase (no default key)', async () => {
    expect(validatePassphrase('')).toMatch(/at least 8/);
    expect(validatePassphrase('short')).toMatch(/at least 8/);
    expect(validatePassphrase('long enough key')).toBeNull();
    await expect(encryptMessage('x', 'short', 'r', IT)).rejects.toThrow(/at least 8/);
  });

  it('can still read (and flags) messages from the old unauthenticated cipher', async () => {
    const old = legacyEncrypt('old message', KEY);
    expect(await decryptMessage(old, KEY, 'room1', IT)).toEqual({ ok: true, text: 'old message', legacy: true });
  });
});
