import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// In-memory room payload store for universal server relay
const roomStores = new Map();
const signalingStores = new Map();

const pruneSignals = (pin) => {
  const list = signalingStores.get(pin) || [];
  const now = Date.now();
  const valid = list.filter((item) => now - item.timestamp < 120000);
  signalingStores.set(pin, valid);
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const pin = searchParams.get("pin") || "7492";
  const action = searchParams.get("action");

  if (action === "signal") {
    const peerId = searchParams.get("peerId") || "";
    pruneSignals(pin);
    const list = signalingStores.get(pin) || [];
    
    // Filter signals intended for this peer (targetPeerId matches or is broadcast/missing)
    const mySignals = list.filter((item) => {
      const target = item.signal?.targetPeerId;
      return !target || target === peerId;
    });

    // Remove only the returned signals from the queue
    const remaining = list.filter((item) => {
      const target = item.signal?.targetPeerId;
      return target && target !== peerId;
    });
    signalingStores.set(pin, remaining);

    return NextResponse.json({
      success: true,
      signals: mySignals
    });
  }

  const roomItems = roomStores.get(pin) || [];
  return NextResponse.json({
    success: true,
    pin,
    count: roomItems.length,
    items: roomItems
  });
}

export async function POST(request) {
  try {
    let body = {};
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      const pin = formData.get("pin") || "7492";
      const sender = formData.get("sender") || "Device_Peer";
      const senderId = formData.get("senderId") || null;
      const fileId = formData.get("fileId") || null;

      let dataUrl = null;
      if (file && typeof file === "object" && file.arrayBuffer) {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const mimeType = file.type || "application/octet-stream";
        dataUrl = `data:${mimeType};base64,${base64}`;
      }

      body = {
        pin,
        type: "file",
        name: file?.name || formData.get("name") || "file",
        size: formData.get("size") || (file?.size ? (file.size > 1024 * 1024 ? (file.size / (1024 * 1024)).toFixed(2) + " MB" : (file.size / 1024).toFixed(1) + " KB") : "0 KB"),
        dataUrl,
        sender,
        senderId,
        isP2P: false,
        fileId
      };
    } else {
      body = await request.json();
    }

    const { action, pin = "7492", signal, type = "text", content, name, size, dataUrl, sender = "Device_Peer", isP2P, fileId } = body;

    if (action === "signal") {
      pruneSignals(pin);
      const list = signalingStores.get(pin) || [];
      const newSignal = {
        signal,
        sender,
        timestamp: Date.now()
      };
      signalingStores.set(pin, [...list, newSignal]);
      return NextResponse.json({ success: true });
    }

    if (!content && !name) {
      return NextResponse.json({ success: false, error: "Payload content or filename required" }, { status: 400 });
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Extract caller client IP
    const rawIp = request.headers.get("x-forwarded-for")?.split(",")[0] || request.socket?.remoteAddress || "127.0.0.1";
    const cleanIp = rawIp === "::1" || rawIp === "::ffff:127.0.0.1" ? "127.0.0.1" : rawIp;
    const finalSender = sender.includes("(") ? sender : `${sender} (${cleanIp})`;

    const newItem = {
      id: body.id || fileId || (Date.now().toString() + "_" + Math.random().toString(36).substring(2, 6)),
      type,
      sender: finalSender,
      senderId: body.senderId || null,
      timestamp,
      content: content || "",
      name: name || null,
      size: size || null,
      dataUrl: dataUrl || null,
      isP2P: isP2P || false,
      fileId: fileId || null,
    };

    const currentItems = roomStores.get(pin) || [];
    const updatedItems = [newItem, ...currentItems].slice(0, 50); // Keep latest 50 items per room
    roomStores.set(pin, updatedItems);

    return NextResponse.json({
      success: true,
      pin,
      item: newItem,
      totalCount: updatedItems.length
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const pin = searchParams.get("pin") || "7492";
  const itemId = searchParams.get("itemId");
  const senderId = searchParams.get("senderId");

  if (itemId) {
    const currentItems = roomStores.get(pin) || [];
    const item = currentItems.find(i => i.id === itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 });
    }
    // Verify ownership
    if (item.senderId && item.senderId !== senderId) {
      return NextResponse.json({ success: false, error: "Unauthorized: You can only delete your own items" }, { status: 403 });
    }
    const updatedItems = currentItems.filter(i => i.id !== itemId);
    roomStores.set(pin, updatedItems);
    return NextResponse.json({
      success: true,
      message: `Item deleted successfully`,
      totalCount: updatedItems.length
    });
  }

  roomStores.delete(pin);
  signalingStores.delete(pin);
  return NextResponse.json({
    success: true,
    message: `Room ${pin} reset successfully`
  });
}
