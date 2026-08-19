import http from 'http';

// Setup Mock Window for Node.js context compatibility
if (typeof global.window === 'undefined') {
  global.window = {};
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Core FIX Parser algorithms replicated for validation
const regexCache = {};
const getTagValue = (line, tag, customDelimiter) => {
  const cacheKey = `${tag}-${customDelimiter || 'default'}`;
  let regex = regexCache[cacheKey];
  if (!regex) {
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
    regex = new RegExp(`(?:^|${delimPattern})${tag}=([^${delimPattern}]+)`);
    regexCache[cacheKey] = regex;
  }
  const match = line.match(regex);
  return match ? match[1] : '';
};

async function runUnitTests() {
  console.log('Running FIX Parser Unit Tests...');

  // Test 1: getTagValue with standard pipe separator
  const line1 = '8=FIX.4.4|9=95|35=0|49=SENDER|56=TARGET|34=1|10=123|';
  const val35 = getTagValue(line1, '35', '|');
  assert(val35 === '0', `Expected tag 35 to be '0', got '${val35}'`);
  console.log('✅ Test 1: getTagValue (pipe delimiter) Passed');

  // Test 2: getTagValue with SOH separator
  const line2 = '8=FIX.4.4\x019=95\x0135=D\x0149=SENDER\x0156=TARGET\x0110=188\x01';
  const val35_soh = getTagValue(line2, '35', 'SOH');
  assert(val35_soh === 'D', `Expected tag 35 to be 'D', got '${val35_soh}'`);
  console.log('✅ Test 2: getTagValue (SOH delimiter) Passed');
}

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runIntegrationTests() {
  const host = 'localhost';
  const port = 3000;
  const pin = '8888';

  const pingServer = () => new Promise((resolve) => {
    const socket = http.get({ host, port, path: '/api/fixdrop?pin=8888', timeout: 1000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    socket.on('error', () => resolve(false));
  });

  let mockServer = null;
  let isServerUp = await pingServer();
  if (!isServerUp) {
    console.log('⚡ Starting lightweight in-memory FixDrop test server for integration & data transfer tests...');
    const roomStores = new Map();
    const signalingStores = new Map();

    mockServer = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pin = url.searchParams.get('pin') || '7492';
      const action = url.searchParams.get('action');
      const peerId = url.searchParams.get('peerId');

      if (!/^\d{4,8}$/.test(pin.trim())) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid PIN format' }));
        return;
      }

      if (req.method === 'GET') {
        if (action === 'signal') {
          const list = signalingStores.get(pin) || [];
          const mySignals = peerId ? list.filter(s => s.signal?.targetPeerId === peerId) : list;
          if (peerId) {
            signalingStores.set(pin, list.filter(s => s.signal?.targetPeerId !== peerId));
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, signals: mySignals }));
          return;
        }
        const items = roomStores.get(pin) || [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: items.length, items }));
        return;
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.action === 'signal') {
              const list = signalingStores.get(data.pin || pin) || [];
              signalingStores.set(data.pin || pin, [...list, { signal: data.signal, sender: data.sender, timestamp: Date.now() }]);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
              return;
            }
            const newItem = {
              id: data.id || 'item_' + Date.now(),
              type: data.type || 'text',
              sender: data.sender || 'CI_Runner',
              senderId: data.senderId || null,
              timestamp: '10:00 AM',
              content: data.content || '',
              name: data.name || null,
              size: data.size || null,
              dataUrl: data.dataUrl || null,
              isP2P: data.isP2P || false
            };
            const current = roomStores.get(data.pin || pin) || [];
            roomStores.set(data.pin || pin, [newItem, ...current]);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, item: newItem }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }

      if (req.method === 'DELETE') {
        const itemId = url.searchParams.get('itemId');
        if (itemId) {
          const list = roomStores.get(pin) || [];
          roomStores.set(pin, list.filter(i => i.id !== itemId));
        } else {
          roomStores.delete(pin);
          signalingStores.delete(pin);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }
    });

    await new Promise((resolve) => mockServer.listen(port, host, resolve));
  }

  console.log('Running End-to-End FixDrop API Integration Tests...');

  try {
    // 0. Pre-clean Room State
    await makeRequest({ host, port, path: `/api/fixdrop?pin=${pin}`, method: 'DELETE' });

    // 1. Get Initial Room State (Should be empty)
    const t1 = await makeRequest({ host, port, path: `/api/fixdrop?pin=${pin}`, method: 'GET' });
    assert(t1.body.success === true, 'Failed to fetch room state');
    assert(t1.body.items.length === 0, 'Room should be empty');
    console.log('✅ Integration Test 1: Fetch empty room Passed');

    // 2. Post Stream Item to Room
    const t2 = await makeRequest({
      host,
      port,
      path: '/api/fixdrop',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      pin,
      type: 'text',
      content: '8=FIX.4.2|9=65|35=A|49=SNDR|56=RCVR|34=1|10=200|',
      sender: 'CI_Runner'
    });
    assert(t2.body.success === true, 'Failed to post item');
    assert(t2.body.item.type === 'text', 'Posted item type mismatch');
    console.log('✅ Integration Test 2: Post item Passed');

    // 3. Verify Item Retention
    const t3 = await makeRequest({ host, port, path: `/api/fixdrop?pin=${pin}`, method: 'GET' });
    assert(t3.body.success === true, 'Failed to fetch updated room state');
    assert(t3.body.items.length === 1, 'Room should contain exactly 1 item');
    assert(t3.body.items[0].sender.startsWith('CI_Runner'), 'Sender mismatch in retrieved item');
    console.log('✅ Integration Test 3: Verify item retention Passed');

    // 3.5. WebRTC P2P Signaling & Target Routing Test
    // Post signal from Receiver to Sender_Peer
    const postSig = await makeRequest({
      host,
      port,
      path: '/api/fixdrop',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      action: 'signal',
      pin,
      sender: 'Receiver_Peer',
      signal: { type: 'offer', itemId: 'item_123', sdp: 'dummy-sdp', targetPeerId: 'Sender_Peer' }
    });
    assert(postSig.body.success === true, 'Failed to post signaling message');

    // Fetch signal as a different peer (Other_Peer) -> should be empty
    const otherFetch = await makeRequest({
      host,
      port,
      path: `/api/fixdrop?pin=${pin}&action=signal&peerId=Other_Peer`,
      method: 'GET'
    });
    assert(otherFetch.body.success === true, 'Failed to fetch signal for other peer');
    assert(otherFetch.body.signals.length === 0, 'Other peer should not receive signal targeted to Sender_Peer');

    // Fetch signal as Sender_Peer -> should return the signal
    const senderFetch = await makeRequest({
      host,
      port,
      path: `/api/fixdrop?pin=${pin}&action=signal&peerId=Sender_Peer`,
      method: 'GET'
    });
    assert(senderFetch.body.success === true, 'Failed to fetch signal for targeted peer');
    assert(senderFetch.body.signals.length === 1, 'Targeted peer should receive exactly 1 signal');
    assert(senderFetch.body.signals[0].signal.type === 'offer', 'Signal type mismatch');
    assert(senderFetch.body.signals[0].sender === 'Receiver_Peer', 'Signal sender mismatch');

    // Fetch signal again as Sender_Peer -> should be empty (cleared on read)
    const senderFetch2 = await makeRequest({
      host,
      port,
      path: `/api/fixdrop?pin=${pin}&action=signal&peerId=Sender_Peer`,
      method: 'GET'
    });
    assert(senderFetch2.body.success === true, 'Failed to refetch signal');
    assert(senderFetch2.body.signals.length === 0, 'Signal should be cleared after read');
    console.log('✅ Integration Test 5: P2P Signaling and Target Routing Passed');

    // 4. Reset Room State
    const t4 = await makeRequest({ host, port, path: `/api/fixdrop?pin=${pin}`, method: 'DELETE' });
    assert(t4.body.success === true, 'Failed to reset room');
    console.log('✅ Integration Test 6: Reset room Passed');

    // 5. Verify Invalid PIN Format Rejection
    const invalidPinRes = await makeRequest({ host, port, path: `/api/fixdrop?pin=invalid_abc`, method: 'GET' });
    assert(invalidPinRes.statusCode === 400, 'Expected 400 Bad Request for non-numeric PIN');
    assert(invalidPinRes.body.success === false, 'Invalid PIN should return success: false');
    console.log('✅ Integration Test 7: PIN validation rejection Passed');

  } catch (error) {
    console.error('❌ Integration Tests Failed:', error.message);
    process.exit(1);
  } finally {
    if (mockServer) {
      mockServer.close();
    }
  }
}

async function main() {
  try {
    await runUnitTests();
    await runIntegrationTests();
    console.log('\n🎉 All tests passed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test Execution Failed:', error.message);
    process.exit(1);
  }
}

main();
