import { NextResponse } from "next/server";

if (!global.chatMessagesDb) {
  global.chatMessagesDb = {};
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId");
  if (!roomId) {
    return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
  }
  const messages = global.chatMessagesDb[roomId] || [];
  return NextResponse.json({ messages });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, roomId } = body;
    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }

    if (!global.chatMessagesDb[roomId]) {
      global.chatMessagesDb[roomId] = [];
    }

    if (action === "send") {
      const { message } = body;
      if (!message) {
        return NextResponse.json({ error: "Missing message" }, { status: 400 });
      }
      
      // Prevent duplicates by checking id
      if (!global.chatMessagesDb[roomId].some(m => m.id === message.id)) {
        global.chatMessagesDb[roomId].push(message);
        if (global.chatMessagesDb[roomId].length > 100) {
          global.chatMessagesDb[roomId].shift();
        }
      }
      return NextResponse.json({ success: true });
    } else if (action === "react") {
      const { msgId, emoji, username } = body;
      if (!msgId || !emoji || !username) {
        return NextResponse.json({ error: "Missing reaction details" }, { status: 400 });
      }
      const messages = global.chatMessagesDb[roomId];
      const message = messages.find(m => m.id === msgId);
      if (message) {
        if (!message.reactions) {
          message.reactions = {};
        }
        if (!message.reactions[emoji]) {
          message.reactions[emoji] = [];
        }
        if (!message.reactions[emoji].includes(username)) {
          message.reactions[emoji].push(username);
        }
      }
      return NextResponse.json({ success: true });
    } else if (action === "clear") {
      global.chatMessagesDb[roomId] = [];
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
