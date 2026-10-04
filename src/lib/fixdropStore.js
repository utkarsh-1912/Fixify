// In-memory relay store for FixDrop rooms + WebRTC signalling.
// Pure and clock-injectable so it can be unit tested; the Next.js route is a thin HTTP adapter.

export const LIMITS = {
  maxItemsPerRoom: 50,
  maxItemBytes: 6 * 1024 * 1024,
  maxTextBytes: 1024 * 1024,
  maxRoomBytes: 24 * 1024 * 1024,
  maxTotalBytes: 128 * 1024 * 1024,
  maxRooms: 500,
  maxSignalsPerRoom: 200,
  roomTtlMs: 30 * 60 * 1000,
  signalTtlMs: 2 * 60 * 1000,
  maxNameLength: 255,
  maxSenderLength: 64,
};

export class StoreError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const isValidPin = (pin) => typeof pin === 'string' && /^\d{4,8}$/.test(pin.trim());

export const sanitizeFileName = (name) =>
  String(name ?? 'file')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[\\/]+/g, '_')
    .replace(/^[._]+/, '')
    .slice(0, LIMITS.maxNameLength) || 'file';

const SAFE_MIME = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i;
const DATA_URL = /^data:([a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+)?(;[a-z0-9=._+-]+)*;base64,([A-Za-z0-9+/]*={0,2})$/i;

export const safeMime = (mime) => (SAFE_MIME.test(mime || '') ? mime.toLowerCase() : 'application/octet-stream');

/** Decoded size in bytes of a base64 data URL, or throws if it is malformed. */
export function dataUrlBytes(dataUrl) {
  const m = DATA_URL.exec(dataUrl);
  if (!m) throw new StoreError('dataUrl must be a base64 data: URL.');
  const b64 = m[3];
  return Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
}

export const formatBytes = (n) => (n > 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`);

const itemBytes = (item) => item.bytes || 0;

export class RoomStore {
  constructor({ now = () => Date.now(), limits = {} } = {}) {
    this.now = now;
    this.limits = { ...LIMITS, ...limits };
    this.rooms = new Map(); // pin -> items[] (newest first)
    this.signals = new Map(); // pin -> signal[]
  }

  totalBytes() {
    let n = 0;
    this.rooms.forEach((items) => items.forEach((i) => { n += itemBytes(i); }));
    return n;
  }

  prune() {
    const t = this.now();
    for (const [pin, items] of this.rooms) {
      const valid = items.filter((i) => t - i.createdTimestamp < this.limits.roomTtlMs);
      if (valid.length) this.rooms.set(pin, valid); else this.rooms.delete(pin);
    }
    for (const [pin, list] of this.signals) {
      const valid = list.filter((s) => t - s.timestamp < this.limits.signalTtlMs);
      if (valid.length) this.signals.set(pin, valid); else this.signals.delete(pin);
    }
  }

  assertPin(pin) {
    if (!isValidPin(pin)) throw new StoreError('Invalid PIN format: must be 4 to 8 digits.');
    return pin.trim();
  }

  list(pin) {
    pin = this.assertPin(pin);
    this.prune();
    return this.rooms.get(pin) || [];
  }

  /** input: { type, content, name, dataUrl, bytes, sender, senderId, isP2P, fileId, id, ip } */
  add(pinIn, input) {
    const pin = this.assertPin(pinIn);
    this.prune();
    const L = this.limits;
    const type = input.type === 'file' ? 'file' : 'text';
    const content = String(input.content ?? '');
    let bytes = 0;
    let dataUrl = null;

    if (input.dataUrl) {
      bytes = dataUrlBytes(input.dataUrl);
      dataUrl = input.dataUrl;
    } else if (input.bytes) {
      bytes = Number(input.bytes) || 0;
    }
    const textBytes = new TextEncoder().encode(content).length;
    if (textBytes > L.maxTextBytes) throw new StoreError('Text payload is too large.', 413);
    if (bytes > L.maxItemBytes) {
      throw new StoreError(`File is too large for server relay (${formatBytes(bytes)} > ${formatBytes(L.maxItemBytes)}); use peer-to-peer transfer.`, 413);
    }
    if (!content && !input.name && !dataUrl) throw new StoreError('Payload content or filename required.');
    const total = bytes + textBytes;

    if (!this.rooms.has(pin) && this.rooms.size >= L.maxRooms) throw new StoreError('Too many active rooms; try again later.', 503);

    const sender = String(input.sender || 'Device_Peer').slice(0, L.maxSenderLength);
    const ip = input.ip || '127.0.0.1';
    const item = {
      id: String(input.id || input.fileId || `${this.now()}_${Math.random().toString(36).slice(2, 6)}`).slice(0, 64),
      type,
      sender: sender.includes('(') ? sender : `${sender} (${ip})`,
      senderId: input.senderId ? String(input.senderId).slice(0, 64) : null,
      createdTimestamp: this.now(),
      timestamp: new Date(this.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content,
      name: input.name ? sanitizeFileName(input.name) : null,
      size: dataUrl ? formatBytes(bytes) : input.size ? String(input.size).slice(0, 32) : null,
      dataUrl,
      isP2P: !!input.isP2P,
      fileId: input.fileId ? String(input.fileId).slice(0, 64) : null,
      bytes: total,
    };

    // Evict the oldest items until this one fits the per-room item/byte caps and the global cap.
    let items = [item, ...(this.rooms.get(pin) || []).filter((i) => i.id !== item.id)];
    const roomBytes = () => items.reduce((n, i) => n + itemBytes(i), 0);
    while (items.length > 1 && (items.length > L.maxItemsPerRoom || roomBytes() > L.maxRoomBytes)) items.pop();
    if (this.totalBytes() - (this.rooms.get(pin) || []).reduce((n, i) => n + itemBytes(i), 0) + roomBytes() > L.maxTotalBytes) {
      throw new StoreError('Server relay is full; use peer-to-peer transfer.', 507);
    }
    this.rooms.set(pin, items);
    return { item, totalCount: items.length };
  }

  remove(pinIn, itemId, senderId) {
    const pin = this.assertPin(pinIn);
    const items = this.rooms.get(pin) || [];
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new StoreError('Item not found.', 404);
    if (item.senderId && item.senderId !== senderId) throw new StoreError('Unauthorized: you can only delete your own items.', 403);
    const rest = items.filter((i) => i.id !== itemId);
    if (rest.length) this.rooms.set(pin, rest); else this.rooms.delete(pin);
    return rest.length;
  }

  reset(pinIn) {
    const pin = this.assertPin(pinIn);
    this.rooms.delete(pin);
    this.signals.delete(pin);
  }

  addSignal(pinIn, { signal, sender }) {
    const pin = this.assertPin(pinIn);
    if (!signal || typeof signal !== 'object') throw new StoreError('Signal payload required.');
    if (JSON.stringify(signal).length > 32 * 1024) throw new StoreError('Signal payload too large.', 413);
    this.prune();
    const list = this.signals.get(pin) || [];
    list.push({ signal, sender: String(sender || 'Device_Peer').slice(0, this.limits.maxSenderLength), timestamp: this.now(), readBy: new Set() });
    this.signals.set(pin, list.slice(-this.limits.maxSignalsPerRoom));
  }

  /**
   * Returns signals for `peerId`: targeted ones are consumed on read; broadcast
   * ones (no targetPeerId) are delivered once to each other peer until they expire.
   */
  takeSignals(pinIn, peerId = '') {
    const pin = this.assertPin(pinIn);
    this.prune();
    const list = this.signals.get(pin) || [];
    const mine = [];
    const keep = [];
    list.forEach((s) => {
      const target = s.signal.targetPeerId;
      if (target) {
        if (target === peerId) mine.push(s); else keep.push(s);
      } else {
        if (s.sender !== peerId && !s.readBy.has(peerId)) {
          s.readBy.add(peerId);
          mine.push(s);
        }
        keep.push(s);
      }
    });
    if (keep.length) this.signals.set(pin, keep); else this.signals.delete(pin);
    return mine.map(({ signal, sender, timestamp }) => ({ signal, sender, timestamp }));
  }
}

/** Fixed-window per-key rate limiter. */
export class RateLimiter {
  constructor({ limit = 240, windowMs = 60_000, now = () => Date.now() } = {}) {
    Object.assign(this, { limit, windowMs, now });
    this.hits = new Map();
  }

  allow(key) {
    const t = this.now();
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (t - v.start >= this.windowMs) this.hits.delete(k);
    const h = this.hits.get(key);
    if (!h || t - h.start >= this.windowMs) {
      this.hits.set(key, { start: t, count: 1 });
      return true;
    }
    h.count += 1;
    return h.count <= this.limit;
  }
}
