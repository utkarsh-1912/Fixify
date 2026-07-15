'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  HelpCircle,
  Hash,
  Database,
  ArrowRight,
  Eye,
  Sliders,
  Maximize2,
  FileDown
} from 'lucide-react';
import SohVisualizer from '@/components/SohVisualizer';

// ==========================================
// PRESETS & SCHEMAS
// ==========================================

const PRESETS = {
  sbe_cme: {
    name: 'CME MDP 3.0 (SBE)',
    encoding: 'sbe',
    payload: '240065000100030000000000a8dedaa48f010000e17f0f0000000000d42c010000000000d4a8000000000000fa00000001',
    schema: `<?xml version="1.0" encoding="UTF-8"?>
<sbe:messageSchema xmlns:sbe="http://www.fixprotocol.org/ns/simple/1.0"
                   package="mktdata" id="1" version="3"
                   semanticVersion="1.0" byteOrder="littleEndian">
  
  <types>
    <!-- Primitive Types -->
    <type name="uint8" primitiveType="uint8"/>
    <type name="uint16" primitiveType="uint16"/>
    <type name="uint32" primitiveType="uint32"/>
    <type name="uint64" primitiveType="uint64"/>
    <type name="int64" primitiveType="int64"/>

    <!-- Enumerations -->
    <enum name="Side" encodingType="uint8">
      <validValue id="1" name="Buy">1</validValue>
      <validValue id="2" name="Sell">2</validValue>
      <validValue id="3" name="Cross">3</validValue>
    </enum>

    <!-- Composites -->
    <composite name="Decimal">
      <type name="mantissa" primitiveType="int64"/>
      <type name="exponent" primitiveType="uint8"/>
    </composite>
  </types>

  <!-- Message Header structure -->
  <composite name="messageHeader">
    <type name="blockLength" primitiveType="uint16"/>
    <type name="templateId" primitiveType="uint16"/>
    <type name="schemaId" primitiveType="uint16"/>
    <type name="version" primitiveType="uint16"/>
  </composite>

  <!-- CME New Order Message -->
  <message id="101" name="NewOrderSingle" blockLength="36">
    <field name="MsgSeqNum" id="34" type="uint32" offset="0"/>
    <field name="SendingTime" id="52" type="uint64" offset="4"/>
    <field name="ClOrdID" id="11" type="uint64" offset="12"/>
    <field name="SecurityID" id="48" type="uint64" offset="20"/>
    <field name="Price" id="44" type="int64" offset="28"/>
    <field name="OrderQty" id="38" type="uint32" offset="34"/>
    <field name="Side" id="54" type="Side" offset="35"/>
  </message>
</sbe:messageSchema>`
  },

  sbe_b3: {
    name: 'B3 Brazil (SBE)',
    encoding: 'sbe',
    payload: '1e000f00020001007b00000000000000e8030000000000000257545241444531',
    schema: `<?xml version="1.0" encoding="UTF-8"?>
<sbe:messageSchema xmlns:sbe="http://www.fixprotocol.org/ns/simple/1.0"
                   package="b3" id="2" version="1"
                   semanticVersion="1.0" byteOrder="littleEndian">
  <types>
    <type name="uint8" primitiveType="uint8"/>
    <type name="uint16" primitiveType="uint16"/>
    <type name="uint32" primitiveType="uint32"/>
    <type name="uint64" primitiveType="uint64"/>
    <enum name="OrderStatus" encodingType="uint8">
      <validValue id="0" name="New">0</validValue>
      <validValue id="1" name="PartiallyFilled">1</validValue>
      <validValue id="2" name="Filled">2</validValue>
    </enum>
  </types>

  <composite name="messageHeader">
    <type name="blockLength" primitiveType="uint16"/>
    <type name="templateId" primitiveType="uint16"/>
    <type name="schemaId" primitiveType="uint16"/>
    <type name="version" primitiveType="uint16"/>
  </composite>

  <message id="15" name="ExecutionReport" blockLength="30">
    <field name="OrderID" id="37" type="uint64" offset="0"/>
    <field name="CumQty" id="14" type="uint64" offset="8"/>
    <field name="OrdStatus" id="39" type="OrderStatus" offset="16"/>
    <field name="Symbol" id="55" type="uint64" offset="17"/> 
  </message>
</sbe:messageSchema>`
  },

  fast_opra: {
    name: 'OPRA Options Feed (FAST)',
    encoding: 'fast',
    payload: 'c023a53132303030b0414150cc0108ac03f4',
    schema: `<?xml version="1.0" encoding="UTF-8"?>
<templates xmlns="http://www.fixprotocol.org/ns/fast/td/1.1">
  <template name="OPRATrade" id="202">
    <!-- FAST PMap controls presence of fields with operators -->
    <uInt32 name="MsgSeqNum" id="34">
      <increment/>
    </uInt32>
    <string name="SendingTime" id="52"/>
    <string name="Symbol" id="55">
      <copy/>
    </string>
    <uInt32 name="BidPrice" id="270"/>
    <uInt32 name="BidSize" id="271">
      <default value="100"/>
    </uInt32>
  </template>
</templates>`
  }
};

// ==========================================
// COMPONENT MAIN
// ==========================================

export default function BinaryDecoderPage() {
  const [encoding, setEncoding] = useState('sbe'); // 'sbe' | 'fast'
  const [xmlTemplate, setXmlTemplate] = useState(PRESETS.sbe_cme.schema);
  const [hexInput, setHexInput] = useState(PRESETS.sbe_cme.payload);
  const [parsedFields, setParsedFields] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [hoveredFieldOffset, setHoveredFieldOffset] = useState(null);
  const [hoveredFieldSize, setHoveredFieldSize] = useState(null);
  const [activePreset, setActivePreset] = useState('sbe_cme');
  const [editingByteIdx, setEditingByteIdx] = useState(null);
  const [byteEditValue, setByteEditValue] = useState('');
  const [activeTab, setActiveTab] = useState('hex'); // 'hex' | 'xml' | 'encoder'
  const [pmapDetails, setPmapDetails] = useState([]);
  const [headerFields, setHeaderFields] = useState([]);
  const [builderValues, setBuilderValues] = useState({});
  const [historyCount, setHistoryCount] = useState(1);

  const fileInputRef = useRef(null);

  // Load preset data
  const handlePresetSelect = (key) => {
    setActivePreset(key);
    const preset = PRESETS[key];
    setEncoding(preset.encoding);
    setXmlTemplate(preset.schema);
    setHexInput(preset.payload);
  };

  // Convert Hex input string into byte array
  const getBytes = () => {
    const cleanHex = hexInput.replace(/[^0-9a-fA-F]/g, '');
    if (cleanHex.length % 2 !== 0) return [];
    const bytes = [];
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes.push(parseInt(cleanHex.substring(i, i + 2), 16));
    }
    return bytes;
  };

  // Run decoder on payload change
  useEffect(() => {
    handleDecode();
  }, [hexInput, xmlTemplate, encoding]);

  // Decode handler
  const handleDecode = () => {
    setParseErrors([]);
    setParsedFields([]);
    setPmapDetails([]);
    setHeaderFields([]);
    setSuccessMsg('');

    if (!hexInput.trim()) return;

    const bytes = getBytes();
    if (bytes.length === 0) {
      setParseErrors(["Hex payload is invalid or has odd length. Verification failed."]);
      return;
    }

    try {
      if (encoding === 'sbe') {
        decodeSBE(bytes);
      } else {
        decodeFAST(bytes);
      }
    } catch (err) {
      setParseErrors([`Decoding Error: ${err.message}`]);
    }
  };

  // Parse SBE Schema Types
  const parseSBETypes = (xmlDoc) => {
    const typesDict = {};
    
    // Parse valid enums
    const enums = xmlDoc.getElementsByTagName("enum");
    for (let i = 0; i < enums.length; i++) {
      const enumNode = enums[i];
      const enumName = enumNode.getAttribute("name");
      const encodingType = enumNode.getAttribute("encodingType");
      const values = {};
      const validValues = enumNode.getElementsByTagName("validValue");
      for (let j = 0; j < validValues.length; j++) {
        const valNode = validValues[j];
        const label = valNode.getAttribute("name");
        const val = valNode.textContent.trim();
        values[val] = label;
      }
      typesDict[enumName] = {
        category: 'enum',
        encodingType,
        values
      };
    }

    // Parse composites
    const composites = xmlDoc.getElementsByTagName("composite");
    for (let i = 0; i < composites.length; i++) {
      const compNode = composites[i];
      const compName = compNode.getAttribute("name");
      
      // Skip header composite, handled separately
      if (compName === 'messageHeader') continue;

      const subTypes = [];
      const subNodes = compNode.getElementsByTagName("type");
      let currentOffset = 0;
      for (let j = 0; j < subNodes.length; j++) {
        const sNode = subNodes[j];
        const subName = sNode.getAttribute("name");
        const primitive = sNode.getAttribute("primitiveType");
        
        let size = 1;
        if (primitive.includes("16")) size = 2;
        else if (primitive.includes("32")) size = 4;
        else if (primitive.includes("64")) size = 8;

        subTypes.push({
          name: subName,
          primitive,
          size,
          offset: currentOffset
        });
        currentOffset += size;
      }
      typesDict[compName] = {
        category: 'composite',
        fields: subTypes,
        size: currentOffset
      };
    }

    return typesDict;
  };

  // SBE Binary Decoder
  const decodeSBE = (bytes) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlTemplate, "application/xml");
    const parseErr = xmlDoc.getElementsByTagName("parsererror");
    if (parseErr.length > 0) {
      throw new Error("SBE XML Parser Error: " + parseErr[0].textContent);
    }

    const byteOrder = xmlDoc.documentElement.getAttribute("byteOrder") || "littleEndian";
    const types = parseSBETypes(xmlDoc);

    // 1. Decode Header (Standard SBE Header has 8 bytes)
    // blockLength (2), templateId (2), schemaId (2), version (2)
    if (bytes.length < 8) {
      throw new Error("Payload size is less than SBE header length (8 bytes).");
    }

    const blockLength = bytes[0] | (bytes[1] << 8);
    const templateId = bytes[2] | (bytes[3] << 8);
    const schemaId = bytes[4] | (bytes[5] << 8);
    const version = bytes[6] | (bytes[7] << 8);

    const headers = [
      { name: 'Header: blockLength', tag: 'Header', type: 'uint16', offset: 0, size: 2, rawHex: bytes.slice(0, 2).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' '), value: blockLength.toString(), status: 'success' },
      { name: 'Header: templateId', tag: 'Header', type: 'uint16', offset: 2, size: 2, rawHex: bytes.slice(2, 4).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' '), value: templateId.toString(), status: 'success' },
      { name: 'Header: schemaId', tag: 'Header', type: 'uint16', offset: 4, size: 2, rawHex: bytes.slice(4, 6).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' '), value: schemaId.toString(), status: 'success' },
      { name: 'Header: version', tag: 'Header', type: 'uint16', offset: 6, size: 2, rawHex: bytes.slice(6, 8).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' '), value: version.toString(), status: 'success' }
    ];
    setHeaderFields(headers);

    // Find message metadata corresponding to templateId
    const messages = xmlDoc.getElementsByTagName("message");
    let targetMessage = null;
    for (let i = 0; i < messages.length; i++) {
      if (parseInt(messages[i].getAttribute("id"), 10) === templateId) {
        targetMessage = messages[i];
        break;
      }
    }

    if (!targetMessage) {
      throw new Error(`SBE Schema does not contain message template matching ID: ${templateId}`);
    }

    const msgName = targetMessage.getAttribute("name");
    const fields = targetMessage.getElementsByTagName("field");
    const decoded = [];

    // Fields block starts at byte offset 8
    const SBE_HEADER_OFFSET = 8;

    for (let i = 0; i < fields.length; i++) {
      const fNode = fields[i];
      const name = fNode.getAttribute("name");
      const tag = fNode.getAttribute("id");
      const fType = fNode.getAttribute("type");
      const offsetAttr = parseInt(fNode.getAttribute("offset") || "0", 10);
      const absOffset = SBE_HEADER_OFFSET + offsetAttr;

      let size = 1;
      let displayVal = "";
      let typeCategory = types[fType] ? types[fType].category : 'primitive';

      if (typeCategory === 'enum') {
        const enumInfo = types[fType];
        const encType = enumInfo.encodingType;
        if (encType.includes("16")) size = 2;
        else if (encType.includes("32")) size = 4;
        else if (encType.includes("64")) size = 8;
        
        if (absOffset + size > bytes.length) {
          decoded.push({ name, tag, type: `${fType} (Enum)`, offset: absOffset, size, rawHex: 'N/A', value: 'OUT_OF_BOUNDS', status: 'error' });
          continue;
        }

        const rawVal = readInteger(bytes, absOffset, size, byteOrder);
        const resolvedLabel = enumInfo.values[rawVal] || 'UNKNOWN_ENUM_VALUE';
        displayVal = `${resolvedLabel} (${rawVal})`;
      } 
      else if (typeCategory === 'composite') {
        const compInfo = types[fType];
        size = compInfo.size;
        
        if (absOffset + size > bytes.length) {
          decoded.push({ name, tag, type: `${fType} (Composite)`, offset: absOffset, size, rawHex: 'N/A', value: 'OUT_OF_BOUNDS', status: 'error' });
          continue;
        }

        // Parse individual composite elements
        const compValParts = [];
        compInfo.fields.forEach(subF => {
          const subAbs = absOffset + subF.offset;
          const subVal = readInteger(bytes, subAbs, subF.size, byteOrder);
          compValParts.push(`${subF.name}: ${subVal}`);
        });
        displayVal = `{ ${compValParts.join(', ')} }`;
      } 
      else {
        // Primitive
        if (fType.includes("16")) size = 2;
        else if (fType.includes("32")) size = 4;
        else if (fType.includes("64")) size = 8;

        if (absOffset + size > bytes.length) {
          decoded.push({ name, tag, type: fType, offset: absOffset, size, rawHex: 'N/A', value: 'OUT_OF_BOUNDS', status: 'error' });
          continue;
        }

        const rawVal = readInteger(bytes, absOffset, size, byteOrder);
        displayVal = rawVal.toString();
      }

      const fBytes = bytes.slice(absOffset, absOffset + size);
      const rawHexStr = fBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

      decoded.push({
        name,
        tag,
        type: fType,
        offset: absOffset,
        size,
        rawHex: rawHexStr,
        value: displayVal,
        status: 'success'
      });
    }

    setParsedFields(decoded);
    setSuccessMsg(`Decoded SBE Message "${msgName}" (Template ID ${templateId}). Read ${decoded.length} payload fields.`);

    // Initialize builder form inputs if empty
    const initialInputs = {};
    decoded.forEach(f => {
      // Strip enum labeling to get clean numeric value
      const match = f.value.match(/\((\d+)\)/);
      initialInputs[f.name] = match ? match[1] : f.value;
    });
    setBuilderValues(initialInputs);
  };

  // Read integer at offset
  const readInteger = (bytes, offset, size, byteOrder) => {
    let val = 0;
    if (byteOrder === 'littleEndian') {
      if (size === 1) {
        val = bytes[offset];
      } else if (size === 2) {
        val = bytes[offset] | (bytes[offset + 1] << 8);
      } else if (size === 4) {
        val = (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
      } else if (size === 8) {
        let low = (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
        let high = (bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24)) >>> 0;
        val = high * 0x100000000 + low;
      }
    } else {
      // Big Endian
      if (size === 1) {
        val = bytes[offset];
      } else if (size === 2) {
        val = (bytes[offset] << 8) | bytes[offset + 1];
      } else if (size === 4) {
        val = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
      } else if (size === 8) {
        let high = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
        let low = ((bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7]) >>> 0;
        val = high * 0x100000000 + low;
      }
    }
    return val;
  };

  // FAST Binary Decoder with PMap & operators
  const decodeFAST = (bytes) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlTemplate, "application/xml");
    const parseErr = xmlDoc.getElementsByTagName("parsererror");
    if (parseErr.length > 0) {
      throw new Error("FAST XML Schema Error: " + parseErr[0].textContent);
    }

    const templateNode = xmlDoc.getElementsByTagName("template")[0];
    if (!templateNode) {
      throw new Error("FAST Schema must contain at least one <template> element.");
    }

    const templateName = templateNode.getAttribute("name") || "FASTMessage";
    const fieldNodes = [];
    const children = templateNode.children;
    for (let i = 0; i < children.length; i++) {
      fieldNodes.push(children[i]);
    }

    if (fieldNodes.length === 0) {
      throw new Error("No field definitions found under the template.");
    }

    let byteIdx = 0;

    // 1. Decode PMap (Stop-bit encoded bytes)
    // The MSB of the last byte in PMap is 1. We accumulate 7 bits per byte.
    const pmapBytes = [];
    while (byteIdx < bytes.length) {
      const b = bytes[byteIdx];
      pmapBytes.push(b);
      byteIdx++;
      if ((b & 0x80) !== 0) break;
    }

    // Convert PMap bytes to sequence of bits (7 bits per byte, MSB of last byte is stripped of stop bit)
    let pmapBits = [];
    pmapBytes.forEach(b => {
      const payload = b & 0x7F;
      // Convert to binary string of length 7
      const bitsStr = payload.toString(2).padStart(7, '0');
      pmapBits.push(...bitsStr.split('').map(Number));
    });

    const pmapVisual = pmapBytes.map(b => b.toString(2).padStart(8, '0')).join(' ');
    
    // Store headers / PMap metadata
    setHeaderFields([
      { name: 'FAST PMap Bytes', tag: 'PMap', type: 'binary', offset: 0, size: pmapBytes.length, rawHex: pmapBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' '), value: pmapVisual, status: 'success' }
    ]);

    let bitPointer = 0;
    const decoded = [];
    
    // FAST dictionary mapping field name to previous value
    const fastDict = {
      'MsgSeqNum': historyCount.toString(),
      'Symbol': 'AAPL'
    };

    fieldNodes.forEach((node, idx) => {
      const name = node.getAttribute("name") || `Field_${idx}`;
      const tag = node.getAttribute("id") || `0`;
      const type = node.localName;

      // Operators
      const hasCopy = node.getElementsByTagName("copy").length > 0;
      const hasDefault = node.getElementsByTagName("default").length > 0;
      const hasIncrement = node.getElementsByTagName("increment").length > 0;

      // A field requires a PMap bit if it has a copy, default, or increment operator
      const requiresPMapBit = hasCopy || hasDefault || hasIncrement;
      let bitVal = 1; // Default to present if no PMap bit required

      if (requiresPMapBit) {
        bitVal = pmapBits[bitPointer] !== undefined ? pmapBits[bitPointer] : 0;
        bitPointer++;
      }

      // Track mapped pmap bit details
      if (requiresPMapBit) {
        setPmapDetails(prev => [
          ...prev,
          { field: name, bitIndex: bitPointer - 1, isPresent: bitVal === 1, operator: hasCopy ? 'copy' : hasDefault ? 'default' : 'increment' }
        ]);
      }

      let valDisplay = "";
      const fieldStart = byteIdx;

      if (bitVal === 1) {
        // Read stop-bit encoded field value from stream
        if (byteIdx >= bytes.length) {
          decoded.push({ name, tag, type, offset: byteIdx, size: 0, rawHex: 'N/A', value: 'END_OF_STREAM', status: 'error' });
          return;
        }

        const valBytes = [];
        while (byteIdx < bytes.length) {
          const b = bytes[byteIdx];
          valBytes.push(b);
          byteIdx++;
          if ((b & 0x80) !== 0) break;
        }

        const size = byteIdx - fieldStart;
        const hexStr = valBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

        if (type === 'string') {
          // Ascii decoding, strip stop bit from last byte
          valDisplay = valBytes.map((b, bIdx) => {
            const charCode = bIdx === valBytes.length - 1 ? (b & 0x7F) : b;
            return String.fromCharCode(charCode);
          }).join('');
          fastDict[name] = valDisplay;
        } else {
          // Numeric decoding
          let num = 0;
          valBytes.forEach((b, bIdx) => {
            const part = bIdx === valBytes.length - 1 ? (b & 0x7F) : b;
            num = (num << 7) | part;
          });
          valDisplay = num.toString();
          fastDict[name] = valDisplay;
        }

        decoded.push({
          name,
          tag,
          type,
          offset: fieldStart,
          size,
          rawHex: hexStr,
          value: valDisplay,
          status: 'success'
        });
      } else {
        // Bit is 0. Apply operators
        if (hasDefault) {
          const defaultNode = node.getElementsByTagName("default")[0];
          valDisplay = defaultNode.getAttribute("value") || "0";
        } else if (hasCopy) {
          valDisplay = fastDict[name] || "N/A (No previous state)";
        } else if (hasIncrement) {
          const prev = parseInt(fastDict[name] || "0", 10);
          valDisplay = (prev + 1).toString();
          fastDict[name] = valDisplay;
        } else {
          valDisplay = "NULL (Absent)";
        }

        decoded.push({
          name,
          tag,
          type: `${type} (Skipped by PMap)`,
          offset: fieldStart,
          size: 0,
          rawHex: 'N/A',
          value: valDisplay,
          status: 'skipped'
        });
      }
    });

    setParsedFields(decoded);
    setSuccessMsg(`Successfully decoded FAST message stream "${templateName}" using ${pmapBytes.length}-byte PMap.`);
  };

  // Re-encode builder values back to Hex string (FAST/SBE Form Compiler)
  const handleCompile = () => {
    try {
      const bytes = [];

      if (encoding === 'sbe') {
        // Compile SBE message
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlTemplate, "application/xml");
        const templateId = parseInt(xmlDoc.getElementsByTagName("message")[0]?.getAttribute("id") || "101", 10);
        const blockLength = parseInt(xmlDoc.getElementsByTagName("message")[0]?.getAttribute("blockLength") || "36", 10);
        const schemaId = parseInt(xmlDoc.documentElement.getAttribute("id") || "1", 10);
        const version = parseInt(xmlDoc.documentElement.getAttribute("version") || "1", 10);

        // 1. Write header bytes (little-endian)
        writeUint16(bytes, blockLength);
        writeUint16(bytes, templateId);
        writeUint16(bytes, schemaId);
        writeUint16(bytes, version);

        const fields = xmlDoc.getElementsByTagName("field");
        // Create SBE block buffer
        const blockBytes = new Array(blockLength).fill(0);

        for (let i = 0; i < fields.length; i++) {
          const fNode = fields[i];
          const name = fNode.getAttribute("name");
          const offset = parseInt(fNode.getAttribute("offset") || "0", 10);
          const fType = fNode.getAttribute("type") || "uint8";
          const inputVal = builderValues[name] || "0";

          let size = 1;
          if (fType.includes("16")) size = 2;
          else if (fType.includes("32")) size = 4;
          else if (fType.includes("64")) size = 8;

          const numVal = parseInt(inputVal, 10);
          writeIntegerToBuffer(blockBytes, offset, numVal, size);
        }

        bytes.push(...blockBytes);
      } else {
        // Compile FAST payload with a simple PMap containing all 1s
        // write stop-bit encoded PMap byte: e.g. 0xC0 (MSB = 1)
        bytes.push(0xC0); 

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlTemplate, "application/xml");
        const templateNode = xmlDoc.getElementsByTagName("template")[0];
        const fieldNodes = templateNode ? templateNode.children : [];

        for (let i = 0; i < fieldNodes.length; i++) {
          const node = fieldNodes[i];
          const name = node.getAttribute("name");
          const type = node.localName;
          const inputVal = builderValues[name] || "0";

          if (type === 'string') {
            writeStopBitString(bytes, inputVal);
          } else {
            writeStopBitInt(bytes, parseInt(inputVal, 10));
          }
        }
      }

      const hexResult = bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('');
      setHexInput(hexResult);
      setSuccessMsg("Form values successfully compiled back to Hex payload.");
    } catch (err) {
      setParseErrors([`Compile Error: ${err.message}`]);
    }
  };

  // Helper SBE writers
  const writeUint16 = (bytes, val) => {
    bytes.push(val & 0xFF);
    bytes.push((val >> 8) & 0xFF);
  };

  const writeIntegerToBuffer = (buffer, offset, val, size) => {
    for (let i = 0; i < size; i++) {
      buffer[offset + i] = (val >> (i * 8)) & 0xFF;
    }
  };

  // Helper FAST writers (stop bit encoding)
  const writeStopBitInt = (bytes, val) => {
    const parts = [];
    let temp = val;
    // Extract 7-bit blocks starting from lowest
    while (true) {
      parts.push(temp & 0x7F);
      temp = temp >> 7;
      if (temp === 0) break;
    }
    // Reverse so highest 7-bit block is written first
    parts.reverse();
    // Add MSB stop bit to the last byte
    parts[parts.length - 1] |= 0x80;
    bytes.push(...parts);
  };

  const writeStopBitString = (bytes, str) => {
    for (let i = 0; i < str.length; i++) {
      let charCode = str.charCodeAt(i);
      if (i === str.length - 1) {
        charCode |= 0x80; // Add stop bit to the last character
      }
      bytes.push(charCode);
    }
  };

  // Reconstructed FIX tag map
  const buildFixString = () => {
    const parts = parsedFields
      .filter(f => f.status === 'success')
      .map(f => `${f.tag}=${f.value.split(' ')[0]}`);
    if (parts.length === 0) return '';
    return `8=FIX.4.4|9=${parts.join('|').length}|${parts.join('|')}|10=080|`;
  };

  // Drag and drop binary files
  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0] || e.target?.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target.result;
      const view = new Uint8Array(buffer);
      const hexParts = [];
      view.forEach(b => hexParts.push(b.toString(16).toUpperCase().padStart(2, '0')));
      setHexInput(hexParts.join(''));
    };
    reader.readAsArrayBuffer(file);
  };

  // Hex Cell Edit Handler
  const startByteEdit = (idx, currentVal) => {
    setEditingByteIdx(idx);
    setByteEditValue(currentVal.toString(16).toUpperCase().padStart(2, '0'));
  };

  const saveByteEdit = () => {
    if (editingByteIdx === null) return;
    const bytes = getBytes();
    const parsedByte = parseInt(byteEditValue, 16);
    if (isNaN(parsedByte) || parsedByte < 0 || parsedByte > 255) {
      setEditingByteIdx(null);
      return;
    }
    bytes[editingByteIdx] = parsedByte;
    const updatedHex = bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('');
    setHexInput(updatedHex);
    setEditingByteIdx(null);
  };

  // Quick Hex input formatter
  const formatHexInput = () => {
    const clean = hexInput.replace(/[^0-9a-fA-F]/g, '');
    const formatted = [];
    for (let i = 0; i < clean.length; i += 2) {
      formatted.push(clean.substring(i, i + 2).toUpperCase());
    }
    setHexInput(formatted.join(' '));
  };

  const payloadBytes = getBytes();

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto animate-in fade-in duration-200 text-zinc-100">
      
      {/* Header section with Presets */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-5 border-b border-zinc-800">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3" style={{ color: 'var(--foreground)' }}>
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/5"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <Cpu className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            Binary FAST / SBE Workstation
          </h1>
          <p className="text-xs text-zinc-400">
            Professional high-frequency trading diagnostic sandbox. Decode, modify, and re-compile binary market data frames dynamically.
          </p>
        </div>

        {/* Preset selectors */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-wider">Presets:</span>
          {Object.keys(PRESETS).map(key => (
            <button
              key={key}
              onClick={() => handlePresetSelect(key)}
              className={`px-3.5 py-2 rounded-xl border text-[11px] font-mono font-bold transition-all duration-200 cursor-pointer shadow-sm ${activePreset === key ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'}`}
            >
              {PRESETS[key].name}
            </button>
          ))}
        </div>
      </div>

      {/* Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Hex Dump Viewer & Binary Loader */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Interactive Hex Dump */}
          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950/60 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-emerald-400" />
                Hex Dump Inspector
              </span>
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                Size: {payloadBytes.length} Bytes
              </span>
            </div>

            {/* Interactive Grid rendering 16 bytes per line */}
            <div className="border border-zinc-900 rounded-xl overflow-hidden bg-zinc-950 font-mono text-[11px]">
              <div className="grid grid-cols-18 gap-1 p-3 bg-zinc-900/40 border-b border-zinc-900 text-zinc-500 text-[10px] font-bold text-center">
                <div className="col-span-2 text-left">OFFSET</div>
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i}>{i.toString(16).toUpperCase()}</div>
                ))}
              </div>

              <div className="p-3 divide-y divide-zinc-900 max-h-[350px] overflow-y-auto custom-scrollbar space-y-1">
                {payloadBytes.length === 0 ? (
                  <div className="text-center py-10 text-zinc-650 font-sans">No payload bytes loaded.</div>
                ) : (
                  Array.from({ length: Math.ceil(payloadBytes.length / 16) }).map((_, rowIndex) => {
                    const rowOffset = rowIndex * 16;
                    return (
                      <div key={rowIndex} className="grid grid-cols-18 gap-1 py-1.5 hover:bg-zinc-900/25 transition-colors">
                        {/* Offset label */}
                        <div className="col-span-2 text-zinc-600 font-bold">
                          {rowOffset.toString(16).toUpperCase().padStart(4, '0')}
                        </div>
                        {/* 16 Hex Byte columns */}
                        {Array.from({ length: 16 }).map((_, colIndex) => {
                          const byteIndex = rowOffset + colIndex;
                          const byte = payloadBytes[byteIndex];
                          const isBytePresent = byte !== undefined;
                          
                          // Hover highlight detection
                          const isHovered = hoveredFieldOffset !== null && 
                                            byteIndex >= hoveredFieldOffset && 
                                            byteIndex < (hoveredFieldOffset + hoveredFieldSize);

                          return (
                            <div
                              key={colIndex}
                              onMouseEnter={() => {
                                // Find which parsed field falls into this offset
                                const match = parsedFields.find(f => byteIndex >= f.offset && byteIndex < (f.offset + f.size));
                                if (match) {
                                  setHoveredFieldOffset(match.offset);
                                  setHoveredFieldSize(match.size);
                                }
                              }}
                              onMouseLeave={() => {
                                setHoveredFieldOffset(null);
                                setHoveredFieldSize(null);
                              }}
                              onDoubleClick={() => isBytePresent && startByteEdit(byteIndex, byte)}
                              className={`text-center rounded cursor-pointer transition-all duration-100 font-semibold ${
                                isHovered 
                                  ? 'bg-emerald-500/20 text-emerald-300 font-extrabold scale-110 shadow-sm border border-emerald-500/30' 
                                  : isBytePresent 
                                    ? 'text-zinc-300 hover:bg-zinc-800' 
                                    : 'text-zinc-800 select-none'
                              }`}
                            >
                              {editingByteIdx === byteIndex ? (
                                <input
                                  value={byteEditValue}
                                  onChange={e => setByteEditValue(e.target.value.substring(0,2))}
                                  onBlur={saveByteEdit}
                                  onKeyDown={e => e.key === 'Enter' && saveByteEdit()}
                                  className="w-full bg-emerald-950 text-emerald-400 font-mono text-[10px] text-center border border-emerald-500 rounded focus:outline-none"
                                  autoFocus
                                />
                              ) : isBytePresent ? (
                                byte.toString(16).toUpperCase().padStart(2, '0')
                              ) : (
                                '··'
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[9px] text-zinc-500">
              <span>* Double-click any hex block to inline edit</span>
              <span>* Hover to inspect field block range</span>
            </div>
          </div>

          {/* Hex Input Area */}
          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950/60 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-mono">Payload HEX Stream:</span>
              <button
                onClick={formatHexInput}
                className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Format Spacing
              </button>
            </div>
            <textarea
              value={hexInput}
              onChange={e => setHexInput(e.target.value)}
              placeholder="Paste raw packet hex (e.g. 24006500...)"
              rows={4}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-zinc-700 text-zinc-300 placeholder-zinc-700"
            />

            {/* Drag & Drop File loader */}
            <div 
              onDragOver={e => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-850 hover:border-zinc-750 transition-all rounded-xl p-4 text-center cursor-pointer bg-zinc-950/40 hover:bg-zinc-900/20"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileDrop}
                className="hidden"
              />
              <Upload className="h-5 w-5 mx-auto text-zinc-500 mb-1.5" />
              <p className="text-[10px] font-bold text-zinc-400">Drag & Drop Binary File (.bin, .dat)</p>
              <p className="text-[9px] text-zinc-650">or click to browse local files</p>
            </div>
          </div>

        </div>

        {/* MIDDLE COLUMN: Tabs for XML Schema / Re-encoder Form */}
        <div className="lg:col-span-4 space-y-6">
          <div className="border border-zinc-800 rounded-2xl bg-zinc-950/60 overflow-hidden shadow-xl">
            {/* Tabs */}
            <div className="grid grid-cols-3 border-b border-zinc-850 bg-zinc-900/30 text-center text-xs">
              <button
                onClick={() => setActiveTab('hex')}
                className={`py-3.5 font-bold cursor-pointer transition-colors border-r border-zinc-850 ${activeTab === 'hex' ? 'text-emerald-400 bg-zinc-950/40 font-extrabold border-b-2 border-b-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Encoder Form
              </button>
              <button
                onClick={() => setActiveTab('xml')}
                className={`py-3.5 font-bold cursor-pointer transition-colors border-r border-zinc-850 ${activeTab === 'xml' ? 'text-emerald-400 bg-zinc-950/40 font-extrabold border-b-2 border-b-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Schema XML
              </button>
              <button
                onClick={() => setActiveTab('state')}
                className={`py-3.5 font-bold cursor-pointer transition-colors ${activeTab === 'state' ? 'text-emerald-400 bg-zinc-950/40 font-extrabold border-b-2 border-b-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                FAST Context
              </button>
            </div>

            <div className="p-5">
              {/* Tab 1: Form Encoder */}
              {activeTab === 'hex' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
                    <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider">Compile Form to Payload</span>
                    <button
                      onClick={handleCompile}
                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30 text-[10px] font-bold font-mono transition-all flex items-center gap-1.5"
                    >
                      <RefreshCcw className="h-3 w-3" />
                      Compile Hex
                    </button>
                  </div>

                  <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
                    {parsedFields.length === 0 ? (
                      <div className="text-center py-12 text-zinc-650 text-xs">No schema loaded to compile fields.</div>
                    ) : (
                      parsedFields.map((f, idx) => {
                        const isHeader = f.tag === 'Header';
                        if (isHeader) return null;

                        return (
                          <div key={idx} className="space-y-1 bg-zinc-900/20 p-2.5 rounded-xl border border-zinc-900 hover:border-zinc-850 transition-colors">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-semibold text-zinc-350">{f.name}</label>
                              <span className="text-[9px] font-mono text-zinc-500">{f.type}</span>
                            </div>
                            <input
                              value={builderValues[f.name] || ''}
                              onChange={e => setBuilderValues({ ...builderValues, [f.name]: e.target.value })}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-zinc-700 text-zinc-200"
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Schema XML */}
              {activeTab === 'xml' && (
                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono block">Active Schema XML Definition:</span>
                  <textarea
                    value={xmlTemplate}
                    onChange={e => setXmlTemplate(e.target.value)}
                    rows={17}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl p-3 text-[11px] font-mono focus:outline-none focus:border-zinc-750 text-zinc-300"
                  />
                </div>
              )}

              {/* Tab 3: FAST State Context */}
              {activeTab === 'state' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
                    <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider">FAST State Dictionary (Operators Context)</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const count = Math.max(1, historyCount - 1);
                          setHistoryCount(count);
                          handleDecode();
                        }}
                        className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded border border-zinc-800 text-[10px]"
                      >
                        Prev Seq
                      </button>
                      <span className="text-[10px] font-mono text-zinc-300 font-bold px-1.5">{historyCount}</span>
                      <button
                        onClick={() => {
                          const count = historyCount + 1;
                          setHistoryCount(count);
                          handleDecode();
                        }}
                        className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded border border-zinc-800 text-[10px]"
                      >
                        Next Seq
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[11px] text-zinc-400">
                      FAST uses sequential dictionary contexts to emulate operators like <code className="text-emerald-400 font-mono">&lt;increment/&gt;</code> and <code className="text-emerald-400 font-mono">&lt;copy/&gt;</code>. Change sequence bounds above to watch decoded field values adapt.
                    </p>
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-900 font-mono text-xs space-y-1.5 text-zinc-400">
                      <div>Active Sequence Count: <span className="text-emerald-400 font-bold">{historyCount}</span></div>
                      <div>Symbol Cache: <span className="text-emerald-400 font-bold">AAPL</span></div>
                      <div>Dictionary Status: <span className="text-zinc-500 font-semibold">SYNCHRONIZED</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Decoded Fields Matrix & PMap visualizer */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Status and logs */}
          {parseErrors.length > 0 && (
            <div className="p-4 rounded-2xl border border-red-500/10 bg-red-500/5 text-red-400 text-xs flex items-start gap-2.5 shadow-md">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <div className="space-y-1">
                <p className="font-bold">Errors Mapped:</p>
                {parseErrors.map((e, idx) => <p key={idx} className="font-mono text-[11px]">{e}</p>)}
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-2xl border border-emerald-500/10 bg-emerald-500/5 text-emerald-400 text-xs flex items-center gap-2.5 shadow-md">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
              <p className="font-medium">{successMsg}</p>
            </div>
          )}

          {/* FAST PMap Bit Mapping */}
          {encoding === 'fast' && pmapDetails.length > 0 && (
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950/60 shadow-xl space-y-3">
              <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider block">Presence Map (PMap) Bit Breakdown:</span>
              <div className="grid grid-cols-4 gap-2">
                {pmapDetails.map((detail, idx) => (
                  <div 
                    key={idx} 
                    className={`p-2 rounded-lg border text-center font-mono space-y-0.5 ${detail.isPresent ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-zinc-900 border-zinc-850 text-zinc-500'}`}
                  >
                    <div className="text-[9px] text-zinc-500">Bit {detail.bitIndex}</div>
                    <div className="text-[11px] font-bold">{detail.isPresent ? '1' : '0'}</div>
                    <div className="text-[8px] truncate uppercase">{detail.field}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decoded Fields Table */}
          <div className="border border-zinc-800 rounded-2xl bg-zinc-950/60 overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-zinc-850 bg-zinc-900/30 flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 font-mono">
                <Layers className="h-3.5 w-3.5 text-emerald-400" />
                Decoded Fields Matrix
              </span>
            </div>

            <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 bg-zinc-950/30 text-zinc-500 text-[10px] uppercase font-bold tracking-wider font-mono">
                    <th className="px-4 py-3">Tag</th>
                    <th className="px-4 py-3">Field</th>
                    <th className="px-3 py-3">Hex</th>
                    <th className="px-4 py-3 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 font-mono text-[11px]">
                  {/* First render header elements if SBE */}
                  {encoding === 'sbe' && headerFields.map((h, idx) => (
                    <tr key={`header-${idx}`} className="bg-zinc-900/20 text-zinc-500 border-b border-zinc-900">
                      <td className="px-4 py-2.5 font-bold">H</td>
                      <td className="px-4 py-2.5 font-sans font-medium">{h.name.replace('Header: ', '')}</td>
                      <td className="px-3 py-2.5 text-[9px] tracking-tight">{h.rawHex}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-zinc-400">{h.value}</td>
                    </tr>
                  ))}

                  {parsedFields.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-zinc-600 font-sans">
                        Load payload to view decoded tags matrix.
                      </td>
                    </tr>
                  ) : (
                    parsedFields.map((field, idx) => {
                      const isHovered = hoveredFieldOffset === field.offset && hoveredFieldSize === field.size;
                      return (
                        <tr
                          key={idx}
                          onMouseEnter={() => {
                            if (field.size > 0) {
                              setHoveredFieldOffset(field.offset);
                              setHoveredFieldSize(field.size);
                            }
                          }}
                          onMouseLeave={() => {
                            setHoveredFieldOffset(null);
                            setHoveredFieldSize(null);
                          }}
                          className={`transition-colors duration-100 ${isHovered ? 'bg-emerald-500/10 text-emerald-300' : 'hover:bg-zinc-900/30 text-zinc-300'} ${field.status === 'error' ? 'bg-red-500/5 text-red-400' : ''}`}
                        >
                          <td className="px-4 py-3 font-bold text-emerald-500">{field.tag}</td>
                          <td className="px-4 py-3 font-sans font-medium text-zinc-200">{field.name}</td>
                          <td className="px-3 py-3 text-[10px] text-zinc-500 tracking-tighter">{field.rawHex}</td>
                          <td className="px-4 py-3 text-right font-bold text-zinc-100">{field.value}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reconstructed FIX message output */}
          {parsedFields.length > 0 && (
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950/60 shadow-xl space-y-3.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-mono block">Reconstructed Tag=Value Msg (SOH):</span>
              <div className="p-3 bg-zinc-950/80 border border-zinc-900 rounded-xl">
                <SohVisualizer rawMsg={buildFixString()} delimiter="|" />
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
