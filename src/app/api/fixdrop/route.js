import { NextResponse } from "next/server";
import { LIMITS, RateLimiter, RoomStore, StoreError, formatBytes, safeMime } from "@/lib/fixdropStore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One store per server process; cached on globalThis so dev-mode hot reloads keep the rooms.
const g = globalThis;
const store = (g.__fixdropStore ??= new RoomStore());
const limiter = (g.__fixdropLimiter ??= new RateLimiter({ limit: 240, windowMs: 60_000 }));

const MAX_REQUEST_BYTES = Math.ceil(LIMITS.maxItemBytes * 1.4) + 64 * 1024; // base64 overhead + envelope

const fail = (error, status = 400) => NextResponse.json({ success: false, error }, { status });

const clientIp = (request) => {
  const raw = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  return raw === "::1" || raw === "::ffff:127.0.0.1" ? "127.0.0.1" : raw.slice(0, 64);
};

const guard = (request) => {
  if (!limiter.allow(clientIp(request))) return fail("Rate limit exceeded. Slow down.", 429);
  return null;
};

const handle = async (fn) => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof StoreError) return fail(error.message, error.status);
    if (error instanceof SyntaxError) return fail("Request body must be valid JSON.", 400);
    console.error("fixdrop route error:", error);
    return fail("Internal server error.", 500);
  }
};

export async function GET(request) {
  const limited = guard(request);
  if (limited) return limited;
  return handle(() => {
    const { searchParams } = new URL(request.url);
    const pin = searchParams.get("pin") || "7492";
    if (searchParams.get("action") === "signal") {
      return NextResponse.json({ success: true, signals: store.takeSignals(pin, searchParams.get("peerId") || "") });
    }
    const items = store.list(pin);
    return NextResponse.json({ success: true, pin, count: items.length, items });
  });
}

export async function POST(request) {
  const limited = guard(request);
  if (limited) return limited;
  return handle(async () => {
    const declared = Number(request.headers.get("content-length") || 0);
    if (declared > MAX_REQUEST_BYTES) {
      throw new StoreError(`Request too large (${formatBytes(declared)}); use peer-to-peer transfer for big files.`, 413);
    }

    const ip = clientIp(request);
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      let dataUrl = null;
      let name = form.get("name");
      if (file && typeof file === "object" && file.arrayBuffer) {
        if (file.size > LIMITS.maxItemBytes) {
          throw new StoreError(`File is too large for server relay (${formatBytes(file.size)}); use peer-to-peer transfer.`, 413);
        }
        const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
        dataUrl = `data:${safeMime(file.type)};base64,${base64}`;
        name = file.name || name;
      }
      const pin = form.get("pin") || "7492";
      const { item, totalCount } = store.add(pin, {
        type: "file",
        name: name || "file",
        dataUrl,
        size: form.get("size"),
        sender: form.get("sender") || "Device_Peer",
        senderId: form.get("senderId"),
        fileId: form.get("fileId"),
        ip,
      });
      return NextResponse.json({ success: true, pin, item, totalCount });
    }

    const body = await request.json();
    const { action, pin = "7492", signal, sender = "Device_Peer" } = body;

    if (action === "signal") {
      store.addSignal(pin, { signal, sender });
      return NextResponse.json({ success: true });
    }

    const { item, totalCount } = store.add(pin, {
      type: body.type,
      content: body.content,
      name: body.name,
      dataUrl: body.dataUrl,
      size: body.size,
      sender,
      senderId: body.senderId,
      isP2P: body.isP2P,
      fileId: body.fileId,
      id: body.id,
      ip,
    });
    return NextResponse.json({ success: true, pin, item, totalCount });
  });
}

export async function DELETE(request) {
  const limited = guard(request);
  if (limited) return limited;
  return handle(() => {
    const { searchParams } = new URL(request.url);
    const pin = searchParams.get("pin") || "7492";
    const itemId = searchParams.get("itemId");

    if (itemId) {
      const totalCount = store.remove(pin, itemId, searchParams.get("senderId"));
      return NextResponse.json({ success: true, message: "Item deleted successfully", totalCount });
    }
    store.reset(pin);
    return NextResponse.json({ success: true, message: `Room ${pin} reset successfully` });
  });
}
