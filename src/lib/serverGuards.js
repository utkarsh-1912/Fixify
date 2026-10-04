// Small helpers shared by API routes: client IP, per-route rate limiting and JSON errors.

import { RateLimiter } from './fixdropStore';

const buckets = (globalThis.__rateBuckets ??= new Map());

export function clientIp(request) {
  const raw = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  return raw === '::1' || raw === '::ffff:127.0.0.1' ? '127.0.0.1' : raw.slice(0, 64);
}

export const jsonError = (error, status = 400) =>
  new Response(JSON.stringify({ success: false, error }), { status, headers: { 'Content-Type': 'application/json' } });

/** Returns a 429 Response when `request`'s IP exceeded `limit` hits per window for `name`, else null. */
export function rateLimit(request, name, { limit, windowMs = 60_000 }) {
  let limiter = buckets.get(name);
  if (!limiter || limiter.limit !== limit || limiter.windowMs !== windowMs) {
    limiter = new RateLimiter({ limit, windowMs });
    buckets.set(name, limiter);
  }
  return limiter.allow(clientIp(request)) ? null : jsonError('Rate limit exceeded. Please slow down.', 429);
}

/** Reads a JSON body but refuses anything larger than `maxBytes` (checked on the real text, not the header). */
export async function readJson(request, maxBytes) {
  const text = await request.text();
  if (text.length > maxBytes) throw Object.assign(new Error('Request body too large.'), { status: 413 });
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 });
  }
}
