// Low-level FIX wire helpers shared by the sanitizer, the binary codec,
// the payload generator and the portfolio engine.

export const SOH = '\x01';

const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

/** UTF-8 byte length of a string (FIX BodyLength / CheckSum are byte based). */
export function byteLength(str) {
  if (encoder) return encoder.encode(str).length;
  return unescape(encodeURIComponent(str)).length;
}

/** FIX CheckSum (tag 10): sum of all bytes modulo 256, zero padded to 3 digits. */
export function fixChecksum(str) {
  let sum = 0;
  if (encoder) {
    const bytes = encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) sum += bytes[i];
  } else {
    for (let i = 0; i < str.length; i++) sum += str.charCodeAt(i) & 0xff;
  }
  return String(sum % 256).padStart(3, '0');
}

/**
 * Builds a complete FIX message (SOH delimited) from an ordered list of
 * `{ tag, val }` pairs. Tags 8, 9 and 10 in `fields` are ignored and
 * recomputed: BodyLength counts every byte after the SOH that terminates
 * tag 9 up to and including the SOH before tag 10.
 */
export function buildFixMessage(fields, { beginString } = {}) {
  const begin =
    beginString || fields.find((f) => String(f.tag) === '8')?.val || 'FIX.4.4';
  const body =
    fields
      .filter((f) => !['8', '9', '10'].includes(String(f.tag)))
      .map((f) => `${f.tag}=${f.val}`)
      .join(SOH) + SOH;
  const head = `8=${begin}${SOH}9=${byteLength(body)}${SOH}`;
  const partial = head + body;
  return {
    message: `${partial}10=${fixChecksum(partial)}${SOH}`,
    bodyLength: byteLength(body),
    checksum: fixChecksum(partial),
  };
}

/** FIX UTCTimestamp: YYYYMMDD-HH:MM:SS.sss */
export function fixTimestamp(date = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return (
    `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `-${p(date.getUTCHours())}:${p(date.getUTCMinutes())}:${p(date.getUTCSeconds())}` +
    `.${p(date.getUTCMilliseconds(), 3)}`
  );
}

/** Parses a FIX UTCTimestamp (with or without millis) to epoch ms, or null. */
export function parseFixTimestamp(str) {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/.exec(str || '');
  if (!m) return null;
  const ms = m[7] ? Number(m[7].padEnd(3, '0')) : 0;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], ms);
  return Number.isNaN(t) ? null : t;
}

/** Detects the field delimiter used by a line of FIX text. */
export function detectDelimiter(line) {
  if (line.includes(SOH)) return SOH;
  if (line.includes('|')) return '|';
  if (line.includes('^A')) return '^A';
  return null;
}
