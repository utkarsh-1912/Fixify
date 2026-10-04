// FIX log sanitizer: masks / pseudonymizes sensitive fields and re-computes
// BodyLength (9) and CheckSum (10) so the output is still a valid FIX stream.

import { buildFixMessage, detectDelimiter, SOH } from './fixWire';

export const TAG_GROUPS = {
  credentials: ['554', '96', '89', '91', '925', '926'], // Password, RawData, Signature, SecureData, NewPassword
  compIds: ['49', '56', '50', '57', '115', '128', '142', '143', '116', '129'],
  accounts: ['1', '109', '448', '11', '41', '37'],
  prices: ['44', '99', '31', '6', '270'],
  sizes: ['38', '32', '14', '151', '271'],
};

const STRUCTURAL = new Set(['8', '9', '10']);
const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const CARD_CANDIDATE = /\b\d(?:[ -]?\d){12,18}\b/g;

export function luhnValid(digits) {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

function parseCsv(str) {
  return String(str || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export function parseRemaps(str) {
  const map = {};
  const errors = [];
  parseCsv(str).forEach((pair) => {
    const [tag, alias, ...rest] = pair.split('=').map((s) => s.trim());
    if (!/^\d+$/.test(tag || '') || !alias || rest.length || !/^[\w.-]+$/.test(alias)) {
      errors.push(`Ignored invalid remap "${pair}" (expected tag=alias, e.g. 55=SYM).`);
    } else if (STRUCTURAL.has(tag)) {
      errors.push(`Ignored remap of structural tag ${tag}.`);
    } else {
      map[tag] = alias;
    }
  });
  return { map, errors };
}

async function hmacHex(salt, value) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return Array.from(new Uint8Array(sig).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {string} text raw log text (one message per line)
 * @param {object} opts
 *   groups: { credentials, compIds, accounts, ips, pii, prices, sizes } booleans
 *   customTags: "5001, 5002"   remaps: "55=SYM, 1=ACCT"
 *   replacement: string        useHashing: bool (HMAC-SHA256 pseudonyms)   salt: string
 */
export async function sanitizeLog(text, opts = {}) {
  const {
    groups = {}, customTags = '', remaps = '', replacement = '[MASKED]', useHashing = false, salt = '',
    onProgress = null, // (fraction 0..1) => void, called between chunks
    chunkLines = 2000, // lines processed before yielding to the event loop so the UI never freezes
  } = opts;
  if (useHashing && !salt) throw new Error('A salt is required when hashing is enabled.');

  const maskTags = new Set(parseCsv(customTags).filter((t) => /^\d+$/.test(t)));
  ['credentials', 'compIds', 'accounts', 'prices', 'sizes'].forEach((g) => {
    if (groups[g]) TAG_GROUPS[g].forEach((t) => maskTags.add(t));
  });
  STRUCTURAL.forEach((t) => maskTags.delete(t));
  const { map: remapMap, errors: remapErrors } = parseRemaps(remaps);
  const safeReplacement = String(replacement).replace(/[|\x01]|\^A/g, '') || '[MASKED]';

  const cache = new Map();
  const pseudonym = async (val) => {
    if (!cache.has(val)) cache.set(val, await hmacHex(salt, val));
    return cache.get(val);
  };

  const stats = { messageCount: 0, fieldsMasked: 0, skippedLines: 0, byteReduction: 0, perTag: {} };
  const out = [];

  const lines = String(text).split(/\r?\n/);
  for (let li = 0; li < lines.length; li++) {
    if (li > 0 && li % chunkLines === 0) {
      if (onProgress) onProgress(li / lines.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const line = lines[li];
    if (!line.trim()) { out.push(''); continue; }
    const start = line.search(/8=FIXT?\.\d/);
    const prefix = start > 0 ? line.slice(0, start) : '';
    const msg = start >= 0 ? line.slice(start) : line;
    const sep = detectDelimiter(msg);
    const fields = sep ? (sep === '^A' ? msg.split('^A') : msg.split(sep)) : [msg];
    const parsed = fields.filter(Boolean).map((raw) => {
      const eq = raw.indexOf('=');
      return eq > 0 && /^\d+$/.test(raw.slice(0, eq).trim()) ? { tag: raw.slice(0, eq).trim(), val: raw.slice(eq + 1) } : { raw };
    });
    const tagged = parsed.filter((p) => p.tag);
    const looksLikeFix = tagged.some((p) => p.tag === '8') && tagged.some((p) => p.tag === '35');
    if (!looksLikeFix) { stats.skippedLines++; out.push(line); continue; }
    stats.messageCount++;

    const hadLengthAndSum = tagged.some((p) => p.tag === '9') && tagged.some((p) => p.tag === '10');
    for (const p of parsed) {
      if (!p.tag || STRUCTURAL.has(p.tag)) continue;
      let masked = false;
      if (maskTags.has(p.tag) && p.val !== '') {
        p.val = useHashing ? await pseudonym(p.val) : safeReplacement;
        masked = true;
      }
      if (groups.ips && IPV4.test(p.val)) {
        p.val = p.val.replace(IPV4, 'xxx.xxx.xxx.xxx');
        masked = true;
      }
      IPV4.lastIndex = 0;
      if (groups.pii) {
        p.val = p.val.replace(CARD_CANDIDATE, (m) => {
          if (!luhnValid(m.replace(/[ -]/g, ''))) return m;
          masked = true;
          return '****-****-****-****';
        });
      }
      if (masked) {
        stats.fieldsMasked++;
        stats.perTag[p.tag] = (stats.perTag[p.tag] || 0) + 1;
      }
      if (remapMap[p.tag]) p.tag = remapMap[p.tag];
    }

    const toStr = (p) => (p.tag ? `${p.tag}=${p.val}` : p.raw);
    let soh;
    if (hadLengthAndSum) {
      const ordered = parsed.map((p) => (p.tag ? { tag: p.tag, val: p.val } : null)).filter(Boolean);
      soh = buildFixMessage(ordered).message;
    } else {
      soh = parsed.map(toStr).join(SOH) + (sep ? SOH : '');
    }
    const body = sep === '^A' ? soh.replace(/\x01/g, '^A') : sep === '|' ? soh.split(SOH).join('|') : soh;
    out.push(prefix + body);
  }

  const output = out.join('\n');
  stats.byteReduction = String(text).length - output.length;
  return { output, stats, warnings: remapErrors };
}
