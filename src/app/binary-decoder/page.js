'use client';

import React, { useState, useRef } from 'react';
import {
  Layers,
  Upload,
  UploadCloud,
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
  FileDown,
  Play,
  RotateCcw,
  FileText
} from 'lucide-react';
import SohVisualizer from '@/components/SohVisualizer';
import { getTagName, getValueMeaning, validateFIXMessage } from '@/lib/fixParser';

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
  },

  fix_logon: {
    name: 'FIX Logon (ASCII Hex)',
    encoding: 'ascii_hex',
    payload: '383D4649582E342E3401393D37320133353D410134393D434C49454E540135363D5345525645520133343D310135323D32303236303731362D30313A31363A31342E3030300139383D30013130383D33300131303D30353601',
    schema: ''
  },

  fix_nos: {
    name: 'FIX Order (ASCII Hex)',
    encoding: 'ascii_hex',
    payload: '383D4649582E342E3401393D3133370133353D440133343D320134393D434C49454E540135323D32303236303731362D30313A32303A30302E3030300135363D5345525645520131313D4F52445F313030310132313D310133383D3130300134303D320134343D3135302E30303135343D310135353D4141504C0136303D32303236303731362D30313A32303A30302E3030300131303D32353301',
    schema: ''
  }
};

// ==========================================
// COMPONENT MAIN
// ==========================================

export default function BinaryDecoderPage() {
  const [encoding, setEncoding] = useState('sbe'); // 'sbe' | 'fast' | 'ascii_hex'
  const [xmlTemplate, setXmlTemplate] = useState('');
  const [hexInput, setHexInput] = useState('');
  const [parsedFields, setParsedFields] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [hoveredFieldOffset, setHoveredFieldOffset] = useState(null);
  const [hoveredFieldSize, setHoveredFieldSize] = useState(null);
  const [activePreset, setActivePreset] = useState('');
  const [editingByteIdx, setEditingByteIdx] = useState(null);
  const [byteEditValue, setByteEditValue] = useState('');
  const [activeTab, setActiveTab] = useState('fields'); // 'fields' | 'form' | 'pmap'
  const [pmapDetails, setPmapDetails] = useState([]);
  const [headerFields, setHeaderFields] = useState([]);
  const [builderValues, setBuilderValues] = useState({});
  const [historyCount, setHistoryCount] = useState(1);
  const [isDecoded, setIsDecoded] = useState(false);
  const [inputMode, setInputMode] = useState('paste'); // 'paste' | 'file'
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);

  const fileInputRef = useRef(null);

  // Load preset data
  const handlePresetSelect = (key) => {
    setActivePreset(key);
    const preset = PRESETS[key];
    setEncoding(preset.encoding);
    setXmlTemplate(preset.schema);
    setHexInput(preset.payload);

    // Dynamic decode run for the preset parameters immediately
    setParseErrors([]);
    setParsedFields([]);
    setPmapDetails([]);
    setHeaderFields([]);
    setSuccessMsg('');
    setIsDecoded(false);

    const cleanHex = preset.payload.replace(/[^0-9a-fA-F]/g, '');
    if (cleanHex.length % 2 !== 0) return;
    const bytes = [];
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes.push(parseInt(cleanHex.substring(i, i + 2), 16));
    }

    try {
      if (preset.encoding === 'sbe') {
        decodeSBE(bytes, preset.schema);
      } else if (preset.encoding === 'fast') {
        decodeFAST(bytes, preset.schema);
      } else if (preset.encoding === 'ascii_hex') {
        decodeAsciiHex(bytes);
      }
      setIsDecoded(true);
    } catch (err) {
      setParseErrors([`Decoding Error: ${err.message}`]);
    }
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

  // Decode handler
  const handleDecode = () => {
    setParseErrors([]);
    setParsedFields([]);
    setPmapDetails([]);
    setHeaderFields([]);
    setSuccessMsg('');
    setIsDecoded(false);

    if (!hexInput.trim()) {
      setParseErrors(["Hex payload is empty."]);
      return;
    }

    const bytes = getBytes();
    if (bytes.length === 0) {
      setParseErrors(["Hex payload is invalid or has odd length. Verification failed."]);
      return;
    }

    try {
      if (encoding === 'sbe') {
        decodeSBE(bytes);
      } else if (encoding === 'fast') {
        decodeFAST(bytes);
      } else if (encoding === 'ascii_hex') {
        decodeAsciiHex(bytes);
      }
      setIsDecoded(true);
    } catch (err) {
      setParseErrors([`Decoding Error: ${err.message}`]);
    }
  };

  const handleReset = () => {
    setActivePreset('');
    setEncoding('sbe');
    setXmlTemplate('');
    setHexInput('');
    setParsedFields([]);
    setParseErrors([]);
    setSuccessMsg('');
    setHoveredFieldOffset(null);
    setHoveredFieldSize(null);
    setEditingByteIdx(null);
    setByteEditValue('');
    setActiveTab('fields');
    setPmapDetails([]);
    setHeaderFields([]);
    setBuilderValues({});
    setIsDecoded(false);
  };

  // Load Demo Data helper (just like loadSampleData in latency)
  const handleLoadDemo = () => {
    handlePresetSelect('sbe_cme');
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
  const decodeSBE = (bytes, overrideXml) => {
    const activeXml = overrideXml !== undefined ? overrideXml : xmlTemplate;
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(activeXml, "application/xml");
    const parseErr = xmlDoc.getElementsByTagName("parsererror");
    if (parseErr.length > 0) {
      throw new Error("SBE XML Parser Error: " + parseErr[0].textContent);
    }

    const byteOrder = xmlDoc.documentElement.getAttribute("byteOrder") || "littleEndian";
    const types = parseSBETypes(xmlDoc);

    // 1. Decode Header (Standard SBE Header has 8 bytes)
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
    setSuccessMsg(`Decoded SBE Message "${msgName}" (Template ID ${templateId}). Read ${decoded.length} fields.`);

    // Initialize builder form inputs
    const initialInputs = {};
    decoded.forEach(f => {
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

  // FAST Binary Decoder
  const decodeFAST = (bytes, overrideXml) => {
    const activeXml = overrideXml !== undefined ? overrideXml : xmlTemplate;
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(activeXml, "application/xml");
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

    // Decode PMap
    const pmapBytes = [];
    while (byteIdx < bytes.length) {
      const b = bytes[byteIdx];
      pmapBytes.push(b);
      byteIdx++;
      if ((b & 0x80) !== 0) break;
    }

    let pmapBits = [];
    pmapBytes.forEach(b => {
      const payload = b & 0x7F;
      const bitsStr = payload.toString(2).padStart(7, '0');
      pmapBits.push(...bitsStr.split('').map(Number));
    });

    const pmapVisual = pmapBytes.map(b => b.toString(2).padStart(8, '0')).join(' ');
    
    setHeaderFields([
      { name: 'FAST PMap Bytes', tag: 'PMap', type: 'binary', offset: 0, size: pmapBytes.length, rawHex: pmapBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' '), value: pmapVisual, status: 'success' }
    ]);

    let bitPointer = 0;
    const decoded = [];
    
    const fastDict = {
      'MsgSeqNum': historyCount.toString(),
      'Symbol': 'AAPL'
    };

    fieldNodes.forEach((node, idx) => {
      const name = node.getAttribute("name") || `Field_${idx}`;
      const tag = node.getAttribute("id") || `0`;
      const type = node.localName;

      const hasCopy = node.getElementsByTagName("copy").length > 0;
      const hasDefault = node.getElementsByTagName("default").length > 0;
      const hasIncrement = node.getElementsByTagName("increment").length > 0;

      const requiresPMapBit = hasCopy || hasDefault || hasIncrement;
      let bitVal = 1;

      if (requiresPMapBit) {
        bitVal = pmapBits[bitPointer] !== undefined ? pmapBits[bitPointer] : 0;
        bitPointer++;
      }

      if (requiresPMapBit) {
        setPmapDetails(prev => [
          ...prev,
          { field: name, bitIndex: bitPointer - 1, isPresent: bitVal === 1, operator: hasCopy ? 'copy' : hasDefault ? 'default' : 'increment' }
        ]);
      }

      let valDisplay = "";
      const fieldStart = byteIdx;

      if (bitVal === 1) {
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
          valDisplay = valBytes.map((b, bIdx) => {
            const charCode = bIdx === valBytes.length - 1 ? (b & 0x7F) : b;
            return String.fromCharCode(charCode);
          }).join('');
          fastDict[name] = valDisplay;
        } else {
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
    setSuccessMsg(`Successfully decoded FAST message stream "${templateName}". Read ${decoded.length} fields.`);

    const initialInputs = {};
    decoded.forEach(f => {
      initialInputs[f.name] = f.value;
    });
    setBuilderValues(initialInputs);
  };

  // Standard FIX ASCII Hex Decoder
  const decodeAsciiHex = (bytes) => {
    const ascii = bytes.map(b => String.fromCharCode(b)).join('');
    
    // Parse using core FIX engine
    const parseResult = validateFIXMessage(ascii);
    
    if (!parseResult || !parseResult.tagList || parseResult.tagList.length === 0) {
      throw new Error("Could not parse standard FIX message from ASCII bytes.");
    }
    
    // Calculate tag field offsets in ASCII string
    const sep = parseResult.separator;
    let currentOffset = 0;
    const decoded = [];
    
    const parts = ascii.split(sep);
    parts.forEach((part) => {
      if (!part) {
        currentOffset += sep.length;
        return;
      }
      
      const eqIdx = part.indexOf('=');
      if (eqIdx !== -1) {
        const tag = part.substring(0, eqIdx).trim();
        const val = part.substring(eqIdx + 1);
        const name = getTagName(tag) || `CustomTag_${tag}`;
        const displayVal = getValueMeaning(tag, val) || val;
        const size = part.length;
        
        const fBytes = bytes.slice(currentOffset, currentOffset + size);
        const rawHexStr = fBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        
        decoded.push({
          name,
          tag,
          type: 'Tag-Value Pair',
          offset: currentOffset,
          size,
          rawHex: rawHexStr,
          value: `${displayVal} (${val})`,
          status: 'success'
        });
        
        currentOffset += size;
      }
      
      currentOffset += sep.length;
    });
    
    setParsedFields(decoded);
    setSuccessMsg(`Decoded ASCII Hex FIX message (${parseResult.msgTypeName}). Read ${decoded.length} fields.`);
    
    // Populate form builder values
    const initialInputs = {};
    decoded.forEach(f => {
      const startIdx = f.value.lastIndexOf('(');
      const cleanVal = startIdx !== -1 ? f.value.substring(startIdx + 1, f.value.length - 1) : f.value;
      initialInputs[f.name] = cleanVal;
    });
    setBuilderValues(initialInputs);
  };

  // Re-encode builder values back to Hex string (FAST/SBE Form Compiler)
  const handleCompile = () => {
    try {
      const bytes = [];

      if (encoding === 'sbe') {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlTemplate, "application/xml");
        const templateId = parseInt(xmlDoc.getElementsByTagName("message")[0]?.getAttribute("id") || "101", 10);
        const blockLength = parseInt(xmlDoc.getElementsByTagName("message")[0]?.getAttribute("blockLength") || "36", 10);
        const schemaId = parseInt(xmlDoc.documentElement.getAttribute("id") || "1", 10);
        const version = parseInt(xmlDoc.documentElement.getAttribute("version") || "1", 10);

        writeUint16(bytes, blockLength);
        writeUint16(bytes, templateId);
        writeUint16(bytes, schemaId);
        writeUint16(bytes, version);

        const fields = xmlDoc.getElementsByTagName("field");
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
      } else if (encoding === 'fast') {
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
      } else if (encoding === 'ascii_hex') {
        const delimiter = '\x01';
        const fieldsList = [];
        
        parsedFields.forEach(f => {
          const inputVal = builderValues[f.name];
          if (inputVal !== undefined) {
            fieldsList.push({ tag: f.tag, val: inputVal });
          }
        });
        
        if (fieldsList.length === 0) {
          throw new Error("No fields defined in context to compile. Please decode a message first.");
        }
        
        const tag8 = fieldsList.find(f => f.tag === '8')?.val || 'FIX.4.4';
        const tag35 = fieldsList.find(f => f.tag === '35')?.val || 'D';
        
        const otherFields = fieldsList.filter(f => f.tag !== '8' && f.tag !== '9' && f.tag !== '10' && f.tag !== '35');
        const headerTags = ['49', '56', '34', '52'];
        const headers = [];
        const body = [];
        
        otherFields.forEach(f => {
          if (headerTags.includes(f.tag)) {
            headers.push(f);
          } else {
            body.push(f);
          }
        });
        
        headers.sort((a, b) => headerTags.indexOf(a.tag) - headerTags.indexOf(b.tag));
        
        const orderedFields = [
          { tag: '35', val: tag35 },
          ...headers,
          ...body
        ];
        
        const bodyStr = orderedFields.map(f => `${f.tag}=${f.val}`).join(delimiter) + delimiter;
        const bodyLength = bodyStr.length;
        
        const partialMsg = `8=${tag8}${delimiter}9=${bodyLength}${delimiter}${bodyStr}`;
        
        let sum = 0;
        for (let i = 0; i < partialMsg.length; i++) {
          sum += partialMsg.charCodeAt(i);
        }
        const checksumVal = String(sum % 256).padStart(3, '0');
        
        const finalMsg = `${partialMsg}10=${checksumVal}${delimiter}`;
        
        const compiledBytes = [];
        for (let i = 0; i < finalMsg.length; i++) {
          compiledBytes.push(finalMsg.charCodeAt(i));
        }
        
        bytes.push(...compiledBytes);
      }

      const hexResult = bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('');
      setHexInput(hexResult);
      setSuccessMsg("Form values successfully compiled back to Hex payload.");
      
      // Auto-decode the compiled hex
      const cleanHex = hexResult.replace(/[^0-9a-fA-F]/g, '');
      const compiledBytesArray = [];
      for (let i = 0; i < cleanHex.length; i += 2) {
        compiledBytesArray.push(parseInt(cleanHex.substring(i, i + 2), 16));
      }
      if (encoding === 'sbe') {
        decodeSBE(compiledBytesArray);
      } else if (encoding === 'fast') {
        decodeFAST(compiledBytesArray);
      } else if (encoding === 'ascii_hex') {
        decodeAsciiHex(compiledBytesArray);
      }
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

  // Helper FAST writers
  const writeStopBitInt = (bytes, val) => {
    const parts = [];
    let temp = val;
    while (true) {
      parts.push(temp & 0x7F);
      temp = temp >> 7;
      if (temp === 0) break;
    }
    parts.reverse();
    parts[parts.length - 1] |= 0x80;
    bytes.push(...parts);
  };

  const writeStopBitString = (bytes, str) => {
    for (let i = 0; i < str.length; i++) {
      let charCode = str.charCodeAt(i);
      if (i === str.length - 1) {
        charCode |= 0x80;
      }
      bytes.push(charCode);
    }
  };

  // Reconstructed FIX SOH string
  const buildFixString = () => {
    if (encoding === 'ascii_hex') {
      const parts = parsedFields
        .map(f => {
          const startIdx = f.value.lastIndexOf('(');
          const cleanVal = startIdx !== -1 ? f.value.substring(startIdx + 1, f.value.length - 1) : f.value;
          return `${f.tag}=${cleanVal}`;
        });
      return parts.join('\x01');
    }
    const parts = parsedFields
      .filter(f => f.status === 'success')
      .map(f => `${f.tag}=${f.value.split(' ')[0]}`);
    if (parts.length === 0) return '';
    return `8=FIX.4.4\x019=${parts.join('\x01').length}\x01${parts.join('\x01')}\x0110=080\x01`;
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
      const compiledHex = hexParts.join('');
      setHexInput(compiledHex);
      
      // Auto-switch to Paste Hex tab so the inputs are completely visible and editable
      setInputMode('paste');
      
      // Force control input panel to be open
      setShowSetup(true);

      setSuccessMsg(`Loaded binary file "${file.name}" (${buffer.byteLength} bytes). Ready to decode.`);
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
    
    // Auto re-decode
    setTimeout(() => {
      try {
        if (encoding === 'sbe') decodeSBE(bytes);
        else if (encoding === 'fast') decodeFAST(bytes);
        else if (encoding === 'ascii_hex') decodeAsciiHex(bytes);
      } catch {}
    }, 50);
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

  // Metrics Dashboard (similar to home/latency page stats)
  const metricCards = [
    {
      label: 'Payload Size',
      value: `${payloadBytes.length} Bytes`,
      icon: Database,
      color: 'var(--foreground)',
      bg: 'var(--card-hover)'
    },
    {
      label: 'Fields Decoded',
      value: `${parsedFields.length} Fields`,
      icon: Layers,
      color: 'var(--primary)',
      bg: 'var(--primary-faint)'
    },
    {
      label: 'Encoding Scheme',
      value: encoding.toUpperCase(),
      icon: Cpu,
      color: '#fb923c',
      bg: 'rgba(251,146,60,0.08)'
    },
    {
      label: 'Decoder Status',
      value: parseErrors.length > 0 ? 'Warnings' : 'Conformant',
      icon: parseErrors.length > 0 ? AlertTriangle : CheckCircle,
      color: parseErrors.length > 0 ? '#f87171' : 'var(--primary)',
      bg: parseErrors.length > 0 ? 'rgba(239,68,68,0.08)' : 'var(--primary-faint)'
    }
  ];

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto animate-in fade-in duration-200 text-zinc-100 select-none pb-8">
      
      {/* Page Header */}
      <div className={`fx-page-header flex flex-col md:flex-row md:items-start justify-between gap-4 ${!isDecoded ? 'max-w-2xl mx-auto' : ''}`}>
        <div className={`space-y-1.5 select-text ${!isDecoded ? 'text-center md:text-left w-full' : ''}`}>
          <h1 className="text-2xl font-bold tracking-tight flex items-center justify-center md:justify-start gap-2.5" style={{ color: 'var(--foreground)' }}>
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
            >
              <Cpu className="h-5 w-5" style={{ color: 'var(--primary)' }} />
            </div>
            <span>Binary Decoder</span>
            <Info
              onClick={() => setInfoModalOpen(true)}
              className="h-4 w-4 text-[var(--text-muted)] hover:text-[var(--primary)] transition-all cursor-pointer ml-1.5"
              title="View help & usage guide"
            />
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Professional high-frequency trading diagnostic sandbox. Decode, modify, and re-compile binary market data frames dynamically.
          </p>
        </div>

        {/* Coupled stats and preset selectors in header - no separate stats dashboard or success sections */}
        {isDecoded && (
          <div className="flex flex-wrap items-center gap-3.5 shrink-0 self-start md:self-center">
            
            {/* Coupled Stats & Diagnostic Status Badge (Kept clean without long success messages) */}
            <div 
              className="flex items-center gap-3 p-2 px-3 rounded-xl border text-[11px]"
              style={{
                borderColor: 'var(--primary-border)',
                backgroundColor: 'var(--primary-faint)',
                color: 'var(--primary)'
              }}
            >
              <div className="flex items-center gap-1 font-medium text-zinc-200">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--primary)' }} />
                <span>Payload Decoded</span>
              </div>
              <div className="h-3.5 w-px bg-zinc-800" style={{ backgroundColor: 'var(--primary-border)' }} />
              
              {/* Clicking this button triggers the detailed modal containing all success info and metrics */}
              <button
                onClick={() => setStatsModalOpen(true)}
                className="p-1 hover:bg-zinc-800/80 rounded transition-all text-zinc-400 hover:text-[var(--primary)] cursor-pointer"
                title="View detailed payload metrics"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Presets Select Dropdown */}
            <div className="flex items-center gap-1.5">
              <select
                value={activePreset}
                onChange={(e) => handlePresetSelect(e.target.value)}
                className="bg-zinc-955 border border-zinc-855 rounded-xl px-2.5 py-1.5 text-xs font-mono text-zinc-350 focus:outline-none focus:border-zinc-700 min-w-36 cursor-pointer"
              >
                <option value="" disabled>-- Select Preset --</option>
                {Object.keys(PRESETS).map(key => (
                  <option key={key} value={key}>
                    {PRESETS[key].name}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Toggles */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="fx-btn-secondary py-1.5 px-3.5 text-xs font-semibold"
                title="Reset workspace"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            </div>

          </div>
        )}
      </div>

      {/* Conditional Layout Toggling (Similar to home/latency page) */}
      {!isDecoded ? (
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Controls Input Card */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
          >
            {/* Card Toolbar Tabs */}
            <div
              className="px-5 py-3.5 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
            >
              <div className="fx-tab-group">
                <button
                  className={`fx-tab${inputMode === 'paste' ? ' active' : ''}`}
                  onClick={() => setInputMode('paste')}
                >
                  <FileText className="h-3.5 w-3.5" /> <span>Paste Hex</span>
                </button>
                <button
                  className={`fx-tab${inputMode === 'file' ? ' active' : ''}`}
                  onClick={() => setInputMode('file')}
                >
                  <UploadCloud className="h-3.5 w-3.5" /> <span>Upload File</span>
                </button>
              </div>
              <button
                onClick={handleLoadDemo}
                className="fx-btn-primary py-1 px-3 text-[10px]"
              >
                Load Demo
              </button>
            </div>

            <div className="p-6 space-y-4 select-text">
              {inputMode === 'file' ? (
                <div className="space-y-4">
                  {/* File upload configuration */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 font-sans">Binary Encoding Scheme</label>
                    <select
                      value={encoding}
                      onChange={(e) => {
                        setEncoding(e.target.value);
                        if (e.target.value === 'ascii_hex') {
                          setXmlTemplate('');
                        } else if (e.target.value === 'sbe') {
                          setXmlTemplate(PRESETS.sbe_cme.schema);
                        } else {
                          setXmlTemplate(PRESETS.fast_opra.schema);
                        }
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-700 cursor-pointer"
                    >
                      <option value="sbe">SBE — Simple Binary Encoding</option>
                      <option value="fast">FAST — FIX Adapted for Streaming</option>
                      <option value="ascii_hex">Standard FIX Message (ASCII Hex)</option>
                    </select>
                  </div>

                  <div 
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-zinc-800 hover:border-zinc-700 transition-all rounded-xl p-10 text-center cursor-pointer bg-zinc-955/40 hover:bg-zinc-900/20"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileDrop}
                      className="hidden"
                    />
                    <UploadCloud className="h-10 w-10 mx-auto text-zinc-500 mb-2" />
                    <p className="text-sm font-semibold text-zinc-300 font-sans">Drag & Drop Binary File (.bin, .dat, .hex)</p>
                    <p className="text-xs text-zinc-500 font-sans mt-0.5">or click to browse local files</p>
                  </div>

                  {encoding !== 'ascii_hex' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-400 font-sans">XML Schema Definition</label>
                      <textarea
                        value={xmlTemplate}
                        onChange={(e) => setXmlTemplate(e.target.value)}
                        rows={6}
                        placeholder="Paste SBE/FAST XML layout schemas here..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-[11px] font-mono focus:outline-none focus:border-zinc-700 text-zinc-300 placeholder-zinc-800"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Hex paste configuration */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 font-sans">Binary Encoding Scheme</label>
                    <select
                      value={encoding}
                      onChange={(e) => {
                        setEncoding(e.target.value);
                        if (e.target.value === 'ascii_hex') {
                          setXmlTemplate('');
                        } else if (e.target.value === 'sbe') {
                          setXmlTemplate(PRESETS.sbe_cme.schema);
                        } else {
                          setXmlTemplate(PRESETS.fast_opra.schema);
                        }
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-700 cursor-pointer"
                    >
                      <option value="sbe">SBE — Simple Binary Encoding</option>
                      <option value="fast">FAST — FIX Adapted for Streaming</option>
                      <option value="ascii_hex">Standard FIX Message (ASCII Hex)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 font-sans">Hex Payload Stream</label>
                    <div className="relative">
                      <textarea
                        value={hexInput}
                        onChange={(e) => setHexInput(e.target.value)}
                        placeholder="Paste hex data stream here (e.g. 2400650001000300... or ASCII Hex)"
                        rows={5}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-zinc-700 text-zinc-300 placeholder-zinc-800"
                      />
                      <button
                        onClick={formatHexInput}
                        className="absolute bottom-3.5 right-3.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                      >
                        Format Bytes
                      </button>
                    </div>
                  </div>

                  {encoding !== 'ascii_hex' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-400 font-sans">XML Schema Definition</label>
                      <textarea
                        value={xmlTemplate}
                        onChange={(e) => setXmlTemplate(e.target.value)}
                        rows={6}
                        placeholder="Paste SBE/FAST XML layout schemas here..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-[11px] font-mono focus:outline-none focus:border-zinc-700 text-zinc-350 placeholder-zinc-800"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Decode Action Button */}
              <button
                onClick={handleDecode}
                className="fx-btn-primary w-full py-3.5 rounded-xl text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-100 transition-all cursor-pointer shadow-lg"
              >
                <Play className="h-4 w-4 fill-zinc-950" />
                <span>Decode Binary Payload</span>
              </button>
            </div>
          </div>

          {parseErrors.length > 0 && (
            <div className="p-4 rounded-2xl border border-red-500/10 bg-red-500/5 text-red-400 text-xs flex items-start gap-2.5 shadow-md animate-in slide-in-from-top-1">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <div className="space-y-1">
                <p className="font-bold font-sans">Diagnostic Warnings / Errors:</p>
                {parseErrors.map((e, idx) => <p key={idx} className="font-mono text-[11px]">{e}</p>)}
              </div>
            </div>
          )}

          {successMsg && (
            <div 
              className="p-4 rounded-2xl border text-xs flex items-center gap-2.5 shadow-md animate-in slide-in-from-top-1 font-sans"
              style={{
                borderColor: 'var(--primary-border)',
                backgroundColor: 'var(--primary-faint)',
                color: 'var(--primary)'
              }}
            >
              <CheckCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--primary)' }} />
              <p className="font-medium">{successMsg}</p>
            </div>
          )}
          
        </div>
      ) : (
        <>
          {/* Diagnostic warnings show at body level when decoded */}
          {parseErrors.length > 0 && (
            <div className="p-4 rounded-2xl border border-red-500/10 bg-red-500/5 text-red-400 text-xs flex items-start gap-2.5 shadow-md animate-in slide-in-from-top-1">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <div className="space-y-1">
                <p className="font-bold font-sans">Diagnostic Warnings / Errors:</p>
                {parseErrors.map((e, idx) => <p key={idx} className="font-mono text-[11px]">{e}</p>)}
              </div>
            </div>
          )}

          {/* Diagnostics Workspace Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 select-text animate-in fade-in duration-300">
            
            {/* LEFT COLUMN: Input Form */}
            <div className="lg:col-span-5 space-y-6 flex flex-col">
              
              {/* Encoder Configuration Card */}
              <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-955/60 shadow-xl space-y-4">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                  1. Decoder Configuration
                </span>
                
                <div className="space-y-4">
                  {/* Encoding Select */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 font-sans">Binary Encoding Scheme</label>
                    <select
                      value={encoding}
                      onChange={(e) => {
                        setEncoding(e.target.value);
                        if (e.target.value === 'ascii_hex') {
                          setXmlTemplate('');
                        } else if (e.target.value === 'sbe') {
                          setXmlTemplate(PRESETS.sbe_cme.schema);
                        } else {
                          setXmlTemplate(PRESETS.fast_opra.schema);
                        }
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-zinc-350 focus:outline-none focus:border-zinc-700 cursor-pointer"
                    >
                      <option value="sbe">SBE — Simple Binary Encoding</option>
                      <option value="fast">FAST — FIX Adapted for Streaming</option>
                      <option value="ascii_hex">Standard FIX Message (ASCII Hex)</option>
                    </select>
                  </div>

                  {/* XML Schema Editor (Conditional) */}
                  {encoding !== 'ascii_hex' && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-zinc-400 font-sans">XML Schema Definition</label>
                        <span className="text-[9px] font-mono text-zinc-655 bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded">XML</span>
                      </div>
                      <textarea
                        value={xmlTemplate}
                        onChange={(e) => setXmlTemplate(e.target.value)}
                        rows={12}
                        placeholder="Paste SBE/FAST XML layout schemas here..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-[11px] font-mono focus:outline-none focus:border-zinc-700 text-zinc-300 placeholder-zinc-800"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Hex Stream Card */}
              <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-955/60 shadow-xl space-y-4">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                  2. Hex Payload Stream
                </span>

                <div className="space-y-3.5">
                  <div className="relative">
                    <textarea
                      value={hexInput}
                      onChange={(e) => setHexInput(e.target.value)}
                      placeholder="Paste hex data stream here (e.g. 383D464958... or SBE bytes)"
                      rows={5}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-zinc-700 text-zinc-300 placeholder-zinc-800"
                    />
                    <button
                      onClick={formatHexInput}
                      className="absolute bottom-3.5 right-3.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      Format Bytes
                    </button>
                  </div>

                  {/* Drag & Drop File Loader */}
                  <div 
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-zinc-850 hover:border-zinc-750 transition-all rounded-xl p-4 text-center cursor-pointer bg-zinc-955/40 hover:bg-zinc-900/20"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileDrop}
                      className="hidden"
                    />
                    <Upload className="h-5 w-5 mx-auto text-zinc-500 mb-1.5" />
                    <p className="text-[10px] font-bold text-zinc-400 font-sans">Drag & Drop Binary File (.bin, .dat)</p>
                    <p className="text-[9px] text-zinc-650 font-sans mt-0.5">or click to browse local files</p>
                  </div>
                </div>
              </div>

              {/* Action Trigger Button */}
              <button
                onClick={handleDecode}
                className="fx-btn-primary w-full py-3.5 rounded-xl text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-100 transition-all cursor-pointer shadow-lg"
              >
                <Play className="h-4 w-4 fill-zinc-950" />
                <span>Decode Binary Payload</span>
              </button>

            </div>

            {/* RIGHT COLUMN: Output Diagnostics */}
            <div className="lg:col-span-7 space-y-6">

              <div className="space-y-6">
                
                {/* Interactive Hex Dump Inspector */}
                <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-955/60 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                      Hex Dump Inspector
                    </span>
                    <span className="text-[9px] font-mono text-zinc-555 uppercase tracking-widest bg-zinc-900 px-2.5 py-0.5 rounded border border-zinc-800 font-semibold">
                      Size: {payloadBytes.length} Bytes
                    </span>
                  </div>

                  <div className="border border-zinc-900 rounded-xl overflow-hidden bg-zinc-955/20 font-mono text-[11px]">
                    <div className="grid grid-cols-18 gap-1 p-3 bg-zinc-900/40 border-b border-zinc-900 text-zinc-500 text-[10px] font-bold text-center">
                      <div className="col-span-2 text-left">OFFSET</div>
                      {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i}>{i.toString(16).toUpperCase()}</div>
                      ))}
                    </div>

                    <div className="p-3 divide-y divide-zinc-900 max-h-[280px] overflow-y-auto custom-scrollbar space-y-1">
                      {payloadBytes.length === 0 ? (
                        <div className="text-center py-10 text-zinc-655 font-sans text-xs">No payload bytes loaded.</div>
                      ) : (
                        Array.from({ length: Math.ceil(payloadBytes.length / 16) }).map((_, rowIndex) => {
                          const rowOffset = rowIndex * 16;
                          return (
                            <div key={rowIndex} className="grid grid-cols-18 gap-1 py-1.5 hover:bg-zinc-900/10 transition-colors">
                              <div className="col-span-2 text-zinc-600 font-bold">
                                {rowOffset.toString(16).toUpperCase().padStart(4, '0')}
                              </div>
                              {Array.from({ length: 16 }).map((_, colIndex) => {
                                const byteIndex = rowOffset + colIndex;
                                const byte = payloadBytes[byteIndex];
                                const isBytePresent = byte !== undefined;
                                
                                const isHovered = hoveredFieldOffset !== null && 
                                                  byteIndex >= hoveredFieldOffset && 
                                                  byteIndex < (hoveredFieldOffset + hoveredFieldSize);

                                return (
                                  <div
                                    key={colIndex}
                                    onMouseEnter={() => {
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
                                    style={isHovered ? {
                                      backgroundColor: 'var(--primary-faint)',
                                      color: 'var(--primary)',
                                      borderColor: 'var(--primary-border)',
                                      borderWidth: '1px'
                                    } : {}}
                                    className={`text-center rounded cursor-pointer transition-all duration-100 font-semibold ${
                                      isHovered 
                                        ? 'font-extrabold scale-110 shadow-sm' 
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
                                        style={{
                                          background: 'var(--background)',
                                          color: 'var(--primary)',
                                          borderColor: 'var(--primary-border)'
                                        }}
                                        className="w-full font-mono text-[10px] text-center border rounded focus:outline-none"
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

                  <div className="flex items-center justify-between text-[9px] text-zinc-555 font-sans">
                    <span>* Double-click any byte cell to inline edit</span>
                    <span>* Hover cells to inspect field offset boundary ranges</span>
                  </div>
                </div>

                {/* Dynamic Tabs Block */}
                <div className="border border-zinc-800 rounded-2xl bg-zinc-955/60 overflow-hidden shadow-xl">
                  
                  {/* Tabs selection */}
                  <div className="grid grid-cols-3 border-b border-zinc-850 bg-zinc-900/30 text-center text-xs">
                    <button
                      onClick={() => setActiveTab('fields')}
                      style={activeTab === 'fields' ? {
                        color: 'var(--primary)',
                        borderBottomColor: 'var(--primary)',
                        borderBottomWidth: '2px'
                      } : {}}
                      className={`py-3.5 font-bold cursor-pointer transition-all border-r border-zinc-855 ${activeTab === 'fields' ? 'bg-zinc-955/40 font-extrabold' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      Decoded Fields
                    </button>
                    <button
                      onClick={() => setActiveTab('form')}
                      style={activeTab === 'form' ? {
                        color: 'var(--primary)',
                        borderBottomColor: 'var(--primary)',
                        borderBottomWidth: '2px'
                      } : {}}
                      className={`py-3.5 font-bold cursor-pointer transition-all border-r border-zinc-855 ${activeTab === 'form' ? 'bg-zinc-955/40 font-extrabold' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      Payload Compiler
                    </button>
                    <button
                      onClick={() => setActiveTab('pmap')}
                      style={activeTab === 'pmap' ? {
                        color: 'var(--primary)',
                        borderBottomColor: 'var(--primary)',
                        borderBottomWidth: '2px'
                      } : {}}
                      className={`py-3.5 font-bold cursor-pointer transition-all ${activeTab === 'pmap' ? 'bg-zinc-955/40 font-extrabold' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      FAST PMap / Context
                    </button>
                  </div>

                  <div className="p-5">
                    {/* Tab 1: Decoded fields matrix */}
                    {activeTab === 'fields' && (
                      <div className="space-y-4">
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-900 bg-zinc-955/30 text-zinc-500 text-[10px] uppercase font-bold tracking-wider font-mono">
                                <th className="px-4 py-3 font-sans">Tag</th>
                                <th className="px-4 py-3 font-sans">Field</th>
                                <th className="px-3 py-3 font-sans">Hex</th>
                                <th className="px-4 py-3 text-right font-sans">Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-900 font-mono text-[11px]">
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
                                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-650 font-sans">
                                    No fields decoded.
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
                                      style={isHovered ? {
                                        backgroundColor: 'var(--primary-faint)',
                                        color: 'var(--primary)'
                                      } : {}}
                                      className={`transition-colors duration-100 ${isHovered ? '' : 'hover:bg-zinc-900/20 text-zinc-300'} ${field.status === 'error' ? 'bg-red-500/5 text-red-400' : ''}`}
                                    >
                                      <td className="px-4 py-3 font-bold" style={{ color: 'var(--primary)' }}>{field.tag}</td>
                                      <td className="px-4 py-3 font-sans font-medium text-zinc-200">{field.name}</td>
                                      <td className="px-3 py-3 text-[10px] text-zinc-550 tracking-tighter">{field.rawHex}</td>
                                      <td className="px-4 py-3 text-right font-bold text-zinc-100">{field.value}</td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Payload Form Compiler */}
                    {activeTab === 'form' && (
                      <div className="space-y-4 animate-in fade-in duration-100">
                        <div className="flex items-center justify-between pb-2.5 border-b border-zinc-900">
                          <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider">Form Editor Sandbox</span>
                          <button
                            onClick={handleCompile}
                            className="fx-btn-secondary px-3.5 py-1.5 text-[10px] font-bold flex items-center gap-1.5 rounded-lg cursor-pointer"
                          >
                            <RefreshCcw className="h-3.5 w-3.5" />
                            Compile to HEX
                          </button>
                        </div>

                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                          {parsedFields.length === 0 ? (
                            <div className="text-center py-10 text-zinc-655 text-xs font-sans">No active fields mapped.</div>
                          ) : (
                            parsedFields.map((f, idx) => {
                              if (f.tag === 'Header') return null;

                              return (
                                <div key={idx} className="space-y-1 bg-zinc-900/10 p-2.5 rounded-xl border border-zinc-900 hover:border-zinc-850 transition-colors flex items-center justify-between gap-4">
                                  <div className="space-y-0.5">
                                    <label className="text-[11px] font-bold text-zinc-350 block font-sans">{f.name}</label>
                                    <span className="text-[9px] font-mono text-zinc-550 block">Tag {f.tag} • {f.type}</span>
                                  </div>
                                  <input
                                    value={builderValues[f.name] || ''}
                                    onChange={e => setBuilderValues({ ...builderValues, [f.name]: e.target.value })}
                                    className="bg-zinc-955 border border-zinc-855 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 w-44 text-right"
                                  />
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tab 3: FAST PMap / state */}
                    {activeTab === 'pmap' && (
                      <div className="space-y-4">
                        {encoding !== 'fast' ? (
                          <div className="text-center py-10 text-zinc-600 text-xs font-sans">
                            Presence Map (PMap) breakdown is only available for FAST-encoded streams.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {pmapDetails.length === 0 ? (
                              <div className="text-center py-10 text-zinc-650 text-xs font-sans">No PMap bits extracted.</div>
                            ) : (
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {pmapDetails.map((detail) => (
                                  <div 
                                    key={detail.bitIndex} 
                                    style={detail.isPresent ? {
                                      backgroundColor: 'var(--primary-faint)',
                                      borderColor: 'var(--primary-border)',
                                      color: 'var(--primary)'
                                    } : {}}
                                    className={`p-2.5 rounded-xl border text-center font-mono space-y-0.5 ${detail.isPresent ? 'text-emerald-300 font-bold' : 'bg-zinc-900 border-zinc-855 text-zinc-500'}`}
                                  >
                                    <div className="text-[8px] text-zinc-555">Bit {detail.bitIndex}</div>
                                    <div className="text-[12px] font-extrabold">{detail.isPresent ? '1' : '0'}</div>
                                    <div className="text-[8px] truncate uppercase">{detail.field}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="space-y-3.5 border-t border-zinc-900 pt-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold font-mono text-zinc-400 uppercase tracking-wider">FAST Operators History Context</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      const count = Math.max(1, historyCount - 1);
                                      setHistoryCount(count);
                                      handleDecode();
                                    }}
                                    className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded border border-zinc-800 text-[10px] cursor-pointer"
                                  >
                                    Prev
                                  </button>
                                  <span className="text-[10px] font-mono text-zinc-300 font-bold px-1.5">{historyCount}</span>
                                  <button
                                    onClick={() => {
                                      const count = historyCount + 1;
                                      setHistoryCount(count);
                                      handleDecode();
                                    }}
                                    className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded border border-zinc-800 text-[10px] cursor-pointer"
                                  >
                                    Next
                                  </button>
                                </div>
                              </div>
                              <p className="text-[11px] text-zinc-555 leading-relaxed font-sans">
                                FAST uses contextual states to resolve incremental (<code className="font-mono" style={{ color: 'var(--primary)' }}>&lt;increment/&gt;</code>) or copy (<code className="font-mono" style={{ color: 'var(--primary)' }}>&lt;copy/&gt;</code>) operator bounds. Adjust sequence indexes to see values adapt.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>

                {/* Reconstructed SOH Tag-Value Message */}
                <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-955/60 shadow-xl space-y-3.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-mono block">Reconstructed Tag=Value Message (SOH):</span>
                  <div className="p-3 bg-zinc-955/80 border border-zinc-900 rounded-xl overflow-x-auto">
                    <SohVisualizer content={buildFixString()} delimiter="\x01" />
                  </div>
                </div>

              </div>

            </div>

          </div>
        </>
      )}

      {/* Usage & Help Modal overlay */}
      {infoModalOpen && (
        <>
          <div
            className="fixed inset-0 backdrop-blur-sm z-50 animate-in fade-in duration-200"
            onClick={() => setInfoModalOpen(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50 p-6 rounded-2xl border shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] overflow-hidden"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4 mb-4" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-[var(--primary)]" />
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono">Usage & Help Guide</h3>
              </div>
              <button
                onClick={() => setInfoModalOpen(false)}
                className="text-zinc-500 hover:text-[var(--foreground)] transition-colors text-xs font-semibold font-mono cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto space-y-4 pr-1 text-xs leading-relaxed scrollbar-thin">
              <div className="space-y-2">
                <p className="font-bold text-[var(--foreground)]">What is Simple Binary Encoding (SBE)?</p>
                <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                  Simple Binary Encoding (SBE) is a low-latency, binary message format optimized for high-frequency trading (HFT) feeds, such as CME MDP 3.0 or B3. It encodes fields at fixed byte offsets using little-endian or big-endian orders, allowing hardware and software to parse packets with zero copy operations.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-[var(--foreground)]">What is FIX Adapted for Streaming (FAST)?</p>
                <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                  FAST is a data compression protocol designed to minimize bandwidth utilization. It utilizes a **Presence Map (PMap)** bit vector where each bit determines if a field is present in the stream or if it should be resolved using state operators (e.g. <code>copy</code>, <code>default</code>, or <code>increment</code>).
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-[var(--foreground)]">Usage Guidelines:</p>
                <ul className="list-disc pl-4 space-y-1 text-[var(--text-muted)] text-[11px] leading-relaxed">
                  <li><strong>Select Preset:</strong> Choose a preset (e.g., CME SBE or OPRA FAST) to automatically load demo schemas and payloads.</li>
                  <li><strong>Custom Payloads:</strong> Paste any raw Hex bytes in the "Paste Hex" input field, choose the protocol type, edit your XML schema, and click <strong>Decode Binary Payload</strong>.</li>
                  <li><strong>Hex Dump Inspector:</strong> Hover over fields in the decoded table to view their byte boundaries highlighted in the grid. Double-click any byte cell to edit it directly.</li>
                  <li><strong>Payload Compiler:</strong> Edit values in the "Payload Compiler" tab and click "Compile to HEX" to re-encode standard tag-value segments or binary frames.</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Detailed Payload Statistics Modal overlay */}
      {statsModalOpen && (
        <>
          <div
            className="fixed inset-0 backdrop-blur-sm z-50 animate-in fade-in duration-200"
            onClick={() => setStatsModalOpen(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50 p-6 rounded-2xl border shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] overflow-hidden"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4 mb-4" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono">Payload Statistics Dashboard</h3>
              </div>
              <button
                onClick={() => setStatsModalOpen(false)}
                className="text-zinc-500 hover:text-[var(--foreground)] transition-colors text-xs font-semibold font-mono cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Content - Detailed Success Banner & Metric Cards Grid */}
            <div className="overflow-y-auto space-y-4 pr-1 text-xs leading-relaxed scrollbar-thin">
              <div 
                className="p-3.5 rounded-xl border text-xs flex items-center gap-2.5 font-sans"
                style={{
                  borderColor: 'var(--primary-faint)',
                  backgroundColor: 'var(--primary-faint)',
                  color: 'var(--primary)'
                }}
              >
                <CheckCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--primary)' }} />
                <p className="font-semibold">{successMsg}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 select-text">
                {metricCards.map((card, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3.5 p-4 rounded-xl border border-zinc-805 bg-zinc-950/40"
                  >
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: card.bg }}
                    >
                      <card.icon className="h-5 w-5" style={{ color: card.color }} />
                    </div>
                    <div className="min-w-0 flex-1 font-sans">
                      <div className="text-base font-extrabold font-mono" style={{ color: card.color }}>
                        {card.value}
                      </div>
                      <div className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">
                        {card.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
