import { NextResponse } from "next/server";
import { FIX_TAGS, FIX_VALUES } from "@/lib/fixTags";
import { validateFIXMessage } from "@/lib/fixParser";
import yahooFinance from 'yahoo-finance2';
import fix40 from "@/data/FIX/FIX40.json";
import fix41 from "@/data/FIX/FIX41.json";
import fix42 from "@/data/FIX/FIX42.json";
import fix43 from "@/data/FIX/FIX43.json";
import fix44 from "@/data/FIX/FIX44.json";
import fix50 from "@/data/FIX/FIX50.json";
import fixt11 from "@/data/FIX/FIXT11.json";
import fixDescription from "@/data/fix-description.json";

const FIX_SPECS = {
  "FIX.4.0": fix40,
  "FIX.4.1": fix41,
  "FIX.4.2": fix42,
  "FIX.4.3": fix43,
  "FIX.4.4": fix44,
  "FIX.5.0": fix50,
  "FIXT.1.1": fixt11
};

const GREETING_WORDS = new Set(["hi", "hello", "hey", "hola", "yo", "greetings", "good morning", "good afternoon", "good evening", "welcome"]);

function isGreeting(query) {
  const normalized = query.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  if (GREETING_WORDS.has(normalized)) return true;
  
  const parts = normalized.split(/\s+/);
  if (parts.length === 2 && GREETING_WORDS.has(parts[0]) && parts[1] === "aura") {
    return true;
  }
  return false;
}

function getTagDescription(tagNum) {
  if (fixDescription && Array.isArray(fixDescription.FIX_Tags_Description)) {
    const found = fixDescription.FIX_Tags_Description.find(d => String(d.tag) === String(tagNum));
    if (found) {
      return {
        description: found.description,
        note: found.note
      };
    }
  }
  return null;
}

function formatTimeFIX(date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(2, '0').padEnd(3, '0');
  return `${yyyy}${mm}${dd}-${hh}:${min}:${ss}.${ms}`;
}

function generateResponsePayload(parsed) {
  if (!parsed || !parsed.tags) return null;
  
  const tags = parsed.tags;
  const beginString = tags['8'] || 'FIX.4.2';
  const msgType = tags['35'];
  const sender = tags['49'] || 'SENDER';
  const target = tags['56'] || 'TARGET';
  
  // Flip sender and target for response
  const respSender = target;
  const respTarget = sender;
  
  const sep = parsed.separator || '|';
  const responseFields = [];
  
  // Determine Response MsgType
  let respMsgType = null;
  let explanation = '';
  
  if (msgType === 'A') { // Logon
    respMsgType = 'A';
    explanation = 'In the FIX session protocol, an incoming Logon (35=A) requires an immediate Logon (35=A) response back to confirm session establishment.';
    responseFields.push({ tag: '98', val: '0' }); // EncryptMethod=None
    responseFields.push({ tag: '108', val: tags['108'] || '30' }); // HeartBtInt
  } 
  else if (msgType === '1') { // Test Request
    respMsgType = '0';
    explanation = 'An incoming Test Request (35=1) requires a Heartbeat (35=0) response containing the matching TestReqID (Tag 112) to confirm link status.';
    responseFields.push({ tag: '112', val: tags['112'] || 'TEST_REQ' });
  } 
  else if (msgType === '2') { // Resend Request
    respMsgType = '4';
    explanation = 'An incoming Resend Request (35=2) can be answered with a Sequence Reset (35=4) (with GapFillFlag=Y) to skip administrative messages or sequence gaps.';
    responseFields.push({ tag: '123', val: 'Y' }); // GapFill
    const beginSeq = parseInt(tags['7'] || '1', 10);
    const endSeq = parseInt(tags['16'] || '1', 10);
    responseFields.push({ tag: '36', val: String(endSeq > 0 ? endSeq + 1 : beginSeq + 5) }); // NewSeqNo
  } 
  else if (msgType === 'D') { // New Order Single
    respMsgType = '8';
    explanation = 'A New Order Single (35=D) is processed by the execution engine, which responds with an Execution Report (35=8) confirming the order status as New (OrdStatus 39=0).';
    responseFields.push({ tag: '37', val: 'ORD_' + Math.floor(100000 + Math.random() * 900000) }); // OrderID
    responseFields.push({ tag: '11', val: tags['11'] || 'CLORD_NEW' }); // ClOrdID
    responseFields.push({ tag: '17', val: 'EXEC_' + Math.floor(100000 + Math.random() * 900000) }); // ExecID
    responseFields.push({ tag: '150', val: '0' }); // ExecType = New
    responseFields.push({ tag: '39', val: '0' }); // OrdStatus = New
    if (tags['55']) responseFields.push({ tag: '55', val: tags['55'] }); // Symbol
    if (tags['54']) responseFields.push({ tag: '54', val: tags['54'] }); // Side
    if (tags['38']) responseFields.push({ tag: '38', val: tags['38'] }); // OrderQty
    if (tags['44']) responseFields.push({ tag: '44', val: tags['44'] }); // Price
    if (tags['15']) responseFields.push({ tag: '15', val: tags['15'] }); // Currency
    responseFields.push({ tag: '151', val: tags['38'] || '100' }); // LeavesQty
    responseFields.push({ tag: '14', val: '0' }); // CumQty
    responseFields.push({ tag: '6', val: tags['44'] || '0.00' }); // AvgPx
    responseFields.push({ tag: '60', val: formatTimeFIX(new Date()) }); // TransactTime
  } 
  else if (msgType === 'F') { // Order Cancel Request
    respMsgType = '8';
    explanation = 'An Order Cancel Request (35=F) is acknowledged with an Execution Report (35=8) indicating the order has been successfully Canceled (OrdStatus 39=4).';
    responseFields.push({ tag: '37', val: 'ORD_' + Math.floor(100000 + Math.random() * 900000) }); // OrderID
    responseFields.push({ tag: '11', val: tags['11'] || 'CLORD_CANCEL' }); // ClOrdID
    responseFields.push({ tag: '41', val: tags['41'] || 'CLORD_ORIG' }); // OrigClOrdID
    responseFields.push({ tag: '17', val: 'EXEC_' + Math.floor(100000 + Math.random() * 900000) }); // ExecID
    responseFields.push({ tag: '150', val: '4' }); // ExecType = Canceled
    responseFields.push({ tag: '39', val: '4' }); // OrdStatus = Canceled
    if (tags['55']) responseFields.push({ tag: '55', val: tags['55'] }); // Symbol
    if (tags['54']) responseFields.push({ tag: '54', val: tags['54'] }); // Side
    if (tags['38']) responseFields.push({ tag: '38', val: tags['38'] }); // OrderQty
    responseFields.push({ tag: '151', val: '0' }); // LeavesQty
    responseFields.push({ tag: '14', val: tags['38'] || '100' }); // CumQty
    responseFields.push({ tag: '6', val: '0.00' }); // AvgPx
    responseFields.push({ tag: '60', val: formatTimeFIX(new Date()) }); // TransactTime
  } 
  else if (msgType === 'G') { // Order Cancel/Replace Request
    respMsgType = '8';
    explanation = 'An Order Cancel/Replace Request (35=G) is acknowledged with an Execution Report (35=8) confirming the order has been Replaced (OrdStatus 39=5).';
    responseFields.push({ tag: '37', val: 'ORD_' + Math.floor(100000 + Math.random() * 900000) }); // OrderID
    responseFields.push({ tag: '11', val: tags['11'] || 'CLORD_REPLACE' }); // ClOrdID
    responseFields.push({ tag: '41', val: tags['41'] || 'CLORD_ORIG' }); // OrigClOrdID
    responseFields.push({ tag: '17', val: 'EXEC_' + Math.floor(100000 + Math.random() * 900000) }); // ExecID
    responseFields.push({ tag: '150', val: '5' }); // ExecType = Replaced
    responseFields.push({ tag: '39', val: '5' }); // OrdStatus = Replaced
    if (tags['55']) responseFields.push({ tag: '55', val: tags['55'] }); // Symbol
    if (tags['54']) responseFields.push({ tag: '54', val: tags['54'] }); // Side
    if (tags['38']) responseFields.push({ tag: '38', val: tags['38'] }); // OrderQty
    if (tags['44']) responseFields.push({ tag: '44', val: tags['44'] }); // Price
    responseFields.push({ tag: '151', val: tags['38'] || '100' }); // LeavesQty
    responseFields.push({ tag: '14', val: '0' }); // CumQty
    responseFields.push({ tag: '6', val: tags['44'] || '0.00' }); // AvgPx
    responseFields.push({ tag: '60', val: formatTimeFIX(new Date()) }); // TransactTime
  }
  
  if (!respMsgType) return null;
  
  // Swap OnBehalfOfCompID (115) and DeliverToCompID (128)
  if (tags['115']) {
    responseFields.push({ tag: '128', val: tags['115'] });
  }
  if (tags['128']) {
    responseFields.push({ tag: '115', val: tags['128'] });
  }
  
  // Assemble headers
  const headerFields = [
    { tag: '35', val: respMsgType },
    { tag: '49', val: respSender },
    { tag: '56', val: respTarget }
  ];
  
  const seqNum = parseInt(tags['34'] || '0', 10);
  headerFields.push({ tag: '34', val: String(seqNum > 0 ? seqNum + 1 : 1) });
  headerFields.push({ tag: '52', val: formatTimeFIX(new Date()) });
  
  const allBodyFields = [...headerFields, ...responseFields];
  
  // Calculate body length
  const bodyText = allBodyFields.map(f => `${f.tag}=${f.val}`).join(sep) + sep;
  const bodyLength = bodyText.length;
  
  const fullMessageUpToTen = `8=${beginString}${sep}9=${bodyLength}${sep}${bodyText}`;
  
  // Calculate Checksum
  const standardDelimited = fullMessageUpToTen.split(sep).join('\x01');
  let sum = 0;
  for (let i = 0; i < standardDelimited.length; i++) {
    sum += standardDelimited.charCodeAt(i);
  }
  const checksumVal = (sum % 256).toString().padStart(3, '0');
  
  const rawResponse = `${fullMessageUpToTen}10=${checksumVal}${sep}`;
  
  return {
    rawResponse,
    explanation,
    respMsgTypeName: FIX_VALUES['35']?.[respMsgType] || respMsgType
  };
}

function analyzeSessionRouting(parsed) {
  if (!parsed || !parsed.tags) return null;
  const tags = parsed.tags;
  const sender = tags['49'];
  const target = tags['56'];
  
  if (!sender && !target) return null;
  
  let analysis = `### Session Routing Analysis\n`;
  if (sender) analysis += `- **SenderCompID (49)**: \`${sender}\`\n`;
  if (target) analysis += `- **TargetCompID (56)**: \`${target}\`\n`;
  
  if (sender && target) {
    if (sender === target) {
      analysis += `- **[Warning] Routing Validation Error**: \`SenderCompID\` and \`TargetCompID\` are identical (\`${sender}\`). A sender cannot send a message to itself in a standard FIX session routing configuration.\n`;
    } else {
      analysis += `- **Direction**: Message is routing from **${sender}** to **${target}**.\n`;
    }
  } else {
    analysis += `- **[Warning] Missing Routing Field**: Both session routing fields (49 & 56) are recommended to establish standard sequence and session tracking context.\n`;
  }
  
  // Third-party routing tags 115 and 128
  const onBehalfOf = tags['115'];
  const deliverTo = tags['128'];
  if (onBehalfOf) {
    analysis += `- **OnBehalfOfCompID (115)**: \`${onBehalfOf}\` *(Indicates this message is being sent on behalf of third-party firm ${onBehalfOf})*\n`;
  }
  if (deliverTo) {
    analysis += `- **DeliverToCompID (128)**: \`${deliverTo}\` *(Indicates this message is intended to be delivered to third-party firm ${deliverTo} via an intermediary)*\n`;
  }
  
  // SubIDs or LocationIDs
  const senderSub = tags['50'];
  const targetSub = tags['57'];
  if (senderSub) analysis += `- **SenderSubID (50)**: \`${senderSub}\` *(Sub-routing identifier for the sending entity)*\n`;
  if (targetSub) analysis += `- **TargetSubID (57)**: \`${targetSub}\` *(Sub-routing identifier for the target entity)*\n`;
  
  const senderLoc = tags['142'];
  const targetLoc = tags['143'];
  if (senderLoc) analysis += `- **SenderLocationID (142)**: \`${senderLoc}\`\n`;
  if (targetLoc) analysis += `- **TargetLocationID (143)**: \`${targetLoc}\`\n`;
  
  return analysis;
}

function detectVersion(queryText) {
  const q = queryText.toUpperCase();
  if (q.includes("FIX 4.0") || q.includes("FIX.4.0") || q.includes("FIX40")) return "FIX.4.0";
  if (q.includes("FIX 4.1") || q.includes("FIX.4.1") || q.includes("FIX41")) return "FIX.4.1";
  if (q.includes("FIX 4.2") || q.includes("FIX.4.2") || q.includes("FIX42")) return "FIX.4.2";
  if (q.includes("FIX 4.3") || q.includes("FIX.4.3") || q.includes("FIX43")) return "FIX.4.3";
  if (q.includes("FIX 4.4") || q.includes("FIX.4.4") || q.includes("FIX44")) return "FIX.4.4";
  if (q.includes("FIX 5.0") || q.includes("FIX.5.0") || q.includes("FIX50")) return "FIX.5.0";
  if (q.includes("FIXT 1.1") || q.includes("FIXT.1.1") || q.includes("FIXT1.1") || q.includes("FIXT11")) return "FIXT.1.1";
  
  // Regex match for arbitrary versions like FIX 4.3 or FIX 5.2 or FIX4.3
  const match = q.match(/FIX(?:T)?\.?\s*(\d)\.?\s*(\d)/i);
  if (match) {
    return `FIX.${match[1]}.${match[2]}`;
  }
  return null;
}

function tryMessageSchemaLookup(queryText) {
  const q = queryText.toLowerCase();
  const detectedVer = detectVersion(queryText) || "FIX.4.4";
  const spec = FIX_SPECS[detectedVer];
  if (!spec || !Array.isArray(spec.messages)) return null;
  
  let matchedMsg = null;
  for (const msg of spec.messages) {
    const msgTypeLower = msg.msgtype.toLowerCase();
    const msgNameSpaced = msg.name.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    
    const msgTypePattern = new RegExp(`(?:msgtype|35)\\s*=\\s*${msgTypeLower}\\b`, 'i');
    const namePattern = new RegExp(`\\b${msgNameSpaced.replace(/\s+/g, '\\s*')}\\b`, 'i');
    
    if (msgTypePattern.test(q)) {
      matchedMsg = msg;
      break;
    }
    
    if (namePattern.test(q)) {
      matchedMsg = msg;
    }
  }
  
  if (!matchedMsg) return null;
  
  let fieldsList = "";
  if (Array.isArray(matchedMsg.fields)) {
    fieldsList = matchedMsg.fields.map(f => {
      const specField = spec.fields?.find(sf => String(sf.tag) === String(f.tag));
      const typeStr = specField ? ` (${specField.type})` : "";
      const reqStr = f.required ? "**Required**" : "Optional";
      return `- **Tag ${f.tag} (${f.name})**${typeStr}: ${reqStr}`;
    }).join('\n');
  }
  
  return `### Message Schema: ${matchedMsg.name} (MsgType 35=${matchedMsg.msgtype}) [${detectedVer}]\n` +
    `*Category: ${matchedMsg.category || 'N/A'}*\n\n` +
    `## Message Fields:\n` +
    fieldsList + `\n\n` +
    `*This schema contains field definitions specifically for the ${detectedVer} protocol version.*`;
}

// Check if message is a FIX message (supports single or multi-line)
function looksLikeFIX(input) {
  if (!input) return false;
  return input.split("\n").some(line => /^8=FIX\./.test(line.trim()));
}

function auditMultiMessageStream(lines) {
  const parsedMessages = [];
  const errors = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parsed = validateFIXMessage(line);
    if (parsed) {
      parsedMessages.push(parsed);
    } else {
      errors.push(`Line ${i + 1}: Failed to parse FIX message structure.`);
    }
  }

  if (parsedMessages.length === 0) {
    return {
      answer: `### Multi-Message Audit Results\n\nFailed to parse any valid FIX messages in the stream.`,
      table: null
    };
  }

  // 1. Determine Sender/Target roles for sequence diagram
  const leftNode = parsedMessages[0].tags['49'] || 'CLIENT';
  const rightNode = parsedMessages[0].tags['56'] || 'BROKER';

  // 2. Perform sequence validation
  const seqWarnings = [];
  const seqs = parsedMessages.map(m => ({
    num: parseInt(m.tags['34'], 10),
    msgType: m.tags['35'],
    msgTypeName: m.msgTypeName
  })).filter(s => !isNaN(s.num));

  // Check logon first message
  if (parsedMessages[0].tags['35'] !== 'A') {
    seqWarnings.push(`- ⚠️ **First message is not Logon (35=A)**: Session establishment should precede application messages. Found message type \`${parsedMessages[0].tags['35']}\` (${parsedMessages[0].msgTypeName}) instead.`);
  }

  // Check sequence numbers
  for (let i = 0; i < seqs.length; i++) {
    const curr = seqs[i];
    
    // Check duplicates
    const duplicates = seqs.filter(s => s.num === curr.num);
    const firstIndex = seqs.findIndex(s => s.num === curr.num);
    if (duplicates.length > 1 && i === firstIndex) {
      seqWarnings.push(`- ⚠️ **Duplicate MsgSeqNum (${curr.num}) detected**: Ensure Tag \`43\` (PossDupFlag) is set to 'Y' if this is a retransmitted duplicate, otherwise this constitutes a session violation.`);
    }
    
    // Check gap with previous sequence
    if (i > 0) {
      const prev = seqs[i - 1];
      if (curr.num > prev.num + 1) {
        const gapStart = prev.num + 1;
        const gapEnd = curr.num - 1;
        const range = gapStart === gapEnd ? `${gapStart}` : `${gapStart}-${gapEnd}`;
        seqWarnings.push(`- ⚠️ **Sequence Gap Detected**: Gap between MsgSeqNum \`${prev.num}\` and \`${curr.num}\`. Expected the counterparty to issue a **Resend Request (35=2)** for sequence range \`${range}\`.`);
      }
    }
  }

  // Check integrity checks
  const integrityWarnings = [];
  parsedMessages.forEach((m, idx) => {
    if (!m.isValid) {
      integrityWarnings.push(`- Line ${idx + 1} (${m.msgTypeName}): ${m.errors.join('; ')}`);
    }
  });

  // 3. Construct Visual Flowchart
  let diagram = `### Visual Session Sequence Flow\n\n`;
  diagram += `\`\`\`text\n`;
  
  const leftPad = leftNode.padEnd(12, ' ');
  const rightPad = rightNode.padStart(12, ' ');
  diagram += `   ${leftPad}                ${rightPad}\n`;
  diagram += `        │                            │\n`;

  parsedMessages.forEach((m) => {
    const seq = m.tags['34'] || '?';
    const type = m.tags['35'] || '?';
    const name = m.msgTypeName || 'Message';
    const sender = m.tags['49'] || 'UNKNOWN';
    const target = m.tags['56'] || 'UNKNOWN';
    const isIntegrityPassed = m.isValid;
    const statusLabel = isIntegrityPassed ? '✓' : '✗';

    const msgLabel = `${name} (35=${type}) Seq:${seq} [${statusLabel}]`;

    if (sender === leftNode) {
      const arrowBody = `─── ${msgLabel} ───>`;
      diagram += `        │${arrowBody.padEnd(28, '─')}│\n`;
    } else if (sender === rightNode) {
      const arrowBody = `<─── ${msgLabel} ───`;
      diagram += `        │${arrowBody.padStart(28, '─')}│\n`;
    } else {
      const arrowBody = `─── ${msgLabel} ───`;
      diagram += `  (${sender} ➔ ${target}):\n`;
      diagram += `        │${arrowBody.padEnd(28, '─')}│\n`;
    }
    diagram += `        │                            │\n`;
  });
  
  diagram += `        ▼                            ▼\n`;
  diagram += `\`\`\`\n`;

  let summary = `### Multi-Message Session Log Audit Results\n`;
  summary += `- **Total Messages parsed**: ${parsedMessages.length}\n`;
  summary += `- **Session Senders**: \`${leftNode}\` ➔ \`${rightNode}\`\n\n`;
  
  if (seqWarnings.length > 0) {
    summary += `## Session & Sequence Diagnostics\n`;
    summary += seqWarnings.join('\n') + `\n\n`;
  } else {
    summary += `## Session & Sequence Diagnostics\n`;
    summary += `✓ All parsed sequence numbers are sequential and Logon flow order is correct.\n\n`;
  }

  if (integrityWarnings.length > 0) {
    summary += `## Message Integrity Diagnostics\n`;
    summary += integrityWarnings.join('\n') + `\n\n`;
  } else {
    summary += `## Message Integrity Diagnostics\n`;
    summary += `✓ All message BodyLengths and Checksums are structurally valid.\n\n`;
  }

  summary += diagram;
  
  const table = parsedMessages.map((m, idx) => [
    `Msg #${idx + 1} (Seq:${m.tags['34'] || '?'})`,
    m.tags['35'] || '?',
    m.msgTypeName || 'Unknown',
    m.isValid ? 'Valid' : 'Invalid'
  ]);

  return {
    answer: summary + `\n\n*Response resolved by AURA (Offline log stream audit).*`,
    table: table
  };
}

// Fetch market data via yfinance for context
async function getMarketData(symbol) {
  try {
    const quote = await yahooFinance.quote(symbol);
    return quote?.regularMarketPrice 
      ? `Market Quote: Current Price of ${symbol} is ${quote.regularMarketPrice} ${quote.currency || 'USD'}.`
      : "";
  } catch {
    return "";
  }
}

// Direct REST API call to Google Gemini 2.5 Flash
async function queryGemini(prompt, apiKey, systemInstruction = "") {
  if (!apiKey) {
    return {
      answer: "[Warning] Gemini API key not found.",
      connected: false
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        answer: `[Warning] Gemini API request failed: ${errorData.error?.message || res.statusText}`,
        connected: false
      };
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    return {
      answer: candidateText || "[Warning] Model returned empty response.",
      connected: true
    };
  } catch (err) {
    return {
      answer: `[Warning] Failed to reach Gemini servers: ${err.message}`,
      connected: false
    };
  }
}

const FIX_GUIDES = {
  "tag 43": `**Tag 43 (PossDupFlag) Rules & Requirements**

Tag 43 (PossDupFlag) is a standard header field used to flag potential duplicate transmissions.

- **When it is required/used**:
  - Must be set to \`Y\` when resending a message with a sequence number that has already been sent (e.g., in response to a **Resend Request (35=2)** or when re-transmitting due to suspected connection issues).
  - Failing to set Tag 43 to \`Y\` on a repeated sequence number will cause the receiver to reject the session due to a duplicate sequence error (Out of Sequence).
- **Conditional Requirement**:
  - When Tag 43 is set to \`Y\`, **Tag 122 (OrigSendingTime)** becomes **strictly required** by the FIX protocol standard to indicate the timestamp of the original transmission.
  - Tag 52 (SendingTime) should contain the timestamp of the current retransmission.`,

  "possdupflag": `**Tag 43 (PossDupFlag) Rules & Requirements**

Tag 43 (PossDupFlag) is a standard header field used to flag potential duplicate transmissions.

- **When it is required/used**:
  - Must be set to \`Y\` when resending a message with a sequence number that has already been sent (e.g., in response to a **Resend Request (35=2)** or when re-transmitting due to suspected connection issues).
  - Failing to set Tag 43 to \`Y\` on a repeated sequence number will cause the receiver to reject the session due to a duplicate sequence error (Out of Sequence).
- **Conditional Requirement**:
  - When Tag 43 is set to \`Y\`, **Tag 122 (OrigSendingTime)** becomes **strictly required** by the FIX protocol standard to indicate the timestamp of the original transmission.
  - Tag 52 (SendingTime) should contain the timestamp of the current retransmission.`,

  "possdup": `**Tag 43 (PossDupFlag) Rules & Requirements**

Tag 43 (PossDupFlag) is a standard header field used to flag potential duplicate transmissions.

- **When it is required/used**:
  - Must be set to \`Y\` when resending a message with a sequence number that has already been sent (e.g., in response to a **Resend Request (35=2)** or when re-transmitting due to suspected connection issues).
  - Failing to set Tag 43 to \`Y\` on a repeated sequence number will cause the receiver to reject the session due to a duplicate sequence error (Out of Sequence).
- **Conditional Requirement**:
  - When Tag 43 is set to \`Y\`, **Tag 122 (OrigSendingTime)** becomes **strictly required** by the FIX protocol standard to indicate the timestamp of the original transmission.
  - Tag 52 (SendingTime) should contain the timestamp of the current retransmission.`,

  "custom fields": `**Custom Fields in the FIX Protocol**

Under the FIX protocol, custom tags (also known as User-Defined Fields or UDFs) are used to transmit proprietary business data that is not part of the standard FIX specification.

- **Reserved Tag Range**: Tags **5000 to 9999** are officially reserved for user-defined custom fields. (Some platforms or engines also support ranges like 10000+).
- **Structure**: Custom fields follow the standard key-value format (e.g., \`5001=Value\`).
- **Data Dictionary**: Since they are custom, standard FIX parsers will not recognize them out of the box. You must define them in your engine's XML Data Dictionary (e.g., QuickFIX XML schema) so that the engine knows their data type, valid values, and validation rules.`,

  "custom tags": `**Custom Tags in the FIX Protocol**

Under the FIX protocol, custom tags (also known as User-Defined Fields or UDFs) are used to transmit proprietary business data that is not part of the standard FIX specification.

- **Reserved Tag Range**: Tags **5000 to 9999** are officially reserved for user-defined custom fields. (Some platforms or engines also support ranges like 10000+).
- **Structure**: Custom fields follow the standard key-value format (e.g., \`5001=Value\`).
- **Data Dictionary**: Since they are custom, standard FIX parsers will not recognize them out of the box. You must define them in your engine's XML Data Dictionary (e.g., QuickFIX XML schema) so that the engine knows their data type, valid values, and validation rules.`,

  "upload a quickfix xml": `**Uploading a QuickFIX XML Data Dictionary**

In FIXify, you can upload a custom QuickFIX XML Data Dictionary to define proprietary custom tags, messages, and enum values.

1. **Navigate to the Tags Reference Page** (click on **Tags** or **Tags Reference** in the top navigation bar, or go to \`/fixtags\`).
2. **Select your XML Data Dictionary file** (typically has a \`.xml\` extension, such as \`FIX44.xml\` or custom specifications).
3. **Upload or drag-and-drop** the file into the upload zone on the Tags Reference page.
4. **Parsing**: The platform will parse the message types, custom fields, components, and enum values automatically.
5. **Usage**: Once loaded, all other pages (such as the Logs Processor, Interactive Payload Mutator, and Chat Interpreter) will automatically resolve your custom tags and display their names and enum meanings instead of just showing raw numbers.`,

  "xml data dictionary": `**QuickFIX XML Data Dictionaries in FIXify**

In FIXify, you can upload a custom QuickFIX XML Data Dictionary to define proprietary custom tags, messages, and enum values.

1. **Navigate to the Tags Reference Page** (click on **Tags** or **Tags Reference** in the top navigation bar, or go to \`/fixtags\`).
2. **Select your XML Data Dictionary file** (typically has a \`.xml\` extension, such as \`FIX44.xml\` or custom specifications).
3. **Upload or drag-and-drop** the file into the upload zone on the Tags Reference page.
4. **Parsing**: The platform will parse the message types, custom fields, components, and enum values automatically.
5. **Usage**: Once loaded, all other pages (such as the Logs Processor, Interactive Payload Mutator, and Chat Interpreter) will automatically resolve your custom tags and display their names and enum meanings instead of just showing raw numbers.`,

  "where are custom tags defined": `**Where Custom Tags are Defined**

1. **Protocol Level**: User-defined custom tags are specified in the range **5000 to 9999** by the FIX Protocol standard.
2. **Data Dictionary**: In practice, custom tags are defined in a **QuickFIX XML Data Dictionary** (or equivalent XML schema file) used by the FIX engine.
3. **In FIXify**: You can define and upload custom tags by going to the **Tags Reference** page (\`/fixtags\`) and uploading your custom XML data dictionary. Once uploaded, the custom tags will be stored in your browser's local storage and resolved across all tools in FIXify.`,

  "when should sequence reset": `**When Sequence Reset (35=4) should be sent**

A Sequence Reset (35=4) message is used to recover from sequence gaps or to reset sequence numbers. There are two modes:

1. **Gap Fill Mode (GapFillFlag 123=Y)**:
   - **When to send**: In response to a **Resend Request (35=2)**, when the sender wants to skip transmitting administrative messages (like Heartbeats, Test Requests, or Logons) or stale application messages (like old market data).
   - **SeqNum**: Sent with the next expected sequence number in the session sequence.
   - **NewSeqNo (Tag 36)**: Tells the receiver the next sequence number to expect after skipping the gap.

2. **Reset Mode (GapFillFlag 123=N or absent)**:
   - **When to send**: Used to recover from unrecoverable sequence discrepancies or to establish a new baseline (e.g., start of day, or after manual database intervention).
   - **NewSeqNo (Tag 36)**: Tells the receiver to immediately set their expected sequence number to the new value.`,

  "35=4": `**Sequence Reset Message (MsgType 35=4)**

A Sequence Reset (35=4) message is used to recover from sequence gaps or to reset sequence numbers. There are two modes:

1. **Gap Fill Mode (GapFillFlag 123=Y)**:
   - **When to send**: In response to a **Resend Request (35=2)**, when the sender wants to skip transmitting administrative messages (like Heartbeats, Test Requests, or Logons) or stale application messages (like old market data).
   - **SeqNum**: Sent with the next expected sequence number in the session sequence.
   - **NewSeqNo (Tag 36)**: Tells the receiver the next sequence number to expect after skipping the gap.

2. **Reset Mode (GapFillFlag 123=N or absent)**:
   - **When to send**: Used to recover from unrecoverable sequence discrepancies or to establish a new baseline (e.g., start of day, or after manual database intervention).
   - **NewSeqNo (Tag 36)**: Tells the receiver to immediately set their expected sequence number to the new value.`,

  "dialect enums": `**Standard vs. Custom Dialect Enums in FIX**

- **Standard Enums**: Pre-defined by the official FIX specification (e.g., Tag 40 \`2=Limit\`, \`1=Market\`; Tag 54 \`1=Buy\`, \`2=Sell\`).
- **Custom Dialect Enums**: Proprietary values defined by a specific broker or exchange (e.g., Tag 9900 \`A=OptionSpecial\`, \`B=ComboSpecial\`).
- **Resolving Custom Enums in FIXify**: Upload your custom XML data dictionary under the **Tags Reference** page (\`/fixtags\`). The parser will read the custom fields and their corresponding enums, automatically resolving them in the message inspector panels instead of displaying raw codes.`,

  "standard vs custom": `**Standard vs. Custom Dialect Enums in FIX**

- **Standard Enums**: Pre-defined by the official FIX specification (e.g., Tag 40 \`2=Limit\`, \`1=Market\`; Tag 54 \`1=Buy\`, \`2=Sell\`).
- **Custom Dialect Enums**: Proprietary values defined by a specific broker or exchange (e.g., Tag 9900 \`A=OptionSpecial\`, \`B=ComboSpecial\`).
- **Resolving Custom Enums in FIXify**: Upload your custom XML data dictionary under the **Tags Reference** page (\`/fixtags\`). The parser will read the custom fields and their corresponding enums, automatically resolving them in the message inspector panels instead of displaying raw codes.`,

  "trading": `**Electronic Trading & FIX Routing**\n\nElectronic trading relies on FIX (Financial Information eXchange) messages to route orders and confirm executions in real-time.\n- **Order Entry**: A client sends a **New Order Single (35=D)** specifying the price (44), size (38), symbol (55), side (54), and order type (40).\n- **Execution Reports**: The exchange or broker responds with **Execution Reports (35=8)** representing order status changes (39) like New, Partially Filled, Filled, Canceled, or Rejected.\n- **Order Modification**: Clients can cancel or replace active orders via **Order Cancel Request (35=F)** and **Order Cancel/Replace Request (35=G)**.`,

  "logon": `**FIX Logon Session Flow (MsgType 35=A)**\n\nThe Logon message is transmitted by both the initiator (client) and acceptor (server) to establish a FIX session.\n- **Tag 98 (EncryptMethod)**: Encryption method (typically 0 = None / Plaintext).\n- **Tag 108 (HeartBtInt)**: Heartbeat interval in seconds (e.g., 30).\n- **Tag 141 (ResetSeqNumFlag)**: Reset sequence numbers to 1 if set to 'Y'.\n\n*Establish Session sequence:* \nInitiator --(35=A, Seq 1)--> Acceptor\nInitiator <--(35=A, Seq 1)-- Acceptor (Session Established)`,
  
  "heartbeat": `**FIX Heartbeat (MsgType 35=0)**\n\nHeartbeat messages are transmitted at the HeartBtInt interval during periods of inactivity to verify link connectivity.\n- If responding to a **Test Request (35=1)**, the Heartbeat must include the matching **TestReqID (Tag 112)** to verify sequence integrity.`,
  
  "sequence": `**FIX Sequence Reset / Sequence Gap Recovery (MsgType 35=4)**\n\nUsed to recover from missed message sequence gaps or skip past administrative messages.\n- **Tag 36 (NewSeqNo)**: The next expected MsgSeqNum.\n- **Tag 123 (GapFillFlag)**: \n  - \`Y\` (Gap Fill): Skip sequence numbers for administrative messages.\n  - \`N\` or absent (Reset): Hard sequence reset (forces sequence numbers to NewSeqNo).`,
  
  "checksum": `**FIX Checksum Calculation (Tag 10)**\n\nEvery standard FIX message must terminate with Tag 10 containing a 3-character checksum.\n- It is calculated by summing the binary ASCII values of all characters in the raw message up to (but excluding) the checksum field itself.\n- The sum is then modulo 256 and formatted as a 3-digit padded string (e.g., \`10=084\`).\n- Standard SOH delimiters (\\x01) are included in the checksum sum.`,
  
  "body": `**FIX BodyLength Calculation (Tag 9)**\n\nTag 9 represents the total length of the message body in bytes.\n- It is calculated by counting the number of characters starting immediately *after* the SOH delimiter of Tag 9 and ending immediately *before* the start of Tag 10 (Checksum).`,
  
  "resend": `**FIX Resend Request (MsgType 35=2)**\n\nSent when a sequence number gap is detected (e.g., incoming MsgSeqNum is higher than expected).\n- **Tag 7 (BeginSeqNo)**: The first sequence number requested.\n- **Tag 16 (EndSeqNo)**: The last sequence number requested (use 0 for infinity / all subsequent).`,

  "fix protocol": `**FIX (Financial Information eXchange) Protocol**\n\nThe FIX Protocol is an industry-standard, open-source electronic communications protocol developed for real-time exchange of securities transactions and market data.\nIt is widely used by buy-side and sell-side institutions, stock exchanges, brokers, and investment funds to automate electronic trading, order routing, and trade execution.\n\n- **Session Layer**: Manages logon (35=A), logout (35=5), heartbeats (35=0), sequence synchronization, and retransmissions.\n- **Application Layer**: Carries business data like New Order Single (35=D), Execution Report (35=8), and Order Cancel/Replace (35=G).`,
  
  "fix": `**FIX (Financial Information eXchange) Protocol**\n\nThe FIX Protocol is an industry-standard, open-source electronic communications protocol developed for real-time exchange of securities transactions and market data.\nIt is widely used by buy-side and sell-side institutions, stock exchanges, brokers, and investment funds to automate electronic trading, order routing, and trade execution.\n\n- **Session Layer**: Manages logon (35=A), logout (35=5), heartbeats (35=0), sequence synchronization, and retransmissions.\n- **Application Layer**: Carries business data like New Order Single (35=D), Execution Report (35=8), and Order Cancel/Replace (35=G).`,

  "futures": `**Futures (FUT) Trading in the FIX Protocol**

Futures are traded using standard New Order Single (35=D) and Execution Report (35=8) messages with specific contract metadata tags:
- **Product (Tag 460)**: Set to \`2\` (COMMODITY).
- **SecurityType (Tag 167)**: Set to \`FUT\` (Future).
- **SecurityExchange (Tag 207)**: Identifies the exchange (e.g., \`CME\`, \`ICE\`, \`EUREX\`).
- **MaturityMonthYear (Tag 200)**: Specifies the contract delivery month in format \`YYYYMM\` (e.g., \`202612\`).
- **MaturityDate (Tag 541)**: (FIX 4.4+) Complete expiration date in format \`YYYYMMDD\` (e.g., \`20261218\`).
- **ContractMultiplier (Tag 231)**: Specifies the multiplier used to determine the contract value (e.g., \`50\` for E-mini S&P 500).
- **MinPriceIncrement (Tag 969)**: Tick size/minimum price fluctuation (e.g. \`0.25\`).
- **Currency (Tag 15)**: Trading currency (e.g., \`USD\`).`,

  "future": `**Futures (FUT) Trading in the FIX Protocol**

Futures are traded using standard New Order Single (35=D) and Execution Report (35=8) messages with specific contract metadata tags:
- **Product (Tag 460)**: Set to \`2\` (COMMODITY).
- **SecurityType (Tag 167)**: Set to \`FUT\` (Future).
- **SecurityExchange (Tag 207)**: Identifies the exchange (e.g., \`CME\`, \`ICE\`, \`EUREX\`).
- **MaturityMonthYear (Tag 200)**: Specifies the contract delivery month in format \`YYYYMM\` (e.g., \`202612\`).
- **MaturityDate (Tag 541)**: (FIX 4.4+) Complete expiration date in format \`YYYYMMDD\` (e.g., \`20261218\`).
- **ContractMultiplier (Tag 231)**: Specifies the multiplier used to determine the contract value (e.g., \`50\` for E-mini S&P 500).
- **MinPriceIncrement (Tag 969)**: Tick size/minimum price fluctuation (e.g. \`0.25\`).
- **Currency (Tag 15)**: Trading currency (e.g., \`USD\`).`,

  "forex": `**Forex (FX) Spot and Forward Trading in the FIX Protocol**

Foreign Exchange (FX) trades are represented using specific currency pair formats and settlement values:
- **Product (Tag 460)**: Set to \`4\` (CURRENCY).
- **SecurityType (Tag 167)**: Set to \`FOR\` (Foreign Exchange Contract / Forward) or \`SPOT\` (Spot FX).
- **Symbol (Tag 55)**: Represents the currency pair (e.g., \`EUR/USD\` or \`EURUSD\`).
- **Currency (Tag 15)**: The base currency of the transaction (e.g., \`EUR\` in \`EUR/USD\`).
- **SettlCurrency (Tag 120)**: The counter/settlement currency (e.g., \`USD\` in \`EUR/USD\`).
- **SettlType (Tag 63)**: Settlement method/value date:
  - \`0\` = Regular / T+2 (Standard Spot)
  - \`1\` = Cash / Same Day
  - \`2\` = Next Day
  - \`C\` = FX Forward (Value Date is specified in SettlDate)
- **SettlDate (Tag 64)**: The value/settlement date of the spot or forward transaction (e.g., \`20260715\` in \`YYYYMMDD\` format).
- **OrderQty (Tag 38)**: The size of the transaction in the base currency (Tag 15).`,

  "swap": `**FX Swap Trading in the FIX Protocol**

An FX Swap consists of two legs (near leg and far leg) executed simultaneously.
- **Product (Tag 460)**: Set to \`4\` (CURRENCY).
- **SecurityType (Tag 167)**: Set to \`FXSWAP\`.
- **Symbol (Tag 55)**: The currency pair (e.g., \`EUR/USD\`).
- **Currency (Tag 15)**: Base currency of the swap.
- **Multi-leg representation (FIX 4.4+)**:
  - Traded using **New Order Multi-leg (35=AB)** and **Multileg Execution Report (35=ASE)**.
  - Or represented using **Leg Groups** (repeating group starting with Tag 555 - NoLegs):
    - **LegSymbol (Tag 600)**: Currency pair.
    - **LegSide (Tag 624)**: Side of this leg (e.g., near leg Sell, far leg Buy).
    - **LegOrderQty (Tag 685)**: Leg order size.
    - **LegSettlDate (Tag 588)**: Leg value date.
    - **LegPrice (Tag 566)**: Leg execution rate.
- **Legacy (Pre-FIX 4.4) FX Swaps**:
  - Often processed via New Order Single (35=D) with:
    - **OrderQty (Tag 38)**: Near leg quantity.
    - **OrderQty2 (Tag 192)**: Far leg quantity.
    - **SettlDate (Tag 64)**: Near leg value date.
    - **FutSettDate2 (Tag 193)**: Far leg value date.`,

  "forward": `**Forex (FX) Forward Trading in the FIX Protocol**

An FX Forward contract is an agreement to buy or sell a currency pair at a future date at an agreed rate.
- **Product (Tag 460)**: Set to \`4\` (CURRENCY).
- **SecurityType (Tag 167)**: Set to \`FOR\` (Foreign Exchange Contract / Forward).
- **Symbol (Tag 55)**: Represents the currency pair (e.g., \`GBP/USD\` or \`GBPUSD\`).
- **SettlType (Tag 63)**: Set to \`C\` (FX Forward) to specify a custom settlement date.
- **SettlDate (Tag 64)**: The forward value date in format \`YYYYMMDD\` (e.g., \`20261022\`).
- **Currency (Tag 15)**: Base currency (e.g., \`GBP\` in \`GBP/USD\`).
- **SettlCurrency (Tag 120)**: The counter currency (e.g., \`USD\`).`,

  "asset class": `**Asset Classes and Products in the FIX Protocol**

FIX supports multiple asset classes mapped using Tag 460 (Product) and Tag 167 (SecurityType):
- **Equities (Product 460 = 5)**:
  - **SecurityType (Tag 167)**: \`CS\` (Common Stock), \`PS\` (Preferred Stock), \`ADR\`.
  - Main tags: Tag 55 (Symbol), Tag 48 (SecurityID), Tag 22 (SecurityIDSource).
- **Futures & Options (Product 460 = 2 or 5)**:
  - **SecurityType (Tag 167)**: \`FUT\` (Future), \`OPT\` (Option), \`WAR\` (Warrant).
  - Main tags: Tag 200 (MaturityMonthYear), Tag 201 (PutOrCall: 0=Put, 1=Call), Tag 202 (StrikePrice).
- **FX / Foreign Exchange (Product 460 = 4)**:
  - **SecurityType (Tag 167)**: \`SPOT\`, \`FOR\` (Forward), \`FXSWAP\`.
  - Main tags: Tag 15 (Currency), Tag 120 (SettlCurrency), Tag 63 (SettlType), Tag 64 (SettlDate).
- **Fixed Income / Debt (Product 460 = 3, 6, 11)**:
  - **SecurityType (Tag 167)**: \`TBOND\` (Treasury Bond), \`CORP\` (Corporate Bond).
  - Main tags: Tag 223 (CouponRate), Tag 235 (YieldType), Tag 236 (Yield).`,

  "asset classes": `**Asset Classes and Products in the FIX Protocol**

FIX supports multiple asset classes mapped using Tag 460 (Product) and Tag 167 (SecurityType):
- **Equities (Product 460 = 5)**:
  - **SecurityType (Tag 167)**: \`CS\` (Common Stock), \`PS\` (Preferred Stock), \`ADR\`.
  - Main tags: Tag 55 (Symbol), Tag 48 (SecurityID), Tag 22 (SecurityIDSource).
- **Futures & Options (Product 460 = 2 or 5)**:
  - **SecurityType (Tag 167)**: \`FUT\` (Future), \`OPT\` (Option), \`WAR\` (Warrant).
  - Main tags: Tag 200 (MaturityMonthYear), Tag 201 (PutOrCall: 0=Put, 1=Call), Tag 202 (StrikePrice).
- **FX / Foreign Exchange (Product 460 = 4)**:
  - **SecurityType (Tag 167)**: \`SPOT\`, \`FOR\` (Forward), \`FXSWAP\`.
  - Main tags: Tag 15 (Currency), Tag 120 (SettlCurrency), Tag 63 (SettlType), Tag 64 (SettlDate).
- **Fixed Income / Debt (Product 460 = 3, 6, 11)**:
  - **SecurityType (Tag 167)**: \`TBOND\` (Treasury Bond), \`CORP\` (Corporate Bond).
  - Main tags: Tag 223 (CouponRate), Tag 235 (YieldType), Tag 236 (Yield).`
};

function generateLocalBreakdown(tagList) {
  let breakdown = "\n\n**Field Explanations**:\n";
  tagList.forEach(t => {
    breakdown += `- **Tag ${t.tag} (${t.name})**: ${t.val}`;
    if (t.meaning && String(t.meaning) !== String(t.val)) {
      breakdown += ` *(meaning: ${t.meaning})*`;
    }
    breakdown += "\n";
  });
  return breakdown;
}

function sanitizeQueryForNumbers(text) {
  if (!text) return "";
  // Remove FIX version strings like FIX.4.2, FIX 4.2, FIX42, FIXT.1.1, FIX50SP2
  let sanitized = text.replace(/(FIX|FIXT)\.?\s*\d+\.\d+(\s*SP\s*\d+)?/gi, "");
  sanitized = sanitized.replace(/(FIX|FIXT)\.?\s*\d{2}/gi, "");
  // Remove any remaining decimals (like 4.2 or 1.1) to avoid matching their components as tags
  sanitized = sanitized.replace(/\d+\.\d+/g, "");
  return sanitized;
}

function getClosestSpec(versionStr) {
  if (FIX_SPECS[versionStr]) {
    return { spec: FIX_SPECS[versionStr], actualVersion: versionStr, isExact: true };
  }
  // Fallbacks
  if (versionStr.startsWith("FIX.4.")) {
    return { spec: FIX_SPECS["FIX.4.4"], actualVersion: "FIX.4.4", fallbackFrom: versionStr };
  }
  if (versionStr.startsWith("FIX.5.")) {
    return { spec: FIX_SPECS["FIX.5.0"], actualVersion: "FIX.5.0", fallbackFrom: versionStr };
  }
  return { spec: FIX_SPECS["FIX.4.4"], actualVersion: "FIX.4.4", fallbackFrom: versionStr };
}

function lookupTagInSpec(tagNum, spec) {
  if (!spec || !Array.isArray(spec.fields)) return null;
  return spec.fields.find(f => String(f.tag) === String(tagNum));
}

function lookupFieldNameInSpec(fieldName, spec) {
  if (!spec || !Array.isArray(spec.fields)) return null;
  const lowerName = fieldName.toLowerCase();
  return spec.fields.find(f => f.name.toLowerCase() === lowerName);
}

function tryModelAwarenessLookup(queryText, hasApiKey) {
  const q = queryText.toLowerCase();
  
  const aboutAura = q.includes("what is aura") || 
                    q.includes("who is aura") || 
                    q.includes("tell me about aura") ||
                    q.includes("about the app") ||
                    (q.includes("who are you") && !q.includes("gemini")) ||
                    (q.includes("what are you") && !q.includes("gemini"));
                    
  const aboutModel = q.includes("what model") || 
                     q.includes("which model") || 
                     q.includes("what ai") || 
                     q.includes("model are you using") || 
                     q.includes("are you gemini") || 
                     q.includes("active model");

  if (aboutAura || aboutModel) {
    const activeModelName = hasApiKey ? "Google Gemini 2.5 Flash" : "AURA Offline Intelligence Engine";
    let text = `### Model Information\n` +
               `I am **AURA** (AUgmented Response Agent), your intelligent companion for FIX protocol diagnostics.\n\n` +
               `- **Current Active Engine**: **${activeModelName}**\n` +
               `- **How I work**:\n` +
               `  - **AURA (Offline)**: If no API key is provided, I run 100% locally in your browser using structured FIX schemas, validation rulebooks, and status translation tables. Your data never leaves your device.\n` +
               `  - **Gemini (Online)**: If a Gemini API key is configured in your settings, I utilize Google Gemini 2.5 Flash to answer complex questions, summarize logs, and simulate counterparties.\n\n`;
    
    if (hasApiKey) {
      text += `Since you have provided a Gemini API key, I am currently leveraging **Google Gemini 2.5 Flash** for richer explanations, but I still use AURA's local database for fast tag references.`;
    } else {
      text += `You are currently using **AURA** in offline mode. For more advanced AI explanations, you can configure a Gemini API key in the top-right Settings drawer.`;
    }
    
    return text;
  }
  
  return null;
}

// Local offline tag dictionary lookups
function tryLocalLookup(query, customDialect) {
  let q = query.trim();
  // Preprocess to split word-number transitions (e.g. tag44 -> tag 44, fix4.3 -> fix 4.3)
  q = q.replace(/([a-zA-Z])(\d)/g, "$1 $2").replace(/(\d)([a-zA-Z])/g, "$1 $2");
  
  const getCustomField = (tagOrName) => {
    if (customDialect && Array.isArray(customDialect.fields)) {
      const isTag = /^\d+$/.test(tagOrName);
      return customDialect.fields.find(f => 
        isTag ? String(f.tag) === String(tagOrName) : f.name.toLowerCase() === tagOrName.toLowerCase()
      );
    }
    return null;
  };

  const detectedVer = detectVersion(q);
  let specInfo = null;
  if (detectedVer) {
    specInfo = getClosestSpec(detectedVer);
  }
  
  // 1. Tag-Value pair: e.g. "35=D" or "Side=1" (supports substring matches like "what is 35=D")
  const tagValMatch = q.match(/(?:^|\b)([a-zA-Z0-9_]+)\s*=\s*([^=|?\s]+)/);
  if (tagValMatch) {
    let tagOrName = tagValMatch[1].trim();
    let val = tagValMatch[2].trim();
    // Strip trailing parentheses and punctuation (like ), ., ?, !, etc.)
    val = val.replace(/[).,?!;\s]+$/, '');
    
    // Check custom dialect first
    const customField = getCustomField(tagOrName);
    if (customField) {
      const tagName = customField.name;
      const enumVal = customField.values?.find(v => String(v.enum) === String(val));
      const meaning = enumVal ? enumVal.description : null;
      const src = `custom XML dialect (${customDialect.version})`;
      if (meaning) {
        return `Tag ${customField.tag} (${tagName}) = ${val} (${meaning})\n\nThis definition comes from your uploaded ${src}.`;
      } else {
        return `Tag ${customField.tag} (${tagName}) = ${val}\n\nThis tag is defined in your uploaded ${src}, but no enum description was found for value "${val}".`;
      }
    }
    
    // Check version-specific spec if detected
    if (specInfo) {
      const specField = specInfo.spec.fields.find(f => 
        /^\d+$/.test(tagOrName) 
          ? String(f.tag) === String(tagOrName) 
          : f.name.toLowerCase() === tagOrName.toLowerCase()
      );
      if (specField) {
        const enumVal = specField.values?.find(v => String(v.enum) === String(val));
        const meaning = enumVal ? enumVal.description : null;
        let verLabel = specInfo.fallbackFrom 
          ? `${specInfo.fallbackFrom} (showing spec from ${specInfo.actualVersion})`
          : specInfo.actualVersion;
          
        let response = "";
        if (meaning) {
          response = `Tag ${specField.tag} (${specField.name}) = ${val} (${meaning})\n\nThis definition is from the ${verLabel} specification.`;
        } else {
          response = `Tag ${specField.tag} (${specField.name}) = ${val}\n\nThis tag is defined in ${verLabel}, but no enum description was found for value "${val}".`;
        }
        
        const descObj = getTagDescription(specField.tag);
        if (descObj) {
          response += `\n\n**Description**:\n${descObj.description}`;
        }
        return response;
      }
    }
    
    // Fallback: Global standard lookups
    let tag = /^\d+$/.test(tagOrName) ? tagOrName : null;
    if (!tag) {
      const entry = Object.entries(FIX_TAGS).find(([t, name]) => name.toLowerCase() === tagOrName.toLowerCase());
      if (entry) {
        tag = entry[0];
      }
    }
    if (tag) {
      const tagName = FIX_TAGS[tag];
      const enums = FIX_VALUES[tag];
      const meaning = enums ? (enums[val] || enums[Number(val)]) : null;
      
      let response = "";
      if (meaning) {
        response = `Tag ${tag} (${tagName}) = ${val} (${meaning})\n\nThis is a standard FIX tag-value definition.`;
      } else {
        response = `Tag ${tag} (${tagName}) = ${val}\n\nThis is a standard FIX tag, but no specific local enum mapping was found for value "${val}".`;
      }
      
      const descObj = getTagDescription(tag);
      if (descObj) {
        response += `\n\n**Description**:\n${descObj.description}`;
        if (descObj.note) {
          response += `\n\n**Usage Note**:\n${descObj.note}`;
        }
      }
      return response;
    }
  }

  // 2. Single Tag Number match: e.g. "tag 107", "what is 107", or exactly "107"
  const sanitizedQ = sanitizeQueryForNumbers(q);
  const allNums = sanitizedQ.match(/\b\d+\b/g) || [];
  if (allNums.length === 1) {
    const singleNum = allNums[0];
    const customField = getCustomField(singleNum);
    if (customField) {
      let response = `Tag ${singleNum} represents "${customField.name}" in your custom XML dialect.\n- Type: ${customField.type}`;
      if (customField.values && customField.values.length > 0) {
        response += `\n\nAllowed enum values:\n` + 
          customField.values.map(v => `- ${v.enum}: ${v.description}`).join('\n');
      }
      return response;
    }
    
    // Check version-specific spec if detected
    if (specInfo) {
      const specField = lookupTagInSpec(singleNum, specInfo.spec);
      if (specField) {
        let verLabel = specInfo.fallbackFrom 
          ? `${specInfo.fallbackFrom} (showing spec from ${specInfo.actualVersion})`
          : specInfo.actualVersion;
        let response = `### Tag ${singleNum} [${verLabel}]\n` +
                       `- **Field Name**: **${specField.name}**\n` +
                       `- **Data Type**: \`${specField.type || "N/A"}\``;
        
        const descObj = getTagDescription(singleNum);
        if (descObj) {
          response += `\n\n**Description**:\n${descObj.description}`;
          if (descObj.note) {
            response += `\n\n**Usage Note**:\n${descObj.note}`;
          }
        }
        
        if (Array.isArray(specField.values) && specField.values.length > 0) {
          response += `\n\n**Allowed Enum Values (${verLabel})**:\n` +
            specField.values.map(v => `- \`${v.enum}\`: ${v.description}`).join('\n');
        }
        return response;
      }
    }

    // Fallback: Global standard lookup
    const tagName = FIX_TAGS[singleNum];
    if (tagName) {
      let response = `Tag ${singleNum} represents the field "${tagName}".`;
      
      const descObj = getTagDescription(singleNum);
      if (descObj) {
        response += `\n\n**Description**:\n${descObj.description}`;
        if (descObj.note) {
          response += `\n\n**Usage Note**:\n${descObj.note}`;
        }
      }
      
      const enums = FIX_VALUES[singleNum];
      if (enums) {
        response += `\n\nAllowed enum values:\n` + 
          Object.entries(enums).map(([val, name]) => `- ${val}: ${name}`).join('\n');
      }
      return response;
    }
  }

  // 3. Exact Field Name search: e.g. "Side"
  const cleanQ = sanitizedQ.replace(/tag\s*/gi, "").trim();
  const customField = getCustomField(cleanQ);
  if (customField) {
    let response = `Field "${customField.name}" is Tag ${customField.tag} in your custom XML dialect.\n- Type: ${customField.type}`;
    if (customField.values && customField.values.length > 0) {
      response += `\n\nAllowed enum values:\n` + 
        customField.values.map(v => `- ${v.enum}: ${v.description}`).join('\n');
    }
    return response;
  }
  
  // Check version-specific spec if detected
  if (specInfo) {
    const specField = lookupFieldNameInSpec(cleanQ, specInfo.spec);
    if (specField) {
      let verLabel = specInfo.fallbackFrom 
        ? `${specInfo.fallbackFrom} (showing spec from ${specInfo.actualVersion})`
        : specInfo.actualVersion;
      let response = `### Field "${specField.name}" [${verLabel}]\n` +
                     `- **Tag Number**: **${specField.tag}**\n` +
                     `- **Data Type**: \`${specField.type || "N/A"}\``;
      
      const descObj = getTagDescription(specField.tag);
      if (descObj) {
        response += `\n\n**Description**:\n${descObj.description}`;
      }
      
      if (Array.isArray(specField.values) && specField.values.length > 0) {
        response += `\n\n**Allowed Enum Values (${verLabel})**:\n` +
          specField.values.map(v => `- \`${v.enum}\`: ${v.description}`).join('\n');
      }
      return response;
    }
  }

  // Fallback: Global standard lookup
  const foundTag = Object.entries(FIX_TAGS).find(([tag, name]) => name.toLowerCase() === cleanQ.toLowerCase());
  if (foundTag) {
    const [tag, name] = foundTag;
    let response = `Field "${name}" is represented by Tag ${tag}.`;
    
    const descObj = getTagDescription(tag);
    if (descObj) {
      response += `\n\n**Description**:\n${descObj.description}`;
      if (descObj.note) {
        response += `\n\n**Usage Note**:\n${descObj.note}`;
      }
    }
    
    const enums = FIX_VALUES[tag];
    if (enums) {
      response += `\n\nAllowed enum values:\n` + 
        Object.entries(enums).map(([val, valName]) => `- ${val}: ${valName}`).join('\n');
    }
    return response;
  }

  return null;
}

// Partial word/number extractor for general offline queries
function tryPartialLookup(query, customDialect) {
  const matchedTags = new Set();
  const customMatches = [];
  
  // Extract number strings
  const sanitizedQuery = sanitizeQueryForNumbers(query);
  const numbers = sanitizedQuery.match(/\b\d+\b/g) || [];
  for (const num of numbers) {
    if (customDialect && Array.isArray(customDialect.fields)) {
      const found = customDialect.fields.find(f => String(f.tag) === String(num));
      if (found) {
        customMatches.push(found);
        continue;
      }
    }
    if (FIX_TAGS[num]) {
      matchedTags.add(num);
    }
  }

  // Extract whole word matching field names (ignoring noise/stop-words)
  const stopWords = new Set(["for", "to", "in", "by", "at", "of", "and", "the", "a", "an", "is", "or", "what", "how", "why", "who", "which", "tag", "tags"]);
  const words = query.toLowerCase().split(/[^a-zA-Z0-9]+/);
  for (const word of words) {
    if (!word || stopWords.has(word) || word.length < 3) continue;
    
    if (customDialect && Array.isArray(customDialect.fields)) {
      customDialect.fields.forEach(f => {
        if (f.name.toLowerCase().includes(word) && !customMatches.some(m => m.tag === f.tag)) {
          customMatches.push(f);
        }
        if (f.values && Array.isArray(f.values)) {
          const hasEnumMatch = f.values.some(v => 
            v.enum.toLowerCase() === word ||
            v.description.toLowerCase().includes(word) ||
            v.description.toLowerCase().replace(/_/g, ' ').includes(word)
          );
          if (hasEnumMatch && !customMatches.some(m => m.tag === f.tag)) {
            customMatches.push(f);
          }
        }
      });
    }
    
    for (const [tag, name] of Object.entries(FIX_TAGS)) {
      if (name.toLowerCase().includes(word)) {
        matchedTags.add(tag);
      }
    }

    for (const [tag, enums] of Object.entries(FIX_VALUES)) {
      for (const [enumVal, enumDesc] of Object.entries(enums)) {
        if (
          String(enumVal).toLowerCase() === word ||
          enumDesc.toLowerCase().includes(word) ||
          enumDesc.toLowerCase().replace(/_/g, ' ').includes(word)
        ) {
          matchedTags.add(tag);
        }
      }
    }
  }

  let result = "";
  if (customMatches.length > 0) {
    result += `\n\n*Custom Dialect matches (${customDialect.version}):*`;
    customMatches.forEach(f => {
      result += `\n- **Tag ${f.tag} (${f.name})**: Type ${f.type}`;
      if (f.values && f.values.length > 0) {
        result += ` (Enums: ${f.values.slice(0, 3).map(v => `${v.enum}=${v.description}`).join(', ')}${f.values.length > 3 ? '...' : ''})`;
      }
    });
  }

  if (matchedTags.size > 0) {
    result += "\n\n*Standard FIX matches:*";
    Array.from(matchedTags).slice(0, 6).forEach(tag => {
      const name = FIX_TAGS[tag];
      const enums = FIX_VALUES[tag];
      result += `\n- **Tag ${tag} (${name})**: Standard field.`;
      if (enums) {
        result += ` (Common values: ${Object.entries(enums).slice(0, 4).map(([v, n]) => `${v}=${n}`).join(', ')}${Object.keys(enums).length > 4 ? '...' : ''})`;
      }
    });
  }
  
  return result;
}

/* --- Advanced Offline Query Upgrades ------------------------------------- */

const CONDITIONAL_RULES = {
  "logon": `* **Tag 98 (EncryptMethod)**: Required (0 = None / plaintext, etc.).\n* **Tag 108 (HeartBtInt)**: Required (Heartbeat interval in seconds, e.g. \`30\`).\n* **Tag 141 (ResetSeqNumFlag)**: Optional (\`Y\` or \`N\`).`,
  
  "new order": `* **Tag 11 (ClOrdID)**: Required (Unique identifier for the order).\n* **Tag 21 (HandlInst)**: Required (1 = Automated exec private, 2 = Automated public, 3 = Manual).\n* **Tag 55 (Symbol)**: Required (ticker symbol, e.g. \`AAPL\`).\n* **Tag 54 (Side)**: Required (1 = Buy, 2 = Sell, etc.).\n* **Tag 38 (OrderQty)**: Required (quantity of shares).\n* **Tag 40 (OrdType)**: Required (1 = Market, 2 = Limit, 3 = Stop, etc.).\n* **Tag 44 (Price)**: Required if \`OrdType=2\` (Limit order), omitted for Market orders.`,
  
  "cancel": `* **Tag 11 (ClOrdID)**: Required (New identifier for this cancel request).\n* **Tag 41 (OrigClOrdID)**: Required (ClOrdID of the order you are trying to cancel).\n* **Tag 55 (Symbol)**: Required.\n* **Tag 54 (Side)**: Required.\n* **Tag 38 (OrderQty)**: Required.`,
  
  "replace": `* **Tag 11 (ClOrdID)**: Required (New identifier for this modify request).\n* **Tag 41 (OrigClOrdID)**: Required (ClOrdID of the order you are modifying).\n* **Tag 55 (Symbol)**: Required.\n* **Tag 54 (Side)**: Required.\n* **Tag 38 (OrderQty)**: Required.\n* **Tag 40 (OrdType)**: Required.\n* **Tag 44 (Price)**: Required if \`OrdType=2\` (Limit).`
};

const REJECT_REASONS_373 = {
  "0": "Invalid Tag (Tag does not exist in this version of the protocol).",
  "1": "Required Tag Missing (A tag that must be present is missing).",
  "2": "Tag not defined for this message type (The tag is defined, but not permitted on this MsgType).",
  "3": "Undefined Tag Value (The value is undefined/missing).",
  "4": "Tag specified without a value (e.g. tag= followed immediately by delimiter).",
  "5": "Value is incorrect (out of range) for this tag.",
  "6": "Incorrect data format for value (e.g. letters in a float field).",
  "7": "Decryption problem.",
  "8": "Signature problem.",
  "9": "CompID problem (SenderCompID or TargetCompID does not match expected session parameters).",
  "10": "SendingTime accuracy problem (SendingTime tag 52 deviates from system time by more than max clock skew, e.g. 120s).",
  "11": "Invalid MsgType (The msgType tag 35 value is unknown or unpermitted).",
  "18": "Invalid/Unsupported Version (Tag 8 value is unsupported)."
};

const REJECT_REASONS_103 = {
  "0": "Broker Option (Default reason code).",
  "1": "Unknown Symbol (The ticker symbol tag 55 does not exist).",
  "2": "Exchange Closed.",
  "3": "Order exceeds limit (Order value or shares exceed account size limit).",
  "4": "Too late to enter (Order entered after trading session close).",
  "5": "Unknown Order (Attempt to cancel/modify a non-existent ClOrdID).",
  "6": "Duplicate Order (ClOrdID tag 11 already exists).",
  "7": "Duplicate of a verbally communicated order.",
  "8": "Stale Order.",
  "9": "Trade along required.",
  "13": "Incorrect Quantity (e.g. round lot mismatch, negative shares).",
  "15": "Invalid Price (e.g. limit price is outside tick boundaries)."
};

const FIX_TERM_EXPLANATIONS = {
  "done for day": `### Done for Day (OrdStatus 39 = 3)
**Definition**: Done for Day is a standard execution order status in the FIX protocol. 
It indicates that the broker or exchange has finished executing the order for the current trading day. 

**Usage Context**:
- Any remaining unfilled quantity is handled based on the TimeInForce (Tag 59) rule. For example, for a Day order, the remaining quantity is canceled.
- This status is commonly returned at the market close for orders that cannot be executed further today.`,

  "partially filled": `### Partially Filled (OrdStatus 39 = 1)
**Definition**: The order has been executed for a portion of its original quantity.

**Usage Context**:
- LeavesQty (Tag 151) will represent the remaining shares to be filled.
- CumQty (Tag 14) will show the cumulative filled quantity.
- Further Execution Reports (35=8) can follow as additional fills occur.`,

  "filled": `### Filled (OrdStatus 39 = 2)
**Definition**: The order has been completely executed.

**Usage Context**:
- CumQty (Tag 14) equals the original OrderQty (Tag 38).
- LeavesQty (Tag 151) is set to 0.
- This represents the final state of a successfully executed order.`,

  "pending cancel": `### Pending Cancel (OrdStatus 39 = 6)
**Definition**: An Order Cancel Request (35=F) has been received, and the cancel is pending processing by the exchange.

**Usage Context**:
- The order remains active in the order book until a final Canceled (39=4) status is returned.`,

  "pending replace": `### Pending Replace (OrdStatus 39 = E)
**Definition**: An Order Cancel/Replace Request (35=G) has been received, and the replace is pending processing by the exchange.`,

  "stopped": `### Stopped (OrdStatus 39 = 7)
**Definition**: The order has been stopped on the exchange (e.g. trading halt, price limit hit, or specialist action).`,

  "suspended": `### Suspended (OrdStatus 39 = 9)
**Definition**: The order has been temporarily suspended from trading (e.g., due to a short sale restriction or regulatory halt).`,

  "ioc": `### Immediate or Cancel / IOC (TimeInForce 59 = 3)
**Definition**: Immediate or Cancel (IOC) requires all or part of the order to be executed immediately upon receipt. Any unfilled portion of the order is immediately canceled.

**Usage Context**:
- Unlike Fill or Kill (FOK), partial fills are permitted for IOC orders.`,

  "immediate or cancel": `### Immediate or Cancel / IOC (TimeInForce 59 = 3)
**Definition**: Immediate or Cancel (IOC) requires all or part of the order to be executed immediately upon receipt. Any unfilled portion of the order is immediately canceled.`,

  "gtc": `### Good Till Cancel / GTC (TimeInForce 59 = 1)
**Definition**: Good Till Cancel (GTC) indicates that the order remains active in the market until it is either completely filled, explicitly canceled by the client, or reaches its maximum lifetime (typically 30 to 90 days depending on broker/exchange rules).`,

  "good till cancel": `### Good Till Cancel / GTC (TimeInForce 59 = 1)
**Definition**: Good Till Cancel (GTC) indicates that the order remains active in the market until it is either completely filled, explicitly canceled by the client, or reaches its maximum lifetime (typically 30 to 90 days depending on broker/exchange rules).`,

  "fok": `### Fill or Kill / FOK (TimeInForce 59 = 4)
**Definition**: Fill or Kill (FOK) requires the order to be executed in its entirety immediately upon receipt. If the order cannot be completely filled immediately, the entire order is canceled (no partial fills are allowed).`,

  "fill or kill": `### Fill or Kill / FOK (TimeInForce 59 = 4)
**Definition**: Fill or Kill (FOK) requires the order to be executed in its entirety immediately upon receipt. If the order cannot be completely filled immediately, the entire order is canceled (no partial fills are allowed).`,

  "day order": `### Day Order (TimeInForce 59 = 0)
**Definition**: A Day order is only active for the current trading session. If it remains unfilled at the market close, the remaining quantity is automatically canceled.`
};

function tryStatusLookup(query) {
  const q = query.toLowerCase();
  for (const [term, explanation] of Object.entries(FIX_TERM_EXPLANATIONS)) {
    const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
    if (regex.test(q)) {
      return explanation;
    }
  }
  return null;
}

function tryBatchTagLookup(query, customDialect) {
  const sanitizedQuery = sanitizeQueryForNumbers(query);
  const numbers = sanitizedQuery.match(/\b\d+\b/g) || [];
  const uniqNumbers = Array.from(new Set(numbers)).filter(n => Number(n) > 0 && Number(n) < 20000);
  
  if (uniqNumbers.length <= 1) return null;
  
  let result = `### Batch Tag Lookup Results\n\n`;
  let foundAny = false;
  
  uniqNumbers.forEach(tag => {
    if (customDialect && Array.isArray(customDialect.fields)) {
      const customField = customDialect.fields.find(f => String(f.tag) === String(tag));
      if (customField) {
        foundAny = true;
        result += `* **Tag ${tag} (${customField.name})** [Custom Dialect]: Type ${customField.type}.\n`;
        if (customField.values && customField.values.length > 0) {
          result += `  * Values: ${customField.values.map(v => `\`${v.enum}\` = ${v.description}`).join(', ')}\n`;
        }
        return;
      }
    }
    
    const name = FIX_TAGS[tag];
    if (name) {
      foundAny = true;
      result += `* **Tag ${tag} (${name})**: Standard field.\n`;
      
      const descObj = getTagDescription(tag);
      if (descObj) {
        const cleanDesc = descObj.description.split('\n')[0].replace(/\*\*/g, '');
        result += `  * *Description*: ${cleanDesc}\n`;
      }
      
      const enums = FIX_VALUES[tag];
      if (enums) {
        result += `  * Allowed values: ${Object.entries(enums).slice(0, 8).map(([v, d]) => `\`${v}\` = ${d}`).join(', ')}${Object.keys(enums).length > 8 ? '...' : ''}\n`;
      }
    }
  });
  
  return foundAny ? result : null;
}

function tryConditionalRulesLookup(query) {
  const q = query.toLowerCase();
  let matchedTopic = null;
  if (q.includes("logon") || q.includes("35=a") || q.includes("encryptmethod") || q.includes("heartbtint")) {
    matchedTopic = "logon";
  } else if (q.includes("replace") || q.includes("modify") || q.includes("35=g")) {
    matchedTopic = "replace";
  } else if (q.includes("cancel") || q.includes("35=f") || q.includes("origclordid")) {
    matchedTopic = "cancel";
  } else if (q.includes("new order") || q.includes("35=d") || q.includes("order single") || q.includes("price") || q.includes("ordtype") || q.includes("orderqty") || q.includes("handlinst")) {
    matchedTopic = "new order";
  }
  
  if (matchedTopic) {
    return `### Conditional Field Rules for ${matchedTopic.toUpperCase()}\n\n` + 
      CONDITIONAL_RULES[matchedTopic] + 
      `\n\n*This list contains key session/execution field validation rules.*`;
  }
  return null;
}

function tryRejectReasonLookup(query) {
  const q = query.toLowerCase();
  
  const reject373Match = q.match(/(?:373\s*=\s*|session\s*reject\s*(?:reason\s*)?)(\d+)/i);
  if (reject373Match) {
    const val = reject373Match[1];
    const meaning = REJECT_REASONS_373[val];
    if (meaning) {
      return `### Session Reject Reason (Tag 373 = ${val})\n\n**Definition**: ${meaning}\n\n*Session Reject messages (MsgType 35=3) include Tag 373 to indicate why a message was rejected at the session layer.*`;
    }
  }
  
  const reject103Match = q.match(/(?:103\s*=\s*|ord\s*rej\s*(?:reason\s*)?)(\d+)/i);
  if (reject103Match) {
    const val = reject103Match[1];
    const meaning = REJECT_REASONS_103[val];
    if (meaning) {
      return `### Order Reject Reason (Tag 103 = ${val})\n\n**Definition**: ${meaning}\n\n*Execution Reports (MsgType 35=8, OrdStatus 39=8) include Tag 103 to indicate why an order was rejected at the business layer.*`;
    }
  }
  
  if (q.includes("reject reason") || q.includes("rejection codes") || q.includes("reject codes")) {
    return `### Common FIX Rejection Reason Lookup\n\n` +
      `**Session Rejections (Tag 373)**:\n` +
      Object.entries(REJECT_REASONS_373).slice(0, 6).map(([c, m]) => `- **${c}**: ${m}`).join('\n') + `\n\n` +
      `**Order Rejections (Tag 103)**:\n` +
      Object.entries(REJECT_REASONS_103).slice(0, 6).map(([c, m]) => `- **${c}**: ${m}`).join('\n') + `\n\n` +
      `*Query specifically (e.g., "373=5" or "103=1") for detailed breakdowns.*`;
  }
  return null;
}

function recalculateFixMessage(queryText) {
  const parsed = validateFIXMessage(queryText);
  if (!parsed) return null;
  
  if (parsed.isValid) {
    return null; // Already valid
  }
  
  const tagList = parsed.tagList;
  const beginString = parsed.tags['8'] || 'FIX.4.4';
  const msgType = parsed.tags['35'] || '0';
  const middleFields = tagList.filter(t => t.tag !== '8' && t.tag !== '9' && t.tag !== '10' && t.tag !== '35');
  const sep = parsed.separator;
  
  const bodyText = `35=${msgType}` + (middleFields.length > 0 ? sep + middleFields.map(f => `${f.tag}=${f.val}`).join(sep) : "") + sep;
  const correctedLength = bodyText.length;
  const fullMessageUpToTen = `8=${beginString}${sep}9=${correctedLength}${sep}${bodyText}`;
  
  const standardDelimited = fullMessageUpToTen.split(sep).join('\x01');
  let sum = 0;
  for (let i = 0; i < standardDelimited.length; i++) {
    sum += standardDelimited.charCodeAt(i);
  }
  const correctedChecksum = (sum % 256).toString().padStart(3, '0');
  const correctedMessage = `${fullMessageUpToTen}10=${correctedChecksum}${sep}`;
  
  return `### FIX Message Re-calculation Report\n` +
    `* **BeginString (8)**: \`${beginString}\`\n` +
    `* **Original BodyLength (9)**: \`${parsed.tags['9'] || 'N/A'}\` -> **Corrected**: \`${correctedLength}\`\n` +
    `* **Original Checksum (10)**: \`${parsed.tags['10'] || 'N/A'}\` -> **Corrected**: \`${correctedChecksum}\`\n\n` +
    `## Corrected raw message payload:\n` +
    `\`\`\`\n` +
    `${correctedMessage}\n` +
    `\`\`\``;
}

export async function POST(req) {
  try {
    const { query, customDialect } = await req.json();
    
    // Extract Gemini API key from client request header, fallback to server process env
    const clientKey = req.headers.get("x-gemini-key");
    const apiKey = clientKey || process.env.GEMINI_API_KEY || "";

    // Build Schema-Aware Custom Dialect Context
    let dialectContext = "";
    if (customDialect && Array.isArray(customDialect.fields) && customDialect.fields.length > 0) {
      dialectContext = "\n\nYou are also aware of a custom uploaded QuickFIX XML dialect schema loaded in the workspace (Version: " + customDialect.version + "). " +
        "Here are the custom fields and tags defined in this dialect. Use them to override or augment standard FIX definitions when appropriate:\n" +
        customDialect.fields.map(f => {
          let desc = `- Tag ${f.tag}: ${f.name} (Type: ${f.type})`;
          if (f.values && f.values.length > 0) {
            desc += ` [Allowed values: ${f.values.map(v => `${v.enum}=${v.description}`).join(', ')}]`;
          }
          return desc;
        }).join('\n') + "\n\nUse this custom schema context to answer any questions about custom tags or enums in this session.";
    }

    const systemInstruction = 
      "You are FIXi, a helpful AI consultant specialized in the FIX (Financial Information eXchange) protocol. " +
      "You help developers, traders, and QA engineers analyze FIX messages, troubleshoot trading session logs, " +
      "explain tag numbers, data types, and enum values, and audit conformance flows. " +
      "Keep explanations clear, professional, and code-focused. If a FIX message table is provided, " +
      "explain the transaction flow and highlight any fields that might indicate errors or mismatches. " +
      "You are highly knowledgeable about asset class mapping in the FIX protocol: " +
      "- Equities: mapped via Product (Tag 460=5), SecurityType (Tag 167=CS), Symbol (Tag 55), SecurityID (Tag 48), and SecurityIDSource (Tag 22). " +
      "- Futures: mapped via Product (Tag 460=2), SecurityType (Tag 167=FUT), MaturityMonthYear (Tag 200 in YYYYMM format), MaturityDate (Tag 541 in YYYYMMDD format), and ContractMultiplier (Tag 231). " +
      "- Forex Spot & Forwards: mapped via Product (Tag 460=4), SecurityType (Tag 167=SPOT or FOR), SettlType (Tag 63, where C indicates Forward), and value date SettlDate (Tag 64 in YYYYMMDD format). " +
      "- Forex Swaps: mapped via SecurityType (Tag 167=FXSWAP) and double legs via OrderQty2 (Tag 192) and FutSettDate2 (Tag 193) for pre-FIX 4.4, or Leg Groups (starting with NoLegs Tag 555) for FIX 4.4+. " +
      "- Fixed Income / Debt: mapped via Product (Tag 460=3/6/11), SecurityType (Tag 167=TBOND/CORP), YieldType (Tag 235), and Yield (Tag 236)." +
      dialectContext;

    let table = null;
    let answer = "";
    let hfConnected = false;

    const hasApiKey = !!apiKey.trim();

    if (hasApiKey) {
      // Direct path: Use Gemini AI to answer queries
      if (looksLikeFIX(query)) {
        const parsed = validateFIXMessage(query);
        if (parsed) {
          table = parsed.tagList.map(t => [t.tag, t.val, t.name, t.meaning]);
          
          const symbol = parsed.tags['55'];
          let marketInfo = "";
          if (symbol) {
            marketInfo = await getMarketData(symbol);
          }

          const prompt = 
            `Please provide a professional, concise summary of this parsed FIX message.\n\n` +
            `Raw Message: ${query}\n` +
            `Parsed Tag Table:\n` +
            `${table.map(([t, val, name, meaning]) => `Tag ${t} (${name}) = ${val} (${meaning})`).join("\n")}\n\n` +
            (marketInfo ? `${marketInfo}\n\n` : "") +
            `Check if the message contains any validation errors or warnings: ` +
            `${parsed.isValid ? "None (Checksum and BodyLength are correct)" : parsed.errors.join("; ")}.`;

          const geminiRes = await queryGemini(prompt, apiKey, systemInstruction);
          answer = geminiRes.answer;
          hfConnected = geminiRes.connected;
          
          const routingAnalysis = analyzeSessionRouting(parsed);
          const responsePayload = generateResponsePayload(parsed);
          
          if (routingAnalysis) {
            answer += `\n\n${routingAnalysis}`;
          }
          if (responsePayload) {
            answer += `\n\n### Proposed Counterpart Response (FIXi Intelligent Simulator)\n` +
              `${responsePayload.explanation}\n\n` +
              `**Expected Response**: \`${responsePayload.respMsgTypeName}\` (MsgType 35=${responsePayload.rawResponse.match(/35=([^|]+)/)?.[1] || ''})\n` +
              `\`\`\`\n` +
              `${responsePayload.rawResponse}\n` +
              `\`\`\``;
          }
        } else {
          answer = "[Warning] Failed to parse FIX message structure.";
        }
      } else {
        const modelAwareness = tryModelAwarenessLookup(query, true);
        if (modelAwareness) {
          answer = modelAwareness + `\n\n*Response resolved by AURA.*`;
        } else {
          const geminiRes = await queryGemini(query, apiKey, systemInstruction);
          answer = geminiRes.answer;
          hfConnected = geminiRes.connected;
        }
      }
    } else {
      // Offline fallback: Highly detailed local lookups
      if (looksLikeFIX(query)) {
        const fixLines = query.split("\n").map(l => l.trim()).filter(l => /^8=FIX\./.test(l));
        if (fixLines.length > 1) {
          const auditResult = auditMultiMessageStream(fixLines);
          answer = auditResult.answer;
          table = auditResult.table;
        } else {
          const parsed = validateFIXMessage(query);
          if (parsed) {
            table = parsed.tagList.map(t => [t.tag, t.val, t.name, t.meaning]);
            const version = parsed.tags['8'] || 'Unknown';
            const msgType = parsed.tags['35'] || 'Unknown';
            const msgTypeName = parsed.msgTypeName || 'Unknown';
            const validationStatus = parsed.isValid ? 'Passed' : 'Failed';
            const validationDetails = parsed.isValid ? 'Checksum and BodyLength are correct.' : parsed.errors.join('; ');
            
            const routingAnalysis = analyzeSessionRouting(parsed);
            const responsePayload = generateResponsePayload(parsed);
            
            let additionalDetails = "";
            if (routingAnalysis) {
              additionalDetails += `\n\n${routingAnalysis}`;
            }
            if (responsePayload) {
              additionalDetails += `\n\n### Proposed Counterpart Response (FIXi Intelligent Simulator)\n` +
                `${responsePayload.explanation}\n\n` +
                `**Expected Response**: \`${responsePayload.respMsgTypeName}\` (MsgType 35=${responsePayload.rawResponse.match(/35=([^|]+)/)?.[1] || ''})\n` +
                `\`\`\`\n` +
                `${responsePayload.rawResponse}\n` +
                `\`\`\``;
            }

            let singleDiagram = "";
            const sender = parsed.tags['49'] || 'CLIENT';
            const target = parsed.tags['56'] || 'BROKER';
            const seq = parsed.tags['34'] || '?';
            const type = parsed.tags['35'] || '?';
            const name = parsed.msgTypeName || 'Message';
            const statusLabel = parsed.isValid ? '✓' : '✗';
            
            singleDiagram = `\n\n### Visual Message Flow\n` +
              `\`\`\`text\n` +
              `   ${sender.padEnd(12, ' ')}                ${target.padStart(12, ' ')}\n` +
              `        │                            │\n` +
              `        │─── ${name} (35=${type}) Seq:${seq} [${statusLabel}] ───>│\n` +
              `        │                            │\n` +
              `        ▼                            ▼\n` +
              `\`\`\``;

            answer = `### Parsed FIX Message Details\n` +
              `- **Protocol Version**: ${version}\n` +
              `- **Message Type**: \`${msgType}\` (${msgTypeName})\n` +
              `- **Integrity Check**: **${validationStatus}** (${validationDetails})` +
              additionalDetails +
              singleDiagram + `\n\n` +
              `*Response resolved by AURA.*`;
          } else {
            answer = `[Warning] Failed to parse FIX message structure.\n\n` +
              `*Response resolved by AURA.*`;
          }
        }
      } else {
        if (isGreeting(query)) {
          answer = `Hello! I am **AURA** (AUgmented Response Agent), your offline FIX protocol diagnostics companion. 

How can I help you today? You can:
- Look up specific FIX tags (e.g. "what is tag 35" or "explain tag 49")
- Search message schemas (e.g. "Logon schema" or "ExecutionReport fields")
- Audit conditional validation rules (e.g. "when is price required?")
- Look up session rejection codes (e.g. "rejection reason 5" or "373=5")
- Paste a raw FIX message string (starting with \`8=FIX.\`) to run structural validations, routing audits, and counterpart response simulations.

*Response resolved by AURA.*`;
        } else {
          const modelAwareness = tryModelAwarenessLookup(query, false);
          if (modelAwareness) {
            answer = modelAwareness + `\n\n*Response resolved by AURA.*`;
          } else {
            // Evaluate offline lookups in order of specificity
            const statusLookup = tryStatusLookup(query);
            const rejectLookup = tryRejectReasonLookup(query);
            const localResult = tryLocalLookup(query, customDialect);
          
          // Prioritize conditional rules if they ask for rules/validation/requirements
          const lowercaseQuery = query.toLowerCase();
          const asksForRules = lowercaseQuery.includes("rule") || 
                               lowercaseQuery.includes("conditional") || 
                               lowercaseQuery.includes("validat") || 
                               lowercaseQuery.includes("when is") || 
                               lowercaseQuery.includes("require") ||
                               lowercaseQuery.includes("optional");

          const asksForSchema = lowercaseQuery.includes("schema") || 
                                lowercaseQuery.includes("fields") || 
                                lowercaseQuery.includes("structure") ||
                                lowercaseQuery.includes("format");
                               
          let condRulesLookup = null;
          let schemaLookup = null;
          
          if (asksForRules) {
            condRulesLookup = tryConditionalRulesLookup(query);
            if (!condRulesLookup) {
              schemaLookup = tryMessageSchemaLookup(query);
            }
          } else {
            schemaLookup = tryMessageSchemaLookup(query);
            if (!schemaLookup) {
              condRulesLookup = tryConditionalRulesLookup(query);
            }
          }
          
          const batchLookup = tryBatchTagLookup(query, customDialect);

          // Check specific guide topics (prioritized before tag-value mapping)
          let specificGuideMatch = null;
          for (const [topic, text] of Object.entries(FIX_GUIDES)) {
            if (topic === "fix" || topic === "fix protocol") continue; // skip general/broad guides
            if (lowercaseQuery.includes(topic)) {
              specificGuideMatch = text;
              break;
            }
          }

          if (specificGuideMatch) {
            answer = `${specificGuideMatch}\n\n*Response resolved by AURA (Displaying local quick-guide).*`;
          } else if (asksForRules && condRulesLookup) {
            answer = `${condRulesLookup}\n\n*Response resolved by AURA (Displaying local validation rulebook).*`;
          } else if (asksForSchema && schemaLookup) {
            answer = `${schemaLookup}\n\n*Response resolved by AURA (Displaying local message schema).*`;
          } else if (statusLookup) {
            answer = `${statusLookup}\n\n*Response resolved by AURA (Displaying status/terminology guides).*`;
          } else if (rejectLookup) {
            answer = `${rejectLookup}\n\n*Response resolved by AURA (Displaying local reject guides).*`;
          } else if (localResult) {
            answer = `${localResult}\n\n*Response resolved by AURA.*`;
          } else if (condRulesLookup) {
            answer = `${condRulesLookup}\n\n*Response resolved by AURA (Displaying local validation rulebook).*`;
          } else if (schemaLookup) {
            answer = `${schemaLookup}\n\n*Response resolved by AURA (Displaying local message schema).*`;
          } else if (batchLookup) {
            answer = `${batchLookup}\n\n*Response resolved by AURA (Running offline batch lookups).*`;
          } else {
            // Check general/broad quick-guides as fallback
            let generalGuideMatch = null;
            for (const [topic, text] of Object.entries(FIX_GUIDES)) {
              if (topic === "fix" || topic === "fix protocol") {
                if (lowercaseQuery.includes(topic)) {
                  generalGuideMatch = text;
                  break;
                }
              }
            }

            if (generalGuideMatch) {
              answer = `${generalGuideMatch}\n\n*Response resolved by AURA (Displaying local quick-guide).*`;
            } else {
              const partials = tryPartialLookup(query, customDialect);
              if (partials && partials.trim()) {
                answer = `*Response resolved by AURA.*\n\n${partials}\n\n*Try searching for general terms like logon, sequence, checksum, body, or resend for quick reference.*`;
              } else {
                answer = `*Response resolved by AURA.*\n\n*Try searching for general terms like logon, sequence, checksum, body, or resend for quick reference.*`;
              }
            }
          }
        }
      }
    }
    hfConnected = false;
  }

    return NextResponse.json({ answer, table, hfConnected });
  } catch (err) {
    return NextResponse.json({ 
      answer: err.message || "Unknown routing error occurred.", 
      table: null, 
      hfConnected: false 
    }, { status: 500 });
  }
}
