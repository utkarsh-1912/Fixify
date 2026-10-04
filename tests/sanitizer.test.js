import { describe, it, expect } from 'vitest';
import { sanitizeLog, luhnValid } from '@/lib/sanitizer';
import { validateFIXMessage } from '@/lib/fixParser';
import { buildFixMessage } from '@/lib/fixWire';

const msg = (fields) => buildFixMessage(fields.map(([tag, val]) => ({ tag, val }))).message.split('\x01').join('|');
const LOGON = msg([['35', 'A'], ['49', 'SENDER_A'], ['56', 'TARGET_B'], ['34', '1'], ['554', 'MySecretPassword99'], ['110', '5']]);
const ALL_OFF = {};

describe('sanitizeLog', () => {
  it('masks credentials and keeps BodyLength/CheckSum valid (including a 110= tag)', async () => {
    expect(validateFIXMessage(LOGON).isValid).toBe(true);
    const { output, stats } = await sanitizeLog(LOGON, { groups: { credentials: true } });
    expect(output).not.toContain('MySecretPassword99');
    expect(output).toContain('554=[MASKED]');
    expect(validateFIXMessage(output).errors).toEqual([]);
    expect(stats.fieldsMasked).toBe(1);
    expect(stats.messageCount).toBe(1);
  });

  it('never touches structural tags 8/9/10 even if listed as custom tags', async () => {
    const { output } = await sanitizeLog(LOGON, { customTags: '8,9,10', groups: ALL_OFF });
    expect(output).toBe(LOGON);
  });

  it('passes non-FIX lines through untouched instead of fabricating headers', async () => {
    const text = 'INFO started pid=42 user=bob\n' + LOGON;
    const { output, stats } = await sanitizeLog(text, { groups: ALL_OFF });
    expect(output.split('\n')[0]).toBe('INFO started pid=42 user=bob');
    expect(stats.skippedLines).toBe(1);
    expect(stats.messageCount).toBe(1);
  });

  it('preserves log prefixes and the original delimiter', async () => {
    const line = `2026-07-16 12:00:00 INFO ${LOGON}`;
    const { output } = await sanitizeLog(line, { groups: { compIds: true } });
    expect(output.startsWith('2026-07-16 12:00:00 INFO 8=FIX.4.4|')).toBe(true);
    expect(output).toContain('49=[MASKED]|');
    const soh = LOGON.split('|').join('\x01');
    expect((await sanitizeLog(soh, { groups: { compIds: true } })).output).toContain('\x0149=[MASKED]\x01');
  });

  it('pseudonymizes deterministically with a keyed hash and requires a salt', async () => {
    const two = LOGON + '\n' + LOGON;
    const opts = { groups: { compIds: true }, useHashing: true, salt: 'k1' };
    const a = (await sanitizeLog(two, opts)).output.split('\n');
    expect(a[0]).toBe(a[1]);
    expect(a[0]).not.toContain('SENDER_A');
    expect(validateFIXMessage(a[0]).errors).toEqual([]);
    const b = (await sanitizeLog(LOGON, { ...opts, salt: 'k2' })).output;
    expect(b).not.toBe(a[0]);
    await expect(sanitizeLog(LOGON, { ...opts, salt: '' })).rejects.toThrow(/salt/);
  });

  it('only redacts real card numbers (Luhn) and valid IPv4 addresses, not timestamps/order ids', async () => {
    expect(luhnValid('4111111111111111')).toBe(true);
    const line = msg([['35', 'D'], ['58', 'pay 4111 1111 1111 1111 from 10.1.2.3'], ['37', '1234567890123456'], ['60', '20260716-12:00:00.000'], ['58', 'v1.2.3.999']]);
    const { output } = await sanitizeLog(line, { groups: { pii: true, ips: true } });
    expect(output).toContain('****-****-****-****');
    expect(output).toContain('xxx.xxx.xxx.xxx');
    expect(output).toContain('37=1234567890123456');
    expect(output).toContain('60=20260716-12:00:00.000');
    expect(output).toContain('v1.2.3.999');
  });

  it('applies tag remaps per field (every line) and rejects bad remap input', async () => {
    const two = LOGON + '\n' + LOGON;
    const { output, warnings } = await sanitizeLog(two, { groups: ALL_OFF, remaps: '56=DEST, x=1, 9=NOPE, 49=a=b' });
    expect(output.split('\n').every((l) => l.includes('|DEST=TARGET_B|'))).toBe(true);
    expect(warnings).toHaveLength(3);
  });

  it('strips delimiter characters from the replacement so messages cannot break', async () => {
    const { output } = await sanitizeLog(LOGON, { groups: { credentials: true }, replacement: 'a|b' });
    expect(output).toContain('554=ab|');
    expect(validateFIXMessage(output).errors).toEqual([]);
  });
});

describe('large inputs', () => {
  it('processes ~12 MB of log lines, reports progress and yields between chunks', async () => {
    const line = LOGON + '\n';
    const text = line.repeat(Math.ceil((12 * 1024 * 1024) / line.length));
    expect(text.length).toBeGreaterThan(10 * 1024 * 1024);
    const progress = [];
    const { output, stats } = await sanitizeLog(text, { groups: { credentials: true }, onProgress: (p) => progress.push(p) });
    expect(stats.fieldsMasked).toBe(stats.messageCount);
    expect(output).not.toContain('MySecretPassword99');
    expect(progress.length).toBeGreaterThan(5);
    expect(progress.at(-1)).toBeLessThan(1);
  }, 60000);
});
