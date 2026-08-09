import { NextResponse } from "next/server";

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
    pruneSignals(pin);
    const list = signalingStores.get(pin) || [];
    signalingStores.set(pin, []); // clear signals after read
    return NextResponse.json({
      success: true,
      signals: list
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
    const body = await request.json();
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
    const newItem = {
      id: Date.now().toString() + "_" + Math.random().toString(36).substring(2, 6),
      type,
      sender,
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

  roomStores.delete(pin);
  signalingStores.delete(pin);
  return NextResponse.json({
    success: true,
    message: `Room ${pin} reset successfully`
  });
}
