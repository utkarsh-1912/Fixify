import { FIX_TAGS, FIX_VALUES } from "./fixTags";
import { getCustomDialect } from "./dialect";

export const getTagName = (tag) => {
  const custom = getCustomDialect();
  if (custom && Array.isArray(custom.fields)) {
    const field = custom.fields.find(f => String(f.tag) === String(tag));
    if (field) return field.name;
  }
  return FIX_TAGS[tag];
};

export const getValueMeaning = (tag, val) => {
  const custom = getCustomDialect();
  if (custom && Array.isArray(custom.fields)) {
    const field = custom.fields.find(f => String(f.tag) === String(tag));
    if (field && Array.isArray(field.values)) {
      const match = field.values.find(v => String(v.enum) === String(val));
      if (match) return match.description;
    }
  }
  return FIX_VALUES[tag]?.[val] || val;
};

// Comprehensive map for FIX message type execution order. Lower number = higher priority.
export const FIX_ORDER_MAP = {
  'A': 1,  // Logon
  'D': 2,  // NewOrderSingle
  'G': 3,  // OrderCancelReplaceRequest
  'F': 4,  // OrderCancelRequest
  'R': 5,  // QuoteRequest
  'k': 6,  // BidRequest
  'V': 7,  // MarketDataRequest
  'c': 8,  // SecurityDefinitionRequest
  'e': 9,  // SecurityStatusRequest
  'g': 10, // TradingSessionStatusRequest
  'H': 11, // OrderStatusRequest
  'a': 12, // QuoteStatusRequest
  'K': 13, // ListCancelRequest
  'M': 14, // ListStatusRequest
  'l': 15, // BidResponse
  'S': 16, // Quote
  'W': 17, // MarketDataSnapshotFullRefresh
  'X': 18, // MarketDataIncrementalRefresh
  'd': 19, // SecurityDefinition
  'f': 20, // SecurityStatus
  'h': 21, // TradingSessionStatus
  'i': 22, // MassQuote
  'm': 23, // ListStrikePrice
  '8': 24, // ExecutionReport
  'J': 25, // AllocationInstruction
  'AK': 26, // AllocationReportAck
  'P': 27,  // AllocationInstructionAck
  'AU': 28, // TradeCaptureReportAck
  'b': 29, // MassQuoteAcknowledgement
  '9': 30, // OrderCancelReject
  'j': 31, // BusinessMessageReject
  'Y': 32, // MarketDataRequestReject
  'Q': 33, // DontKnowTrade(DK)
  '3': 34, // Reject
  'B': 35, // News
  'C': 36, // Email
  'T': 37, // SettlementInstructions
  '6': 38, // IndicationofInterest
  '7': 39, // Advertisement
  'L': 40, // ListExecute
  'N': 41, // ListStatus
  '2': 42, // ResendRequest
  '4': 43, // SequenceReset
  '5': 44, // Logout
  '0': 45, // Heartbeat
  '1': 46, // TestRequest
};

/**
 * Extracts the value of a specific tag from a FIX message line.
 * It looks for tag= preceded by a delimiter (SOH or pipe) or start of line.
 */
export const getTagValue = (line, tag, customDelimiter) => {
  let delimPattern = '\\x01|\\|';
  let delim = customDelimiter || '';
  if (delim === 'SOH' || delim === '\\x01' || delim === '\\u0001') {
    delimPattern = '\\x01|\\u0001|\\^A';
  } else if (delim === '|') {
    delimPattern = '\\|';
  } else if (delim && delim !== 'Auto') {
    delimPattern = delim.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  } else {
    delimPattern = '\\x01|\\u0001|\\||\\^A';
  }
  const match = line.match(new RegExp(`(?:^|${delimPattern})${tag}=([^${delimPattern}]+)`));
  return match ? match[1] : '';
};

/**
 * Extracts and parses a timestamp from a FIX message line.
 * Follows the 3 fallback rules, defaulting to Unix Epoch (new Date(0)).
 */
export const extractTimestamp = (line, customDelimiter) => {
  // Rule 1: Prioritize custom tag 90052 (YYYYMMDD-HHMMSS.sss)
  let tsStr = getTagValue(line, '90052', customDelimiter);
  if (tsStr && tsStr.includes('-')) {
    const [datePart, timePart] = tsStr.split('-');
    if (datePart && timePart && datePart.length === 8 && timePart.length >= 6) {
      const year = parseInt(datePart.substring(0, 4), 10);
      const month = parseInt(datePart.substring(4, 6), 10) - 1;
      const day = parseInt(datePart.substring(6, 8), 10);
      const hours = parseInt(timePart.substring(0, 2), 10);
      const minutes = parseInt(timePart.substring(2, 4), 10);
      const seconds = parseInt(timePart.substring(4, 6), 10);
      const ms = timePart.includes('.') ? parseInt(timePart.split('.')[1], 10) : 0;
      const date = new Date(Date.UTC(year, month, day, hours, minutes, seconds, ms));
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Rule 2: Fallback to standard tag 52 (SendingTime) - YYYYMMDD-HH:mm:ss.sss
  tsStr = getTagValue(line, '52', customDelimiter);
  if (tsStr && tsStr.includes('-') && tsStr.includes(':')) {
    const [datePart, timePart] = tsStr.split('-');
    if (datePart && timePart && datePart.length === 8) {
      const year = parseInt(datePart.substring(0, 4), 10);
      const month = parseInt(datePart.substring(4, 6), 10) - 1;
      const day = parseInt(datePart.substring(6, 8), 10);
      const [h, m, s] = timePart.split(':');
      const date = new Date(Date.UTC(year, month, day, parseInt(h), parseInt(m), parseFloat(s)));
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Rule 3: Fallback for non-standard log prefixes e.g. [20240101-10:00:00.123]
  const match = line.match(/\[(\d{8}-\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\]/);
  if (match && match[1]) {
    tsStr = match[1];
    const [datePart, timePart] = tsStr.split('-');
    const year = parseInt(datePart.substring(0, 4), 10);
    const month = parseInt(datePart.substring(4, 6), 10) - 1;
    const day = parseInt(datePart.substring(6, 8), 10);
    const [hours, minutes, seconds] = timePart.split(':').map(part => parseFloat(part));
    const ms = timePart.includes('.') ? parseInt(timePart.split('.')[1], 10) : 0;
    const date = new Date(Date.UTC(year, month, day, hours, minutes, Math.floor(seconds), ms));
    if (!isNaN(date.getTime())) return date;
  }

  return new Date(0); // Return epoch if no valid timestamp is found
};

/**
 * Validates a single FIX message line.
 * Checks structure, checksum (modulo 256), and body length.
 */
export const validateFIXMessage = (rawMessage, customDelimiter) => {
  const line = rawMessage.trim();
  if (!line) return null;

  // Determine separator
  let sep = '\x01';
  let delim = customDelimiter || '';
  if (delim === 'SOH' || delim === '\\x01' || delim === '\\u0001') {
    sep = line.includes('\x01') ? '\x01' : (line.includes('\u0001') ? '\u0001' : '^A');
  } else if (delim && delim !== 'Auto') {
    sep = delim;
  } else {
    // Auto or fallback
    if (line.includes('\x01')) sep = '\x01';
    else if (line.includes('\u0001')) sep = '\u0001';
    else if (line.includes('|')) sep = '|';
    else if (line.includes('^A')) sep = '^A';
  }

  // Normalize delimiters to SOH (\x01) for strict standard checksum & length checks
  let normalized = line;
  if (sep !== '\x01') {
    if (sep === '^A') {
      normalized = line.replace(/\^A/g, '\x01');
    } else {
      normalized = line.split(sep).join('\x01');
    }
  }

  // Split into tag=value pairs
  const fields = normalized.split('\x01').filter(Boolean);
  const tagList = [];
  const parsedTags = {};

  fields.forEach((field) => {
    const eqIdx = field.indexOf('=');
    if (eqIdx !== -1) {
      const tag = field.substring(0, eqIdx).trim();
      const val = field.substring(eqIdx + 1);
      tagList.push({ tag, val, name: getTagName(tag) || `CustomTag_${tag}`, meaning: getValueMeaning(tag, val) || val });
      parsedTags[tag] = val;
    }
  });

  const errors = [];
  const warnings = [];

  if (tagList.length < 4) {
    errors.push("Message structure is too short to be a valid FIX message.");
    return { isValid: false, errors, warnings, tags: parsedTags, tagList, separator: sep };
  }

  // Header Validation rules
  if (tagList[0].tag !== '8') {
    errors.push("Invalid structure: BeginString (tag 8) must be the first field.");
  }
  if (tagList[1].tag !== '9') {
    errors.push("Invalid structure: BodyLength (tag 9) must be the second field.");
  }
  if (tagList[2].tag !== '35') {
    warnings.push("Structure warning: MsgType (tag 35) is not the third field.");
  }
  if (tagList[tagList.length - 1].tag !== '10') {
    errors.push("Invalid structure: CheckSum (tag 10) must be the final field.");
  }

  // Checksum calculation
  const checksumField = tagList.find(t => t.tag === '10');
  let calculatedChecksumStr = '';
  if (checksumField) {
    const expectedChecksumStr = checksumField.val;
    const tenIdx = normalized.indexOf('10=');
    if (tenIdx !== -1) {
      const dataToCalculate = normalized.substring(0, tenIdx);
      let sum = 0;
      for (let i = 0; i < dataToCalculate.length; i++) {
        sum += dataToCalculate.charCodeAt(i);
      }
      const calculatedChecksum = sum % 260; // Wait: standard is % 256! Let's check % 256.
      const standardCalculated = sum % 256;
      calculatedChecksumStr = standardCalculated.toString().padStart(3, '0');

      if (calculatedChecksumStr !== expectedChecksumStr) {
        errors.push(`Checksum mismatch: Header claims ${expectedChecksumStr}, calculated ${calculatedChecksumStr}.`);
      }
    }
  }

  // Body length calculation
  const bodyLengthField = tagList.find(t => t.tag === '9');
  let calculatedLength = -1;
  if (bodyLengthField) {
    const expectedLength = parseInt(bodyLengthField.val, 10);
    const nineIdx = normalized.indexOf('9=');
    const tenIdx = normalized.indexOf('10=');
    if (nineIdx !== -1 && tenIdx !== -1) {
      const valStart = normalized.indexOf('\x01', nineIdx) + 1; // position directly after the SOH ending the 9=xx field
      const bodyLengthData = normalized.substring(valStart, tenIdx);
      calculatedLength = bodyLengthData.length;

      if (calculatedLength !== expectedLength) {
        errors.push(`BodyLength mismatch: Header claims ${expectedLength}, calculated ${calculatedLength}.`);
      }
    }
  }

  const msgType = parsedTags['35'];
  const msgTypeName = FIX_VALUES['35']?.[msgType] || 'Unknown Message Type';

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    tags: parsedTags,
    tagList,
    separator: sep,
    msgType,
    msgTypeName,
    clOrdID: parsedTags['11'] || '',
    senderCompID: parsedTags['49'] || '',
    targetCompID: parsedTags['56'] || '',
    sendingTime: parsedTags['52'] || '',
    customTimestamp: parsedTags['90052'] || '',
    msgSeqNum: parsedTags['34'] || '',
    checksum: parsedTags['10'] || '',
    calculatedChecksum: calculatedChecksumStr,
    bodyLength: parsedTags['9'] || '',
    calculatedBodyLength: calculatedLength >= 0 ? calculatedLength : null
  };
};
