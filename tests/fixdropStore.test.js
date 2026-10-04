import { describe, it, expect } from 'vitest';
import { RoomStore, RateLimiter, StoreError, dataUrlBytes, sanitizeFileName, isValidPin } from '@/lib/fixdropStore';

const mkClock = () => {
  const c = { t: 1_000_000 };
  c.now = () => c.t;
  return c;
};
const b64 = (n) => Buffer.alloc(n, 1).toString('base64');
const file = (n, extra = {}) => ({ type: 'file', name: 'a.bin', dataUrl: `data:application/octet-stream;base64,${b64(n)}`, ...extra });

describe('validation', () => {
  it('accepts only 4-8 digit PINs', () => {
    ['1234', '12345678', ' 7492 '].forEach((p) => expect(isValidPin(p)).toBe(true));
    ['ping', '123', '123456789', '12a4', '', null].forEach((p) => expect(isValidPin(p)).toBe(false));
  });
  it('sanitizes file names and rejects non-base64 data urls', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('etc_passwd');
    expect(sanitizeFileName('a\u0000b\nc.txt')).toBe('abc.txt');
    expect(() => dataUrlBytes('data:text/html,<script>alert(1)</script>')).toThrow(StoreError);
    expect(() => dataUrlBytes('javascript:alert(1)')).toThrow(StoreError);
    expect(dataUrlBytes(`data:x/y;base64,${b64(10)}`)).toBe(10);
  });
});

describe('RoomStore items', () => {
  it('stores newest first, computes size server-side and caps items per room', () => {
    const s = new RoomStore({ limits: { maxItemsPerRoom: 3 } });
    for (let i = 0; i < 5; i++) s.add('1111', { type: 'text', content: `m${i}`, sender: 'A' });
    expect(s.list('1111').map((i) => i.content)).toEqual(['m4', 'm3', 'm2']);
    const f = s.add('2222', file(2048, { size: '1 TB (lie)' })).item;
    expect(f.size).toBe('2.0 KB');
  });

  it('rejects oversize items and text, and enforces per-room and global byte caps', () => {
    const s = new RoomStore({ limits: { maxItemBytes: 1000, maxRoomBytes: 2500, maxTotalBytes: 4000, maxTextBytes: 10 } });
    expect(() => s.add('1111', file(2000))).toThrowError(/too large/);
    expect(() => s.add('1111', { content: 'x'.repeat(11) })).toThrowError(/too large/);
    for (let i = 0; i < 5; i++) s.add('1111', file(900, { id: `f${i}` }));
    expect(s.list('1111').length).toBeLessThanOrEqual(2);
    s.add('2222', file(900));
    s.add('3333', file(900));
    expect(() => s.add('4444', file(900))).toThrowError(/relay is full/);
  });

  it('limits the number of rooms', () => {
    const s = new RoomStore({ limits: { maxRooms: 2 } });
    s.add('1111', { content: 'a' });
    s.add('2222', { content: 'a' });
    expect(() => s.add('3333', { content: 'a' })).toThrowError(/Too many/);
    s.add('1111', { content: 'b' });
  });

  it('expires rooms after the TTL', () => {
    const c = mkClock();
    const s = new RoomStore({ now: c.now });
    s.add('1111', { content: 'a' });
    c.t += 31 * 60 * 1000;
    expect(s.list('1111')).toEqual([]);
  });

  it('only lets owners delete their items', () => {
    const s = new RoomStore();
    const { item } = s.add('1111', { content: 'a', senderId: 'me' });
    expect(() => s.remove('1111', item.id, 'other')).toThrowError(/Unauthorized/);
    expect(() => s.remove('1111', 'nope', 'me')).toThrowError(/not found/);
    expect(s.remove('1111', item.id, 'me')).toBe(0);
  });
});

describe('signalling', () => {
  it('routes targeted signals to the target once, never to others', () => {
    const s = new RoomStore();
    s.addSignal('1111', { sender: 'R', signal: { type: 'offer', targetPeerId: 'S' } });
    expect(s.takeSignals('1111', 'X')).toEqual([]);
    expect(s.takeSignals('1111', 'S')).toHaveLength(1);
    expect(s.takeSignals('1111', 'S')).toEqual([]);
  });

  it('delivers a broadcast signal once to every other peer (regression: only the first reader got it)', () => {
    const s = new RoomStore();
    s.addSignal('1111', { sender: 'A', signal: { type: 'hello' } });
    expect(s.takeSignals('1111', 'A')).toEqual([]);
    expect(s.takeSignals('1111', 'B')).toHaveLength(1);
    expect(s.takeSignals('1111', 'C')).toHaveLength(1);
    expect(s.takeSignals('1111', 'B')).toEqual([]);
  });

  it('expires signals and bounds the queue', () => {
    const c = mkClock();
    const s = new RoomStore({ now: c.now, limits: { maxSignalsPerRoom: 3 } });
    for (let i = 0; i < 10; i++) s.addSignal('1111', { sender: 'A', signal: { i, targetPeerId: 'B' } });
    expect(s.takeSignals('1111', 'B')).toHaveLength(3);
    s.addSignal('1111', { sender: 'A', signal: { targetPeerId: 'B' } });
    c.t += 121_000;
    expect(s.takeSignals('1111', 'B')).toEqual([]);
  });
});

describe('RateLimiter', () => {
  it('blocks after the limit and recovers after the window', () => {
    const c = mkClock();
    const r = new RateLimiter({ limit: 2, windowMs: 1000, now: c.now });
    expect([r.allow('ip'), r.allow('ip'), r.allow('ip'), r.allow('other')]).toEqual([true, true, false, true]);
    c.t += 1001;
    expect(r.allow('ip')).toBe(true);
  });
});
