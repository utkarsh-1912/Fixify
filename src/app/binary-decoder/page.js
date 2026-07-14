'use client';

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Upload,
  Cpu,
  RefreshCcw,
  Sparkles,
  Clipboard,
  FileCode,
  AlertTriangle,
  Info,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import SohVisualizer from '@/components/SohVisualizer';

// Preset sample XML template for CME MDP 3.0 SBE
const CME_SBE_TEMPLATE = 
`<?xml version="1.0" encoding="UTF-8"?>
<sbe:messageSchema xmlns:sbe="http://www.fixprotocol.org/ns/simple/1.0"
                   package="mktdata" id="1" version="3"
                   semanticVersion="1.0" byteOrder="littleEndian">
  <!-- CME MDP 3.0 New Order Single Schema -->
  <message id="101" name="NewOrderSingle" blockLength="36">
    <field name="MsgSeqNum" id="34" type="uint32" offset="0"/>
    <field name="SendingTime" id="52" type="uint64" offset="4"/>
    <field name="ClOrdID" id="11" type="uint64" offset="12"/>
    <field name="SecurityID" id="48" type="uint64" offset="20"/>
    <field name="Price" id="44" type="int64" offset="28"/>
    <field name="OrderQty" id="38" type="uint32" offset="34"/>
    <field name="Side" id="54" type="uint8" offset="35"/>
  </message>
</sbe:messageSchema>`;

// Preset CME SBE hex payload (36 bytes total in little-endian matching template block length)
const CME_SBE_HEX_PAYLOAD = "09130000a8dedaa48f010000e17f0f0000000000d42c010000000000d4a8000000000000fa00000001";

// FAST Preset XML Template
const FAST_TEMPLATE =
`<?xml version="1.0" encoding="UTF-8"?>
<templates xmlns="http://www.fixprotocol.org/ns/fast/td/1.1">
  <template name="MDRefresh" id="202">
    <!-- FAST Presence Map bit flags identify field existences -->
    <uInt32 name="MsgSeqNum" id="34"><increment/></uInt32>
    <string name="SendingTime" id="52"/>
    <string name="Symbol" id="55"/>
    <uInt32 name="BidPrice" id="270"/>
    <uInt32 name="BidSize" id="271"/>
  </template>
</templates>`;

const FAST_HEX_PAYLOAD = "23a53132303030b0414150cc0108ac03f4";

export default function BinaryDecoderPage() {
  const [encoding, setEncoding] = useState('sbe'); // 'sbe' | 'fast'
  const [xmlTemplate, setXmlTemplate] = useState(CME_SBE_TEMPLATE);
  const [hexInput, setHexInput] = useState(CME_SBE_HEX_PAYLOAD);
  const [parsedFields, setParsedFields] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');

  // Auto parse when hexInput, xmlTemplate or encoding changes
  useEffect(() => {
    handleDecode();
  }, [hexInput, xmlTemplate, encoding]);

  const loadPreset = (type) => {
    if (type === 'sbe') {
      setEncoding('sbe');
      setXmlTemplate(CME_SBE_TEMPLATE);
      setHexInput(CME_SBE_HEX_PAYLOAD);
    } else {
      setEncoding('fast');
      setXmlTemplate(FAST_TEMPLATE);
      setHexInput(FAST_HEX_PAYLOAD);
    }
  };

  const handleDecode = () => {
    setParseErrors([]);
    setParsedFields([]);
    setSuccessMsg('');

    if (!hexInput.trim()) return;

    // Convert hex input to clean byte array
    const cleanHex = hexInput.replace(/[^0-9a-fA-F]/g, '');
    if (cleanHex.length % 2 !== 0) {
      setParseErrors(["Hex payload has odd length. Please verify byte structure."]);
      return;
    }

    const bytes = [];
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes.push(parseInt(cleanHex.substring(i, i + 2), 16));
    }

    try {
      if (encoding === 'sbe') {
        decodeSBE(bytes);
      } else {
        decodeFAST(bytes);
      }
    } catch (e) {
      setParseErrors([`Decoding Error: ${e.message}`]);
    }
  };

  const decodeSBE = (bytes) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlTemplate, "application/xml");
    const parseErr = xmlDoc.getElementsByTagName("parsererror");
    if (parseErr.length > 0) {
      throw new Error("Invalid XML Template structure: " + parseErr[0].textContent);
    }

    const fields = xmlDoc.getElementsByTagName("field");
    if (fields.length === 0) {
      throw new Error("No <field> definitions found in SBE template XML.");
    }

    const decoded = [];

    for (let i = 0; i < fields.length; i++) {
      const fNode = fields[i];
      const name = fNode.getAttribute("name") || `Field_${i}`;
      const tag = parseInt(fNode.getAttribute("id") || "0", 10);
      const type = fNode.getAttribute("type") || "uint8";
      const offset = parseInt(fNode.getAttribute("offset") || "0", 10);

      // Determine size based on type
      let size = 1;
      if (type.includes("16")) size = 2;
      else if (type.includes("32")) size = 4;
      else if (type.includes("64")) size = 8;

      if (offset + size > bytes.length) {
        decoded.push({
          tag,
          name,
          type,
          offset,
          rawHex: 'N/A',
          value: 'OUT_OF_BOUNDS (Payload truncation)',
          status: 'error'
        });
        continue;
      }

      // Slice field bytes
      const fBytes = bytes.slice(offset, offset + size);
      const hexStr = fBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

      // Interpret value (Little Endian standard)
      let val = 0;
      if (size === 1) {
        val = fBytes[0];
      } else if (size === 2) {
        val = fBytes[0] | (fBytes[1] << 8);
      } else if (size === 4) {
        val = (fBytes[0] | (fBytes[1] << 8) | (fBytes[2] << 16) | (fBytes[3] << 24)) >>> 0;
      } else if (size === 8) {
        // Read 64-bit integer
        let low = (fBytes[0] | (fBytes[1] << 8) | (fBytes[2] << 16) | (fBytes[3] << 24)) >>> 0;
        let high = (fBytes[4] | (fBytes[5] << 8) | (fBytes[6] << 16) | (fBytes[7] << 24)) >>> 0;
        val = high * 0x100000000 + low;
      }

      decoded.push({
        tag,
        name,
        type,
        offset,
        rawHex: hexStr,
        value: val.toString(),
        status: 'success'
      });
    }

    setParsedFields(decoded);
    setSuccessMsg(`Successfully decoded SBE payload. Read ${decoded.filter(d => d.status === 'success').length} fields.`);
  };

  const decodeFAST = (bytes) => {
    // Basic FAST decoder using Stop-Bit encoding (7-bit values, MSB = 1 ends value)
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlTemplate, "application/xml");
    const parseErr = xmlDoc.getElementsByTagName("parsererror");
    if (parseErr.length > 0) {
      throw new Error("Invalid XML template schema: " + parseErr[0].textContent);
    }

    // Identify standard fields defined in sequence
    const elementNames = ["uInt32", "string", "int32", "uInt64", "int64"];
    const fieldNodes = [];
    elementNames.forEach(tag => {
      const nodes = xmlDoc.getElementsByTagName(tag);
      for (let i = 0; i < nodes.length; i++) {
        fieldNodes.push(nodes[i]);
      }
    });

    if (fieldNodes.length === 0) {
      throw new Error("No field definitions (<uInt32>, <string>, etc.) found in FAST template.");
    }

    // Sort nodes chronologically as they appear under the template parent
    const decoded = [];
    let byteIdx = 0;

    for (let i = 0; i < fieldNodes.length; i++) {
      if (byteIdx >= bytes.length) {
        decoded.push({
          tag: fieldNodes[i].getAttribute("id") || "0",
          name: fieldNodes[i].getAttribute("name") || `Field_${i}`,
          type: fieldNodes[i].localName,
          offset: byteIdx,
          rawHex: 'N/A',
          value: 'END_OF_STREAM',
          status: 'error'
        });
        continue;
      }

      const fNode = fieldNodes[i];
      const name = fNode.getAttribute("name") || `Field_${i}`;
      const tag = parseInt(fNode.getAttribute("id") || "0", 10);
      const type = fNode.localName;

      const fieldStartIdx = byteIdx;
      const fBytes = [];
      
      // Read bytes until MSB is 1 (stop bit)
      while (byteIdx < bytes.length) {
        const b = bytes[byteIdx];
        fBytes.push(b);
        byteIdx++;
        if ((b & 0x80) !== 0) {
          break; // Stop bit found
        }
      }

      const hexStr = fBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

      // Parse FAST value
      let value = "";
      if (type === 'string') {
        // ASCII string bytes: strip MSB on last character
        value = fBytes.map((b, idx) => {
          const charCode = idx === fBytes.length - 1 ? (b & 0x7F) : b;
          return String.fromCharCode(charCode);
        }).join('');
      } else {
        // Numeric 7-bit stop bit accumulator
        let numVal = 0;
        for (let j = 0; j < fBytes.length; j++) {
          const b = fBytes[j];
          const valPart = j === fBytes.length - 1 ? (b & 0x7F) : b;
          numVal = (numVal << 7) | valPart;
        }
        value = numVal.toString();
      }

      decoded.push({
        tag,
        name,
        type,
        offset: fieldStartIdx,
        rawHex: hexStr,
        value,
        status: 'success'
      });
    }

    setParsedFields(decoded);
    setSuccessMsg(`Successfully decoded FAST stream. Read ${decoded.filter(d => d.status === 'success').length} fields.`);
  };

  // Build standard FIX payload preview from decoded tags
  const buildFixString = () => {
    const parts = parsedFields
      .filter(f => f.status === 'success')
      .map(f => `${f.tag}=${f.value}`);
    if (parts.length === 0) return '';
    return `8=FIX.4.4|9=${parts.join('|').length}|${parts.join('|')}|10=080|`;
  };

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <Cpu className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            Binary FAST / SBE Decoder
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Decode raw high-frequency binary frames into standard tag-value maps using schema templates.
          </p>
        </div>

        {/* Action presets */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadPreset('sbe')}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold font-mono transition-all cursor-pointer ${encoding === 'sbe' ? 'bg-[var(--primary-faint)] border-[var(--primary)] text-[var(--primary)]' : 'bg-[var(--card)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]'}`}
          >
            CME SBE Template
          </button>
          <button
            onClick={() => loadPreset('fast')}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold font-mono transition-all cursor-pointer ${encoding === 'fast' ? 'bg-[var(--primary-faint)] border-[var(--primary)] text-[var(--primary)]' : 'bg-[var(--card)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)]'}`}
          >
            FAST Stream Template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Inputs */}
        <div className="lg:col-span-5 space-y-5">
          {/* Hex Input Card */}
          <div
            className="p-5 rounded-2xl border space-y-3.5"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono block">Raw Byte Stream (Hex format):</span>
              <span className="text-[9px] font-mono text-zinc-500">Bytes: {hexInput.replace(/[^0-9a-fA-F]/g, '').length / 2}</span>
            </div>
            <textarea
              value={hexInput}
              onChange={e => setHexInput(e.target.value)}
              placeholder="Paste raw packet hex (e.g. 09130000...)"
              rows={4}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-[var(--primary-border)] focus:ring-1 focus:ring-[var(--primary-border)] text-zinc-350"
            />
          </div>

          {/* Template Schema Editor */}
          <div
            className="p-5 rounded-2xl border space-y-3.5"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono block">FAST/SBE Template Schema XML:</span>
            <textarea
              value={xmlTemplate}
              onChange={e => setXmlTemplate(e.target.value)}
              placeholder="Upload or paste XML schema mapping here..."
              rows={14}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-[var(--primary-border)] focus:ring-1 focus:ring-[var(--primary-border)] text-zinc-350"
            />
          </div>
        </div>

        {/* Right Output */}
        <div className="lg:col-span-7 space-y-5">
          {/* Status logs */}
          {parseErrors.length > 0 && (
            <div className="p-4 rounded-xl border border-red-500/10 bg-red-500/5 text-red-400 text-xs flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Parsing Errors Detected:</p>
                {parseErrors.map((e, idx) => <p key={idx} className="font-mono">{e}</p>)}
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-emerald-400 text-xs flex items-center gap-2.5">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <p>{successMsg}</p>
            </div>
          )}

          {/* Parsed Decoded Table */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="px-5 py-4 border-b border-[var(--border)] bg-zinc-900/40 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--foreground)] flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                Decoded Fields Matrix
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-zinc-950/20 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                    <th className="px-5 py-3 font-mono">Offset</th>
                    <th className="px-5 py-3 font-mono">Tag</th>
                    <th className="px-4 py-3">Field Name</th>
                    <th className="px-4 py-3 font-mono">Type</th>
                    <th className="px-4 py-3 font-mono">Raw Hex</th>
                    <th className="px-5 py-3 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 font-mono text-[11px]">
                  {parsedFields.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-[var(--text-muted)] font-sans">
                        Paste hex bytes and schema to see decoded values.
                      </td>
                    </tr>
                  ) : (
                    parsedFields.map((field, idx) => (
                      <tr
                        key={idx}
                        className={`transition-colors hover:bg-zinc-950/25 ${field.status === 'error' ? 'bg-red-500/5 text-red-400' : 'text-zinc-300'}`}
                      >
                        <td className="px-5 py-3 text-zinc-500 font-bold">+{field.offset}</td>
                        <td className="px-5 py-3 font-bold" style={{ color: field.status === 'success' ? 'var(--primary)' : 'inherit' }}>
                          {field.tag}
                        </td>
                        <td className="px-4 py-3 font-sans font-semibold text-zinc-100">{field.name}</td>
                        <td className="px-4 py-3 text-zinc-400">{field.type}</td>
                        <td className="px-4 py-3 text-[10px] tracking-wider text-zinc-500">{field.rawHex}</td>
                        <td className="px-5 py-3 text-right font-bold text-zinc-100">{field.value}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tag Value Output String */}
          {parsedFields.length > 0 && (
            <div
              className="p-5 rounded-2xl border space-y-3.5"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono block">Reconstructed FIX Message (SOH visual):</span>
              </div>
              <div className="p-3 bg-zinc-950/50 border border-zinc-800 rounded-xl">
                <SohVisualizer rawMsg={buildFixString()} delimiter="|" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
