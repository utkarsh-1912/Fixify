import { describe, it, expect } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { hexToBytes, bytesToHex, decodeSBE, encodeSBE, decodeFAST, encodeFAST, createFastState, decodeAsciiFix, encodeAsciiFix } from '@/lib/binaryCodec';
import { validateFIXMessage } from '@/lib/fixParser';
import { PRESETS } from '@/lib/binaryPresets';

const P = DOMParser;
const SBE = `<sbe:messageSchema xmlns:sbe="x" package="t" id="7" version="2" byteOrder="littleEndian">
 <types>
  <type name="Sym" primitiveType="char" length="4"/>
  <enum name="Side" encodingType="uint8"><validValue name="Buy">1</validValue><validValue name="Sell">2</validValue></enum>
  <composite name="Decimal"><type name="mantissa" primitiveType="int64"/><type name="exponent" primitiveType="int8"/></composite>
 </types>
 <message id="5" name="Order" blockLength="26">
  <field name="Id" id="11" type="uint64"/>
  <field name="Px" id="44" type="Decimal"/>
  <field name="Qty" id="38" type="int32"/>
  <field name="Side" id="54" type="Side"/>
  <field name="Sym" id="55" type="Sym"/>
 </message></sbe:messageSchema>`;

describe('hex helpers', () => {
  it('round-trips and rejects bad input', () => {
    expect(bytesToHex(hexToBytes('0a ff 00'))).toBe('0AFF00');
    expect(() => hexToBytes('abc')).toThrow(/odd/);
    expect(() => hexToBytes('zz')).toThrow(/non-hex/);
  });
});

describe('SBE', () => {
  const values = { Id: '18446744073709551615', Px: { mantissa: '-12345', exponent: '-2' }, Qty: '-7', Side: 'Sell', Sym: 'AB' };
  it('round-trips signed, unsigned 64-bit, composite, enum and char arrays without precision loss', () => {
    const bytes = encodeSBE(SBE, values, { Parser: P });
    expect(bytes.length).toBe(8 + 26);
    const r = decodeSBE(bytes, SBE, P);
    const by = Object.fromEntries(r.fields.map((f) => [f.name, f]));
    expect(by.Id.value).toBe('18446744073709551615');
    expect(by.Px.value).toBe('{ mantissa: -12345, exponent: -2 }');
    expect(by.Qty.value).toBe('-7');
    expect(by.Side.value).toBe('Sell (2)');
    expect(by.Sym.value).toBe('AB');
    expect(r.warnings).toEqual([]);
  });
  it('honours big endian byte order in the header too', () => {
    const be = SBE.replace('littleEndian', 'bigEndian');
    const bytes = encodeSBE(be, values, { Parser: P });
    expect(bytes.slice(0, 4)).toEqual([0, 26, 0, 5]);
    expect(decodeSBE(bytes, be, P).fields[2].value).toBe('-7');
  });
  it('rejects out-of-range values and unknown templates', () => {
    expect(() => encodeSBE(SBE, { ...values, Qty: '3000000000' }, { Parser: P })).toThrow(/out of range/);
    const bytes = encodeSBE(SBE, values, { Parser: P });
    bytes[2] = 99;
    expect(() => decodeSBE(bytes, SBE, P)).toThrow(/template ID 99/);
  });
  it('flags truncated payloads instead of reading past the end', () => {
    const bytes = encodeSBE(SBE, values, { Parser: P }).slice(0, 20);
    const r = decodeSBE(bytes, SBE, P);
    expect(r.fields.some((f) => f.status === 'error')).toBe(true);
    expect(r.warnings.join()).toMatch(/truncated/);
  });
});

const FAST = `<templates xmlns="http://www.fixprotocol.org/ns/fast/td/1.1">
 <template name="T" id="9">
  <uInt32 name="Seq" id="34"><increment/></uInt32>
  <string name="Sym" id="55"><copy/></string>
  <int32 name="Delta" id="1"/>
  <uInt32 name="Size" id="271"><default value="100"/></uInt32>
  <uInt64 name="Big" id="2" presence="optional"/>
  <decimal name="Px" id="270"/>
 </template></templates>`;

describe('FAST', () => {
  it('decodes real stop-bit integers beyond 32 bits, negative ints and decimals', () => {
    const state = createFastState();
    const bytes = encodeFAST(FAST, { Seq: '1', Sym: 'AAPL', Delta: '-64', Size: '100', Big: '18446744073709551615', Px: '123.45' }, { Parser: P });
    const r = decodeFAST(bytes, FAST, { Parser: P, state });
    const by = Object.fromEntries(r.fields.map((f) => [f.name, f.value]));
    expect(by).toEqual({ Seq: '1', Sym: 'AAPL', Delta: '-64', Size: '100', Big: '18446744073709551615', Px: '123.45' });
  });
  it('applies copy / increment / default operators across messages using the dictionary', () => {
    const encState = createFastState();
    const decState = createFastState();
    const m1 = encodeFAST(FAST, { Seq: '10', Sym: 'MSFT', Delta: '1', Size: '100', Px: '1.5' }, { Parser: P, state: encState });
    const m2 = encodeFAST(FAST, { Seq: '11', Sym: 'MSFT', Delta: '2', Size: '100', Px: '1.6' }, { Parser: P, state: encState });
    expect(m2.length).toBeLessThan(m1.length);
    decodeFAST(m1, FAST, { Parser: P, state: decState });
    const r2 = decodeFAST(m2, FAST, { Parser: P, state: decState });
    const by = Object.fromEntries(r2.fields.map((f) => [f.name, f]));
    expect(by.Seq.value).toBe('11');
    expect(by.Seq.status).toBe('skipped');
    expect(by.Sym.value).toBe('MSFT');
    expect(by.Size.value).toBe('100');
    expect(by.Big.value).toBe('NULL');
  });
  it('errors on truncated streams instead of inventing values', () => {
    const bytes = encodeFAST(FAST, { Seq: '1', Sym: 'AAPL', Delta: '5', Size: '7', Px: '1' }, { Parser: P });
    expect(() => decodeFAST(bytes.slice(0, bytes.length - 2), FAST, { Parser: P })).toThrow(/end of stream|stop bit/);
  });
  it('rejects unsupported operators loudly', () => {
    const x = FAST.replace('<increment/>', '<delta/>');
    expect(() => decodeFAST([0xc0, 0x89], x, { Parser: P })).toThrow(/not supported/);
  });
});

describe('FIX ASCII', () => {
  it('compiles a message with correct BodyLength and CheckSum', () => {
    const bytes = encodeAsciiFix([{ tag: '35', val: 'D' }, { tag: '49', val: 'A' }, { tag: '56', val: 'B' }, { tag: '34', val: '2' }, { tag: '55', val: 'IBM' }]);
    const text = String.fromCharCode(...bytes);
    expect(validateFIXMessage(text).isValid).toBe(true);
    const r = decodeAsciiFix(bytes, validateFIXMessage);
    expect(r.fields.map((f) => f.tag)).toEqual(['8', '9', '35', '49', '56', '34', '55', '10']);
  });
});

describe('presets', () => {
  it.each(Object.keys(PRESETS).filter((k) => PRESETS[k].encoding !== 'ascii_hex'))('%s decodes cleanly', (key) => {
    const p = PRESETS[key];
    const bytes = hexToBytes(p.payload);
    const r = p.encoding === 'sbe' ? decodeSBE(bytes, p.schema, P) : decodeFAST(bytes, p.schema, { Parser: P });
    expect(r.fields.every((f) => f.status !== 'error')).toBe(true);
    expect(r.warnings).toEqual([]);
  });
  it('ASCII presets are valid FIX', () => {
    ['fix_logon', 'fix_nos'].forEach((k) => {
      const text = String.fromCharCode(...hexToBytes(PRESETS[k].payload));
      expect(validateFIXMessage(text).errors).toEqual([]);
    });
  });
});
