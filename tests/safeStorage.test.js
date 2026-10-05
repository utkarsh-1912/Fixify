import { describe, it, expect, vi } from 'vitest';
import { installSafeStorage, isQuotaError } from '@/lib/safeStorage';

const makeStorage = (limit) => {
  class FakeStorage {
    constructor() { this.m = new Map(); }
    setItem(k, v) {
      if ([...this.m.entries()].reduce((n, [kk, vv]) => (kk === k ? n : n + vv.length), 0) + String(v).length > limit) {
        throw Object.assign(new Error('full'), { name: 'QuotaExceededError', code: 22 });
      }
      this.m.set(k, String(v));
    }
    getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
    removeItem(k) { this.m.delete(k); }
  }
  return FakeStorage;
};

describe('safeStorage', () => {
  it('swallows quota errors, drops the stale value and keeps other writes working', () => {
    const S = makeStorage(10);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(installSafeStorage(S)).toBe(true);
    expect(installSafeStorage(S)).toBe(false); // idempotent
    const s = new S();
    s.setItem('a', '1234');
    expect(() => s.setItem('big', 'x'.repeat(50))).not.toThrow();
    expect(s.getItem('big')).toBeNull();
    s.setItem('a', '1234');
    s.setItem('a', 'new');
    expect(s.getItem('a')).toBe('new');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('removes a stale larger value when an update no longer fits', () => {
    const S = makeStorage(10);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    installSafeStorage(S);
    const s = new S();
    s.setItem('k', 'old');
    s.setItem('k', 'y'.repeat(40));
    expect(s.getItem('k')).toBeNull();
  });

  it('re-throws unrelated errors and recognises quota variants', () => {
    class S2 { setItem() { throw new TypeError('boom'); } removeItem() {} }
    installSafeStorage(S2);
    expect(() => new S2().setItem('a', 'b')).toThrow('boom');
    expect(isQuotaError({ name: 'QuotaExceededError' })).toBe(true);
    expect(isQuotaError({ code: 1014 })).toBe(true);
    expect(isQuotaError(new Error('x'))).toBe(false);
  });
});
