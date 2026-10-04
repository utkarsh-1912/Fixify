import { describe, it, expect } from 'vitest';
import { buildFixMessage, fixChecksum, fixTimestamp, parseFixTimestamp, byteLength, detectDelimiter } from '@/lib/fixWire';
import { validateFIXMessage } from '@/lib/fixParser';

const pipe = (s) => s.split('\x01').join('|');

describe('fixWire', () => {
  it('computes checksum modulo 256 over bytes, zero padded', () => {
    expect(fixChecksum('')).toBe('000');
    expect(fixChecksum('A')).toBe('065');
    expect(fixChecksum('\xff'.repeat(0) + 'é')).toBe(fixChecksum('é')); // multi-byte handled consistently
    expect(byteLength('é')).toBe(2);
  });

  it('builds messages that validate, ignoring caller supplied 8/9/10', () => {
    const { message } = buildFixMessage([
      { tag: '8', val: 'FIX.4.2' }, { tag: '9', val: '999' }, { tag: '35', val: '0' }, { tag: '49', val: 'A' }, { tag: '10', val: '000' },
    ]);
    const v = validateFIXMessage(pipe(message));
    expect(v.errors).toEqual([]);
    expect(v.tags['8']).toBe('FIX.4.2');
  });

  it('formats and parses UTCTimestamps symmetrically', () => {
    const d = new Date(Date.UTC(2026, 6, 16, 1, 2, 3, 45));
    expect(fixTimestamp(d)).toBe('20260716-01:02:03.045');
    expect(parseFixTimestamp('20260716-01:02:03.045')).toBe(d.getTime());
    expect(parseFixTimestamp('20260716-01:02:03')).toBe(d.getTime() - 45);
    expect(parseFixTimestamp('2026-07-16')).toBeNull();
  });

  it('detects delimiters', () => {
    expect(detectDelimiter('a=1\x01b=2')).toBe('\x01');
    expect(detectDelimiter('a=1|b=2')).toBe('|');
    expect(detectDelimiter('a=1^Ab=2')).toBe('^A');
    expect(detectDelimiter('plain')).toBeNull();
  });
});

describe('validateFIXMessage regressions', () => {
  it('does not mistake tags ending in 10= / 9= (110=, 5010=, 49=) for CheckSum / BodyLength', () => {
    const { message } = buildFixMessage([
      { tag: '35', val: 'D' }, { tag: '49', val: 'S' }, { tag: '56', val: 'T' }, { tag: '110', val: '5' }, { tag: '5010', val: 'x' }, { tag: '1109', val: 'y' },
    ]);
    const v = validateFIXMessage(pipe(message));
    expect(v.errors).toEqual([]);
    expect(v.calculatedBodyLength).toBe(Number(v.bodyLength));
  });

  it('still reports genuine checksum and body length errors', () => {
    const { message } = buildFixMessage([{ tag: '35', val: '0' }, { tag: '49', val: 'S' }, { tag: '56', val: 'T' }]);
    const bad = pipe(message).replace(/10=\d{3}/, '10=000').replace(/9=\d+/, '9=1');
    const v = validateFIXMessage(bad);
    expect(v.errors.some((e) => /Checksum mismatch/.test(e))).toBe(true);
    expect(v.errors.some((e) => /BodyLength mismatch/.test(e))).toBe(true);
  });
});

describe('light parsing + scale', () => {
  it('light mode keeps tags/validation but drops the heavy tagList', () => {
    const { message } = buildFixMessage([{ tag: '35', val: 'D' }, { tag: '49', val: 'S' }, { tag: '56', val: 'T' }, { tag: '11', val: 'X' }]);
    const full = validateFIXMessage(pipe(message));
    const light = validateFIXMessage(pipe(message), undefined, { light: true });
    expect(light.tags).toEqual(full.tags);
    expect(light.errors).toEqual(full.errors);
    expect(light.tagList).toEqual([]);
    expect(full.tagList[0]).toHaveProperty('name');
  });

  it('parses 60k messages (~10 MB) in light mode quickly', () => {
    const { message } = buildFixMessage([{ tag: '35', val: 'D' }, { tag: '49', val: 'S' }, { tag: '56', val: 'T' }, { tag: '11', val: 'ORDER123456789' }, { tag: '55', val: 'AAPL' }, { tag: '58', val: 'x'.repeat(60) }]);
    const line = pipe(message);
    const t0 = Date.now();
    let ok = 0;
    for (let i = 0; i < 60000; i++) if (validateFIXMessage(line, undefined, { light: true }).isValid) ok++;
    expect(ok).toBe(60000);
    expect(Date.now() - t0).toBeLessThan(15000);
  }, 30000);
});
