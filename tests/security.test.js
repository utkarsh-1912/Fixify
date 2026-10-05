import { describe, it, expect } from 'vitest';
import { previewMimeFor } from '@/lib/safeFile';
import { rateLimit, readJson, clientIp } from '@/lib/serverGuards';
import { POST as runCode } from '@/app/coderunner/api/route';
import { GET as chatGet, POST as chatPost } from '@/app/chat/api/messages/route';
import { GET as marketGet } from '@/app/api/market-data/route';
import { POST as interpret } from '@/app/interpreter/api/query/route';

const post = (url, body, ip = '10.0.0.1', headers = {}) =>
  new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const get = (url, ip = '10.0.0.2') => new Request(`http://localhost${url}`, { headers: { 'x-forwarded-for': ip } });

describe('AirShare preview whitelist', () => {
  it('never previews script-capable types', () => {
    ['x.html', 'x.htm', 'x.svg', 'x.js', 'x.xhtml', 'x.SVG', 'x', 'x.html.txt.exe', '__proto__', 'constructor'].forEach((n) =>
      expect(previewMimeFor(n), n).toBeNull()
    );
  });
  it('previews inert types, forcing text formats to text/plain', () => {
    expect(previewMimeFor('a.PDF')).toBe('application/pdf');
    expect(previewMimeFor('a.png')).toBe('image/png');
    expect(previewMimeFor('log.fix')).toBe('text/plain');
    expect(previewMimeFor('data.xml')).toBe('text/plain');
  });
});

describe('serverGuards', () => {
  it('rate limits per IP and per bucket', () => {
    const req = (ip) => get('/x', ip);
    const results = Array.from({ length: 4 }, () => rateLimit(req('1.1.1.1'), 'unit-a', { limit: 3 }));
    expect(results.map((r) => r?.status ?? null)).toEqual([null, null, null, 429]);
    expect(rateLimit(req('2.2.2.2'), 'unit-a', { limit: 3 })).toBeNull();
    expect(rateLimit(req('1.1.1.1'), 'unit-b', { limit: 3 })).toBeNull();
  });
  it('rejects oversized or invalid JSON bodies', async () => {
    await expect(readJson(post('/x', 'a'.repeat(100)), 10)).rejects.toMatchObject({ status: 413 });
    await expect(readJson(post('/x', '{nope'), 1000)).rejects.toMatchObject({ status: 400 });
    expect(await readJson(post('/x', { a: 1 }), 1000)).toEqual({ a: 1 });
    expect(clientIp(get('/x', '::1'))).toBe('127.0.0.1');
  });
});

describe('/coderunner/api guards (no upstream call is made)', () => {
  it('validates language, source and sizes', async () => {
    expect((await runCode(post('/coderunner/api', { language: 'cobol', source: 'x' }, '3.3.3.1'))).status).toBe(400);
    expect((await runCode(post('/coderunner/api', { language: 'python', source: '' }, '3.3.3.2'))).status).toBe(400);
    expect((await runCode(post('/coderunner/api', { language: 'python', source: 'x'.repeat(70 * 1024) }, '3.3.3.3'))).status).toBe(413);
    expect((await runCode(post('/coderunner/api', { language: 'python', source: 'x', stdin: 'y'.repeat(20 * 1024) }, '3.3.3.4'))).status).toBe(413);
  });
  it('rate limits after 8 requests per minute', async () => {
    const codes = [];
    for (let i = 0; i < 10; i++) codes.push((await runCode(post('/coderunner/api', { language: 'cobol', source: 'x' }, '3.3.9.9'))).status);
    expect(codes.slice(0, 8).every((c) => c === 400)).toBe(true);
    expect(codes.slice(8)).toEqual([429, 429]);
  });
});

describe('/chat/api/messages', () => {
  it('treats __proto__ / constructor as ordinary room names instead of corrupting state', async () => {
    for (const roomId of ['__proto__', 'constructor', 'toString']) {
      const sent = await chatPost(post('/chat/api/messages', { action: 'send', roomId, message: { id: 'm1', text: 'hi' } }, '4.4.4.1'));
      expect(sent.status, roomId).toBe(200);
      const res = await chatGet(get(`/chat/api/messages?roomId=${roomId}&userId=u1&username=bob`, '4.4.4.2'));
      expect(res.status, roomId).toBe(200);
      expect((await res.json()).messages).toHaveLength(1);
    }
    expect(({}).text).toBeUndefined();
    expect(Object.prototype.presentUsers).toBeUndefined();
  });
  it('rejects malformed or oversized input', async () => {
    const send = (body, ip) => chatPost(post('/chat/api/messages', body, ip));
    expect((await send({ action: 'send', roomId: 'r', message: 'str' }, '4.4.5.1')).status).toBe(400);
    expect((await send({ action: 'send', roomId: 'x'.repeat(65), message: { id: '1' } }, '4.4.5.2')).status).toBe(400);
    expect((await send({ action: 'send', roomId: 'r', message: { id: '1', text: 'x'.repeat(70 * 1024) } }, '4.4.5.3')).status).toBe(413);
    expect((await chatPost(post('/chat/api/messages', '{bad', '4.4.5.4'))).status).toBe(400);
    expect((await chatGet(get('/chat/api/messages?roomId=a%00b', '4.4.5.5'))).status).toBe(400);
  });
});

describe('/api/market-data guards', () => {
  it('rejects too many or malformed symbols before any network call', async () => {
    const many = Array.from({ length: 21 }, (_, i) => `S${i}`).join(',');
    expect((await marketGet(get(`/api/market-data?symbols=${many}`, '5.5.5.1'))).status).toBe(400);
    expect((await marketGet(get('/api/market-data?symbols=AAPL,../../etc', '5.5.5.2'))).status).toBe(400);
    expect((await marketGet(get(`/api/market-data?q=${'a'.repeat(65)}`, '5.5.5.3'))).status).toBe(400);
  });
});

describe('/interpreter/api/query guards', () => {
  it('validates the query and applies a tight limit when the server key would be used', async () => {
    expect((await interpret(post('/interpreter/api/query', { query: '' }, '6.6.6.1', { 'x-gemini-key': 'k' }))).status).toBe(400);
    expect((await interpret(post('/interpreter/api/query', { query: 'x'.repeat(20001) }, '6.6.6.2', { 'x-gemini-key': 'k' }))).status).toBe(413);
    const codes = [];
    for (let i = 0; i < 12; i++) codes.push((await interpret(post('/interpreter/api/query', { query: '' }, '6.6.9.9'))).status);
    expect(codes.slice(0, 10).every((c) => c === 400)).toBe(true);
    expect(codes.slice(10)).toEqual([429, 429]);
  });
});

describe('chat room ownership and privacy', () => {
  const api = (body, ip) => chatPost(post('/chat/api/messages', body, ip));
  const room = 'owned-room-1';

  it('only the room creator can clear or delete it', async () => {
    expect((await api({ action: 'send', roomId: room, message: { id: 'a', senderId: 'owner-1', text: 'x' } }, '7.7.7.1')).status).toBe(200);
    expect((await api({ action: 'clear', roomId: room, userId: 'intruder' }, '7.7.7.2')).status).toBe(403);
    expect((await api({ action: 'clear', roomId: room }, '7.7.7.2')).status).toBe(403);
    expect((await api({ action: 'delete_room', roomId: room, userId: 'intruder' }, '7.7.7.2')).status).toBe(403);
    const still = await (await chatGet(get(`/chat/api/messages?roomId=${room}`, '7.7.7.3'))).json();
    expect(still.messages).toHaveLength(1);

    expect((await api({ action: 'clear', roomId: room, userId: 'owner-1' }, '7.7.7.1')).status).toBe(200);
    expect((await api({ action: 'delete_room', roomId: room, userId: 'owner-1' }, '7.7.7.1')).status).toBe(200);
  });

  it('never stores or returns client IP addresses', async () => {
    const r = 'privacy-room-1';
    const res = await chatGet(get(`/chat/api/messages?roomId=${r}&userId=u9&username=zed`, '203.0.113.77'));
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain('203.0.113.77');
    expect(text).not.toContain('"ip"');
    expect(text).not.toContain('clientIp');
  });

  it('the first participant to join claims the room', async () => {
    const r = 'claimed-by-join';
    await chatGet(get(`/chat/api/messages?roomId=${r}&userId=first&username=a`, '7.7.8.1'));
    await chatGet(get(`/chat/api/messages?roomId=${r}&userId=second&username=b`, '7.7.8.2'));
    expect((await api({ action: 'clear', roomId: r, userId: 'second' }, '7.7.8.2')).status).toBe(403);
    expect((await api({ action: 'clear', roomId: r, userId: 'first' }, '7.7.8.1')).status).toBe(200);
  });
});
