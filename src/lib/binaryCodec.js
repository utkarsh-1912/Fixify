// Pure SBE / FAST / FIX-ASCII codecs. No React, no DOM globals: the XML parser
// is injected (browser DOMParser by default, @xmldom/xmldom in tests / Node).

import { buildFixMessage, SOH } from './fixWire';

// ---------------------------------------------------------------- helpers

export function hexToBytes(hex) {
  const clean = String(hex || '').replace(/0x/gi, '').replace(/[\s,:-]/g, '');
  if (!clean) return [];
  if (/[^0-9a-fA-F]/.test(clean)) throw new Error('Hex payload contains non-hex characters.');
  if (clean.length % 2 !== 0) throw new Error('Hex payload has an odd number of digits.');
  const out = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
}

export function bytesToHex(bytes, sep = '') {
  return Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(sep);
}

export function parseXml(xml, Parser = globalThis.DOMParser) {
  if (!Parser) throw new Error('No XML parser available in this environment.');
  if (!xml || !xml.trim()) throw new Error('Schema is empty. Paste or upload an XML schema first.');
  const doc = new Parser().parseFromString(xml, 'application/xml');
  const err = doc.getElementsByTagName('parsererror');
  if (err.length > 0) throw new Error('XML parse error: ' + err[0].textContent.trim().slice(0, 200));
  return doc;
}

const localName = (n) => (n.localName || n.nodeName || '').replace(/^.*:/, '');

function walk(node, fn) {
  for (let c = node.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 1) {
      fn(c);
      walk(c, fn);
    }
  }
}

function elementsNamed(root, name) {
  const out = [];
  walk(root, (n) => localName(n) === name && out.push(n));
  return out;
}

function childElements(node, name) {
  const out = [];
  for (let c = node.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 1 && (!name || localName(c) === name)) out.push(c);
  }
  return out;
}

const attr = (n, a, d = null) => (n.hasAttribute && n.hasAttribute(a) ? n.getAttribute(a) : d);

// ---------------------------------------------------------------- SBE

const PRIMS = {
  char: { size: 1, kind: 'char' },
  int8: { size: 1, kind: 'int', signed: true },
  uint8: { size: 1, kind: 'int', signed: false },
  int16: { size: 2, kind: 'int', signed: true },
  uint16: { size: 2, kind: 'int', signed: false },
  int32: { size: 4, kind: 'int', signed: true },
  uint32: { size: 4, kind: 'int', signed: false },
  int64: { size: 8, kind: 'int', signed: true },
  uint64: { size: 8, kind: 'int', signed: false },
  float: { size: 4, kind: 'float' },
  double: { size: 8, kind: 'float' },
};

export function parseSbeSchema(xml, Parser) {
  const doc = parseXml(xml, Parser);
  const root = doc.documentElement;
  const types = {};

  walk(root, (n) => {
    const name = localName(n);
    const parent = n.parentNode && n.parentNode.nodeType === 1 ? localName(n.parentNode) : '';
    if (name === 'type' && parent === 'types') {
      const prim = attr(n, 'primitiveType');
      if (!PRIMS[prim]) throw new Error(`Unknown SBE primitiveType "${prim}" for type "${attr(n, 'name')}".`);
      types[attr(n, 'name')] = {
        category: 'primitive',
        primitive: prim,
        length: parseInt(attr(n, 'length', '1'), 10),
      };
    } else if (name === 'enum') {
      const values = {};
      childElements(n, 'validValue').forEach((v) => {
        values[v.textContent.trim()] = attr(v, 'name');
      });
      types[attr(n, 'name')] = { category: 'enum', encodingType: attr(n, 'encodingType'), values };
    } else if (name === 'composite' && attr(n, 'name') !== 'messageHeader') {
      let off = 0;
      const members = childElements(n, 'type').map((t) => {
        const primitive = attr(t, 'primitiveType');
        if (!PRIMS[primitive]) throw new Error(`Unknown SBE primitiveType "${primitive}" in composite "${attr(n, 'name')}".`);
        const length = parseInt(attr(t, 'length', '1'), 10);
        const size = PRIMS[primitive].size * length;
        const m = { name: attr(t, 'name'), primitive, length, size, offset: off };
        off += size;
        return m;
      });
      types[attr(n, 'name')] = { category: 'composite', members, size: off };
    }
  });

  const messages = childElementsDeep(root, 'message').map((m) => {
    let cursor = 0;
    const fields = childElements(m, 'field').map((f) => {
      const type = attr(f, 'type');
      const size = sbeTypeSize(types, type);
      const offset = attr(f, 'offset') !== null ? parseInt(attr(f, 'offset'), 10) : cursor;
      cursor = offset + size;
      return { name: attr(f, 'name'), id: attr(f, 'id'), type, offset, size };
    });
    const declared = attr(m, 'blockLength');
    return {
      id: parseInt(attr(m, 'id'), 10),
      name: attr(m, 'name'),
      blockLength: declared !== null ? parseInt(declared, 10) : cursor,
      fields,
      hasGroupsOrData: childElements(m, 'group').length + childElements(m, 'data').length > 0,
    };
  });

  return {
    byteOrder: attr(root, 'byteOrder', 'littleEndian'),
    schemaId: parseInt(attr(root, 'id', '1'), 10),
    version: parseInt(attr(root, 'version', '0'), 10),
    types,
    messages,
  };
}

function childElementsDeep(root, name) {
  return elementsNamed(root, name);
}

function sbeTypeSize(types, type) {
  if (PRIMS[type]) return PRIMS[type].size;
  const t = types[type];
  if (!t) throw new Error(`SBE schema references unknown type "${type}".`);
  if (t.category === 'primitive') return PRIMS[t.primitive].size * t.length;
  if (t.category === 'enum') return PRIMS[t.encodingType].size;
  return t.size;
}

function readPrim(bytes, offset, prim, little) {
  const { size, kind, signed } = PRIMS[prim];
  const view = new DataView(Uint8Array.from(bytes.slice(offset, offset + size)).buffer);
  if (kind === 'char') return String.fromCharCode(bytes[offset]);
  if (kind === 'float') return size === 4 ? view.getFloat32(0, little) : view.getFloat64(0, little);
  switch (size) {
    case 1: return BigInt(signed ? view.getInt8(0) : view.getUint8(0));
    case 2: return BigInt(signed ? view.getInt16(0, little) : view.getUint16(0, little));
    case 4: return BigInt(signed ? view.getInt32(0, little) : view.getUint32(0, little));
    default: return signed ? view.getBigInt64(0, little) : view.getBigUint64(0, little);
  }
}

function writePrim(buf, offset, prim, little, value) {
  const { size, kind, signed } = PRIMS[prim];
  if (kind === 'char') { buf[offset] = String(value).charCodeAt(0) & 0xff; return; }
  const view = new DataView(new ArrayBuffer(size));
  if (kind === 'float') {
    const n = Number(value);
    if (Number.isNaN(n)) throw new Error(`"${value}" is not a valid ${prim}.`);
    if (size === 4) view.setFloat32(0, n, little); else view.setFloat64(0, n, little);
  } else {
    let v;
    try { v = BigInt(String(value).trim()); } catch { throw new Error(`"${value}" is not a valid ${prim}.`); }
    const bits = BigInt(size * 8);
    const min = signed ? -(1n << (bits - 1n)) : 0n;
    const max = signed ? (1n << (bits - 1n)) - 1n : (1n << bits) - 1n;
    if (v < min || v > max) throw new Error(`${value} is out of range for ${prim} (${min}..${max}).`);
    if (size === 1) (signed ? view.setInt8(0, Number(v)) : view.setUint8(0, Number(v)));
    else if (size === 2) (signed ? view.setInt16(0, Number(v), little) : view.setUint16(0, Number(v), little));
    else if (size === 4) (signed ? view.setInt32(0, Number(v), little) : view.setUint32(0, Number(v), little));
    else (signed ? view.setBigInt64(0, v, little) : view.setBigUint64(0, v, little));
  }
  for (let i = 0; i < size; i++) buf[offset + i] = view.getUint8(i);
}

function readPrimArray(bytes, offset, prim, length, little) {
  const { size } = PRIMS[prim];
  if (prim === 'char') {
    return bytes.slice(offset, offset + length).map((b) => String.fromCharCode(b)).join('').replace(/\0+$/, '');
  }
  const out = [];
  for (let i = 0; i < length; i++) out.push(readPrim(bytes, offset + i * size, prim, little));
  return out.map(String).join(',');
}

const SBE_HEADER = 8;

export function decodeSBE(bytes, xml, Parser) {
  const schema = parseSbeSchema(xml, Parser);
  const little = schema.byteOrder !== 'bigEndian';
  if (bytes.length < SBE_HEADER) throw new Error('Payload is shorter than the 8 byte SBE message header.');

  const hdrNames = ['blockLength', 'templateId', 'schemaId', 'version'];
  const hdr = hdrNames.map((n, i) => Number(readPrim(bytes, i * 2, 'uint16', little)));
  const [blockLength, templateId, schemaId, version] = hdr;
  const header = hdrNames.map((n, i) => ({
    name: `Header: ${n}`, tag: 'Header', type: 'uint16', offset: i * 2, size: 2,
    rawHex: bytesToHex(bytes.slice(i * 2, i * 2 + 2), ' '), value: String(hdr[i]), raw: String(hdr[i]), status: 'success',
  }));

  const warnings = [];
  const msg = schema.messages.find((m) => m.id === templateId);
  if (!msg) throw new Error(`SBE schema does not contain a message with template ID ${templateId}.`);
  if (schemaId !== schema.schemaId) warnings.push(`Payload schemaId ${schemaId} differs from schema id ${schema.schemaId}.`);
  if (version > schema.version) warnings.push(`Payload version ${version} is newer than schema version ${schema.version}.`);
  if (blockLength !== msg.blockLength) warnings.push(`Header blockLength ${blockLength} differs from schema blockLength ${msg.blockLength}.`);
  if (bytes.length < SBE_HEADER + blockLength) warnings.push(`Payload is truncated: blockLength ${blockLength} but only ${bytes.length - SBE_HEADER} body bytes.`);
  if (msg.hasGroupsOrData) warnings.push('Repeating groups / variable-length data are present in the schema and are not decoded.');

  const fields = msg.fields.map((f) => {
    const abs = SBE_HEADER + f.offset;
    const base = { name: f.name, tag: f.id, offset: abs, size: f.size };
    const t = PRIMS[f.type] ? null : schema.types[f.type];
    const typeLabel = !t ? f.type : t.category === 'enum' ? `${f.type} (Enum)` : t.category === 'composite' ? `${f.type} (Composite)` : f.type;
    if (abs + f.size > bytes.length) {
      return { ...base, type: typeLabel, rawHex: 'N/A', value: 'OUT_OF_BOUNDS', raw: '', status: 'error' };
    }
    let value; let raw;
    if (t && t.category === 'enum') {
      const n = readPrim(bytes, abs, t.encodingType, little);
      raw = String(n);
      value = `${t.values[raw] || 'UNKNOWN_ENUM_VALUE'} (${raw})`;
    } else if (t && t.category === 'composite') {
      const parts = {};
      t.members.forEach((m) => { parts[m.name] = readPrimArray(bytes, abs + m.offset, m.primitive, m.length, little); });
      raw = JSON.stringify(parts);
      value = `{ ${Object.entries(parts).map(([k, v]) => `${k}: ${v}`).join(', ')} }`;
    } else if (t) {
      raw = value = readPrimArray(bytes, abs, t.primitive, t.length, little);
    } else {
      raw = value = String(readPrim(bytes, abs, f.type, little));
    }
    return { ...base, type: typeLabel, rawHex: bytesToHex(bytes.slice(abs, abs + f.size), ' '), value, raw, status: 'success' };
  });

  return { encoding: 'sbe', messageName: msg.name, templateId, header, fields, pmap: [], warnings };
}

export function encodeSBE(xml, values, { templateId, Parser } = {}) {
  const schema = parseSbeSchema(xml, Parser);
  const little = schema.byteOrder !== 'bigEndian';
  const msg = templateId != null ? schema.messages.find((m) => m.id === templateId) : schema.messages[0];
  if (!msg) throw new Error('SBE schema has no message to encode.');
  const out = new Array(SBE_HEADER + msg.blockLength).fill(0);
  [msg.blockLength, msg.id, schema.schemaId, schema.version].forEach((v, i) => writePrim(out, i * 2, 'uint16', little, v));

  msg.fields.forEach((f) => {
    const abs = SBE_HEADER + f.offset;
    if (f.offset + f.size > msg.blockLength) throw new Error(`Field "${f.name}" (offset ${f.offset}, size ${f.size}) overruns blockLength ${msg.blockLength}.`);
    const input = values[f.name];
    if (input === undefined || input === '') throw new Error(`Missing value for field "${f.name}".`);
    const t = PRIMS[f.type] ? null : schema.types[f.type];
    if (t && t.category === 'enum') {
      const byLabel = Object.entries(t.values).find(([, label]) => label === input);
      writePrim(out, abs, t.encodingType, little, byLabel ? byLabel[0] : input);
    } else if (t && t.category === 'composite') {
      const obj = typeof input === 'string' ? JSON.parse(input) : input;
      t.members.forEach((m) => writePrim(out, abs + m.offset, m.primitive, little, obj[m.name]));
    } else if (t && t.length > 1) {
      if (t.primitive !== 'char') throw new Error(`Array field "${f.name}" is only supported for char types.`);
      const s = String(input);
      if (s.length > t.length) throw new Error(`Value for "${f.name}" is longer than ${t.length} characters.`);
      for (let i = 0; i < t.length; i++) out[abs + i] = i < s.length ? s.charCodeAt(i) & 0xff : 0;
    } else {
      writePrim(out, abs, t ? t.primitive : f.type, little, input);
    }
  });
  return out;
}

// ---------------------------------------------------------------- FAST

export function createFastState() {
  return { dict: {}, templateId: null };
}

function parseFastTemplates(xml, Parser) {
  const doc = parseXml(xml, Parser);
  const templates = elementsNamed(doc.documentElement, 'template').map((t) => ({
    id: attr(t, 'id'),
    name: attr(t, 'name', 'FASTMessage'),
    fields: childElements(t).map((n, i) => {
      const type = localName(n);
      const ops = childElements(n).map(localName);
      const operator = ['constant', 'default', 'copy', 'increment', 'delta', 'tail'].find((o) => ops.includes(o)) || 'none';
      if (operator === 'delta' || operator === 'tail') throw new Error(`FAST operator <${operator}> is not supported (field "${attr(n, 'name')}").`);
      const opNode = operator === 'none' ? null : childElements(n, operator)[0];
      return {
        name: attr(n, 'name', `Field_${i}`),
        id: attr(n, 'id', '0'),
        type,
        optional: attr(n, 'presence', 'mandatory') === 'optional',
        operator,
        initial: opNode ? attr(opNode, 'value') : null,
      };
    }),
  }));
  if (templates.length === 0) throw new Error('FAST schema must contain at least one <template> element.');
  const supported = ['uInt32', 'uInt64', 'int32', 'int64', 'string', 'decimal'];
  templates.forEach((t) => t.fields.forEach((f) => {
    if (!supported.includes(f.type)) throw new Error(`FAST field type <${f.type}> is not supported (field "${f.name}").`);
  }));
  return templates;
}

function readStopBit(bytes, idx) {
  const start = idx;
  const chunk = [];
  while (idx < bytes.length) {
    const b = bytes[idx++];
    chunk.push(b);
    if (b & 0x80) return { chunk, next: idx, start };
  }
  throw new Error(`Unexpected end of stream at byte ${start}: stop bit never found.`);
}

function chunkToUInt(chunk) {
  let v = 0n;
  chunk.forEach((b) => { v = (v << 7n) | BigInt(b & 0x7f); });
  return v;
}

function chunkToInt(chunk) {
  let v = chunkToUInt(chunk);
  if (chunk[0] & 0x40) v -= 1n << BigInt(7 * chunk.length);
  return v;
}

function encodeUInt(v) {
  if (v < 0n) throw new Error('Negative value for an unsigned FAST field.');
  const parts = [];
  do { parts.unshift(Number(v & 0x7fn)); v >>= 7n; } while (v > 0n);
  parts[parts.length - 1] |= 0x80;
  return parts;
}

function encodeInt(v) {
  const parts = [];
  let n = 1n;
  while (!(v >= -(1n << (7n * n - 1n)) && v < (1n << (7n * n - 1n)))) n++;
  for (let i = 0n; i < n; i++) parts.unshift(Number((v >> (7n * i)) & 0x7fn));
  parts[parts.length - 1] |= 0x80;
  return parts;
}

function fastRange(type) {
  const signed = type.startsWith('int');
  const bits = BigInt(type.endsWith('64') ? 64 : 32);
  return signed ? [-(1n << (bits - 1n)), (1n << (bits - 1n)) - 1n] : [0n, (1n << bits) - 1n];
}

function readFastValue(bytes, idx, f) {
  const { chunk, next } = readStopBit(bytes, idx);
  const nullable = f.optional && f.operator !== 'constant';
  const size = next - idx;
  let value;
  if (f.type === 'string') {
    const text = chunk.map((b, i) => String.fromCharCode(i === chunk.length - 1 ? b & 0x7f : b));
    const s = text.join('');
    if (nullable && s === '\0') value = null;
    else if (nullable && s === '\0\0') value = '';
    else if (!nullable && s === '\0') value = '';
    else value = s;
    return { value, next, size, chunk };
  }
  if (f.type === 'decimal') {
    const exp = chunkToInt(chunk);
    if (nullable && exp === 0n) return { value: null, next, size, chunk };
    const e = nullable && exp > 0n ? exp - 1n : exp;
    const m = readStopBit(bytes, next);
    const mant = chunkToInt(m.chunk);
    return { value: { exp: e, mant }, next: m.next, size: m.next - idx, chunk: bytes.slice(idx, m.next) };
  }
  const signed = f.type.startsWith('int');
  let v = signed ? chunkToInt(chunk) : chunkToUInt(chunk);
  if (nullable) {
    if (v === 0n) return { value: null, next, size, chunk };
    if (!signed || v > 0n) v -= 1n;
  }
  const [lo, hi] = fastRange(f.type);
  if (v < lo || v > hi) throw new Error(`Value ${v} for field "${f.name}" is out of range for ${f.type}.`);
  return { value: v, next, size, chunk };
}

export function formatFastValue(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'object') {
    const digits = v.mant.toString().replace('-', '').padStart(Number(-v.exp) + 1, '0');
    const sign = v.mant < 0n ? '-' : '';
    if (v.exp >= 0n) return `${sign}${digits}${'0'.repeat(Number(v.exp))}`;
    const cut = digits.length + Number(v.exp);
    return `${sign}${digits.slice(0, cut)}.${digits.slice(cut)}`;
  }
  return String(v);
}

export function decodeFAST(bytes, xml, { state = createFastState(), templateIdInStream = true, seed = {}, Parser } = {}) {
  Object.entries(seed).forEach(([k, v]) => { if (!(k in state.dict)) state.dict[k] = v; });
  const templates = parseFastTemplates(xml, Parser);
  let idx = 0;
  const pm = readStopBit(bytes, idx);
  idx = pm.next;
  const bits = pm.chunk.flatMap((b) => (b & 0x7f).toString(2).padStart(7, '0').split('').map(Number));
  const header = [{
    name: 'FAST PMap Bytes', tag: 'PMap', type: 'binary', offset: 0, size: pm.chunk.length,
    rawHex: bytesToHex(pm.chunk, ' '), value: pm.chunk.map((b) => b.toString(2).padStart(8, '0')).join(' '), raw: '', status: 'success',
  }];
  let bit = 0;
  const nextBit = () => (bits[bit++] === 1);

  let template = templates[0];
  if (templateIdInStream) {
    if (nextBit()) {
      const tid = readStopBit(bytes, idx);
      idx = tid.next;
      state.templateId = chunkToUInt(tid.chunk).toString();
    }
    if (state.templateId === null) throw new Error('Stream has no template ID and no previous template to reuse.');
    template = templates.find((t) => t.id === state.templateId);
    if (!template) throw new Error(`FAST schema has no template with id ${state.templateId}.`);
    header.push({ name: 'TemplateID', tag: 'TID', type: 'uInt32', offset: pm.chunk.length, size: idx - pm.chunk.length, rawHex: bytesToHex(bytes.slice(pm.chunk.length, idx), ' '), value: state.templateId, raw: state.templateId, status: 'success' });
  }

  const pmapDetails = [];
  const fields = template.fields.map((f) => {
    const usesBit = f.operator === 'copy' || f.operator === 'default' || f.operator === 'increment' || (f.operator === 'constant' && f.optional);
    const present = usesBit ? nextBit() : true;
    if (usesBit) pmapDetails.push({ field: f.name, bitIndex: bit - 1, isPresent: present, operator: f.operator });
    const row = { name: f.name, tag: f.id, type: f.type, offset: idx, size: 0, rawHex: 'N/A', status: 'success', operator: f.operator };
    const prev = state.dict[f.name];
    const fromInitial = () => (f.initial === null ? undefined : f.type === 'string' ? f.initial : BigInt(f.initial));
    let value;
    let readFromStream = false;

    if (f.operator === 'constant') {
      value = present ? fromInitial() : null;
    } else if (present) {
      if (idx >= bytes.length) throw new Error(`Unexpected end of stream while reading field "${f.name}".`);
      const r = readFastValue(bytes, idx, f);
      row.offset = idx; row.size = r.size; row.rawHex = bytesToHex(bytes.slice(idx, r.next), ' ');
      idx = r.next; value = r.value; readFromStream = true;
    } else {
      row.status = 'skipped';
      if (f.operator === 'default') value = f.initial === null ? (f.optional ? null : undefined) : fromInitial();
      else if (f.operator === 'copy') value = prev !== undefined ? prev : f.initial !== null ? fromInitial() : (f.optional ? null : undefined);
      else if (f.operator === 'increment') value = prev !== undefined && prev !== null ? prev + 1n : f.initial !== null ? fromInitial() : undefined;
      if (value === undefined) throw new Error(`Field "${f.name}" is absent from the stream and has no previous or initial value.`);
    }
    if (f.operator === 'copy' || f.operator === 'increment') state.dict[f.name] = value;
    if (readFromStream && f.operator === 'default') { /* default does not update the dictionary */ }
    row.value = formatFastValue(value);
    row.raw = value === null ? '' : row.value;
    if (row.status === 'skipped') row.type = `${f.type} (Skipped by PMap)`;
    return row;
  });

  const trailing = bytes.length - idx;
  const warnings = trailing > 0 ? [`${trailing} unread byte(s) remain after the message.`] : [];
  return { encoding: 'fast', messageName: template.name, templateId: template.id, header, fields, pmap: pmapDetails, warnings, state };
}

export function encodeFAST(xml, values, { state = createFastState(), templateId, templateIdInStream = true, Parser } = {}) {
  const templates = parseFastTemplates(xml, Parser);
  const template = templateId != null ? templates.find((t) => t.id === String(templateId)) : templates[0];
  if (!template) throw new Error('FAST template to encode was not found.');
  const bits = [];
  const body = [];
  if (templateIdInStream) {
    if (!template.id) throw new Error('Template has no id attribute but templateIdInStream is enabled.');
    bits.push(1);
    body.push(...encodeUInt(BigInt(template.id)));
    state.templateId = template.id;
  }

  template.fields.forEach((f) => {
    const raw = values[f.name];
    const isNull = raw === undefined || raw === null || (raw === '' && f.type !== 'string');
    if (isNull && !f.optional) throw new Error(`Missing value for mandatory field "${f.name}".`);
    let value = null;
    if (!isNull) {
      if (f.type === 'string') value = String(raw);
      else if (f.type === 'decimal') {
        const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(raw).trim());
        if (!m) throw new Error(`"${raw}" is not a valid decimal for field "${f.name}".`);
        value = { exp: BigInt(-(m[3] || '').length), mant: BigInt(`${m[1]}${m[2]}${m[3] || ''}`) };
      } else {
        try { value = BigInt(String(raw).trim()); } catch { throw new Error(`"${raw}" is not a valid ${f.type} for field "${f.name}".`); }
        const [lo, hi] = fastRange(f.type);
        if (value < lo || value > hi) throw new Error(`${value} is out of range for ${f.type} (field "${f.name}").`);
      }
    }
    const nullable = f.optional && f.operator !== 'constant';
    const emit = () => body.push(...encodeFastValue(f, value, nullable));
    const prev = state.dict[f.name];
    const same = (a, b) => a !== undefined && (a === b || (a !== null && b !== null && typeof a === 'object' && formatFastValue(a) === formatFastValue(b)));

    if (f.operator === 'none') {
      emit();
    } else if (f.operator === 'constant') {
      if (f.optional) bits.push(isNull ? 0 : 1);
    } else if (f.operator === 'default') {
      const def = f.initial === null ? null : f.type === 'string' ? f.initial : BigInt(f.initial);
      if (same(value, def) || (value === null && def === null)) bits.push(0); else { bits.push(1); emit(); }
    } else if (f.operator === 'copy') {
      const base = prev !== undefined ? prev : f.initial !== null ? (f.type === 'string' ? f.initial : BigInt(f.initial)) : (f.optional ? null : undefined);
      if (base !== undefined && (value === base || same(value, base))) bits.push(0); else { bits.push(1); emit(); }
      state.dict[f.name] = value;
    } else if (f.operator === 'increment') {
      const expected = prev !== undefined && prev !== null ? prev + 1n : f.initial !== null ? BigInt(f.initial) : undefined;
      if (expected !== undefined && value === expected) bits.push(0); else { bits.push(1); emit(); }
      state.dict[f.name] = value;
    }
  });

  while (bits.length > 7 && bits.slice(-7).every((b) => b === 0)) bits.length -= 7;
  const pmap = [];
  for (let i = 0; i < Math.max(bits.length, 1); i += 7) {
    let byte = 0;
    for (let j = 0; j < 7; j++) byte = (byte << 1) | (bits[i + j] || 0);
    pmap.push(byte);
  }
  pmap[pmap.length - 1] |= 0x80;
  return [...pmap, ...body];
}

function encodeFastValue(f, value, nullable) {
  if (f.type === 'string') {
    if (value === null) return [0x80];
    if (value === '') return nullable ? [0x00, 0x80] : [0x80];
    const out = Array.from(value, (c) => {
      const code = c.charCodeAt(0);
      if (code > 0x7f) throw new Error(`Non-ASCII character in field "${f.name}".`);
      return code;
    });
    if (out[0] === 0) throw new Error(`Field "${f.name}" must not start with a NUL character.`);
    out[out.length - 1] |= 0x80;
    return out;
  }
  if (f.type === 'decimal') {
    if (value === null) return [0x80];
    return [...encodeInt(nullable && value.exp >= 0n ? value.exp + 1n : value.exp), ...encodeInt(value.mant)];
  }
  const signed = f.type.startsWith('int');
  if (value === null) return [0x80];
  if (nullable) value = signed ? (value >= 0n ? value + 1n : value) : value + 1n;
  return signed ? encodeInt(value) : encodeUInt(value);
}

// ---------------------------------------------------------------- FIX ASCII

export function decodeAsciiFix(bytes, validate, lookup = {}) {
  const ascii = bytes.map((b) => String.fromCharCode(b)).join('');
  const result = validate(ascii);
  if (!result || !result.tagList || result.tagList.length === 0) throw new Error('Could not parse a FIX message from the ASCII bytes.');
  const sep = result.separator;
  const fields = [];
  let offset = 0;
  ascii.split(sep).forEach((part) => {
    if (part) {
      const eq = part.indexOf('=');
      if (eq !== -1) {
        const tag = part.slice(0, eq).trim();
        const val = part.slice(eq + 1);
        const meaning = lookup.meaning ? lookup.meaning(tag, val) : val;
        fields.push({
          name: (lookup.name && lookup.name(tag)) || `CustomTag_${tag}`, tag, type: 'Tag-Value Pair',
          offset, size: part.length, rawHex: bytesToHex(bytes.slice(offset, offset + part.length), ' '),
          value: `${meaning || val} (${val})`, raw: val, status: 'success',
        });
      }
    }
    offset += part.length + sep.length;
  });
  const warnings = [...(result.errors || []), ...(result.warnings || [])];
  return { encoding: 'ascii_hex', messageName: result.msgTypeName, header: [], fields, pmap: [], warnings };
}

export function encodeAsciiFix(fields) {
  if (!fields.length) throw new Error('No fields to compile. Decode a message first.');
  const val = (t) => fields.find((f) => String(f.tag) === t)?.val;
  const headerTags = ['49', '56', '34', '52'];
  const rest = fields.filter((f) => !['8', '9', '10', '35'].includes(String(f.tag)));
  const hdr = headerTags.map((t) => rest.find((f) => String(f.tag) === t)).filter(Boolean);
  const body = rest.filter((f) => !headerTags.includes(String(f.tag)));
  const { message } = buildFixMessage([{ tag: '35', val: val('35') || 'D' }, ...hdr, ...body], { beginString: val('8') || 'FIX.4.4' });
  return Array.from(message, (c) => c.charCodeAt(0));
}

export { SOH };
