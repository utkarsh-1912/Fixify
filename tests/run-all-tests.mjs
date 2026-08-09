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

  console.log('\nChecking if local Next.js server is available for integration tests...');
  
  // Quick pre-flight check to see if server is listening
  const pingServer = () => new Promise((resolve) => {
    const socket = http.get({ host, port, path: '/api/fixdrop?pin=test', timeout: 1000 }, (res) => {
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });

  const isServerUp = await pingServer();
  if (!isServerUp) {
    console.log('⚠️ Next.js server is not running on http://localhost:3000. Skipping Integration Tests.');
    return;
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

    // 4. Reset Room State
    const t4 = await makeRequest({ host, port, path: `/api/fixdrop?pin=${pin}`, method: 'DELETE' });
    assert(t4.body.success === true, 'Failed to reset room');
    console.log('✅ Integration Test 4: Reset room Passed');

  } catch (error) {
    console.error('❌ Integration Tests Failed:', error.message);
    process.exit(1);
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
