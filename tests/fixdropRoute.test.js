import { describe, it, expect } from 'vitest';
import { GET, POST, DELETE } from '@/app/api/fixdrop/route';

const url = (q = '') => `http://localhost/api/fixdrop${q}`;
const json = (body) =>
  new Request(url(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.9' },
    body: JSON.stringify(body),
  });
const get = (q) => new Request(url(q), { headers: { 'x-forwarded-for': '9.9.9.9' } });
const del = (q) => new Request(url(q), { method: 'DELETE', headers: { 'x-forwarded-for': '9.9.9.9' } });

describe('/api/fixdrop (real route handlers)', () => {
  it('post -> list -> targeted signal -> delete round trip', async () => {
    const pin = '5151';
    await DELETE(del(`?pin=${pin}`));
    const posted = await (await POST(json({ pin, type: 'text', content: '8=FIX.4.2|35=0|', sender: 'CI', senderId: 'me' }))).json();
    expect(posted.success).toBe(true);
    expect(posted.item.sender).toBe('CI (9.9.9.9)');

    const room = await (await GET(get(`?pin=${pin}`))).json();
    expect(room.items).toHaveLength(1);

    await POST(json({ action: 'signal', pin, sender: 'R', signal: { type: 'offer', targetPeerId: 'S' } }));
    expect((await (await GET(get(`?pin=${pin}&action=signal&peerId=X`))).json()).signals).toHaveLength(0);
    expect((await (await GET(get(`?pin=${pin}&action=signal&peerId=S`))).json()).signals).toHaveLength(1);

    const forbidden = await DELETE(del(`?pin=${pin}&itemId=${posted.item.id}&senderId=evil`));
    expect(forbidden.status).toBe(403);
    const ok = await DELETE(del(`?pin=${pin}&itemId=${posted.item.id}&senderId=me`));
    expect(ok.status).toBe(200);
  });

  it('returns proper 4xx for bad input instead of 500', async () => {
    expect((await GET(get('?pin=abc'))).status).toBe(400);
    expect((await POST(json({ pin: '5151' }))).status).toBe(400);
    const badJson = new Request(url(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.9' },
      body: '{nope',
    });
    expect((await POST(badJson)).status).toBe(400);
    expect((await POST(json({ pin: '5151', type: 'file', name: 'x', dataUrl: 'javascript:alert(1)' }))).status).toBe(400);
    const big = Buffer.alloc(7 * 1024 * 1024).toString('base64');
    expect((await POST(json({ pin: '5151', type: 'file', name: 'x', dataUrl: `data:a/b;base64,${big}` }))).status).toBe(413);
  });
});
