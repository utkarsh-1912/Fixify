import { NextResponse } from "next/server";
import { rateLimit, readJson } from "@/lib/serverGuards";

// Null-prototype maps: a roomId such as "__proto__" or "constructor" must be just another key.
if (!global.chatMessagesDb) {
  global.chatMessagesDb = Object.create(null);
}

if (!global.chatAnalyticsDb) {
  global.chatAnalyticsDb = Object.create(null);
}

// roomId -> userId of the first participant. Never sent to clients; it acts as the room's admin capability.
if (!global.chatRoomOwners) {
  global.chatRoomOwners = Object.create(null);
}
const claimRoom = (roomId, userId) => {
  if (userId && typeof userId === "string" && userId.length <= 64 && !global.chatRoomOwners[roomId]) {
    global.chatRoomOwners[roomId] = userId;
  }
};
const isOwner = (roomId, userId) => !!userId && global.chatRoomOwners[roomId] === userId;

const ROOM_ID_RE = /^[^\u0000-\u001f]{1,64}$/; // any printable name; null-prototype maps make "__proto__" safe
const MAX_ROOMS = 200;
const MAX_MESSAGE_CHARS = 64 * 1024;
const MAX_BODY_BYTES = 256 * 1024;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limited = rateLimit(request, "chat-get", { limit: 240 });
  if (limited) return limited;
  const roomId = searchParams.get("roomId");
  const userId = searchParams.get("userId");
  const username = searchParams.get("username");
  if (roomId && !ROOM_ID_RE.test(roomId)) return NextResponse.json({ error: "Invalid roomId" }, { status: 400 });
  if ((userId && userId.length > 64) || (username && username.length > 64)) {
    return NextResponse.json({ error: "userId / username too long" }, { status: 400 });
  }

  const activeRooms = Array.from(new Set([
    ...Object.keys(global.chatMessagesDb || {}),
    ...Object.keys(global.chatAnalyticsDb || {})
  ]));

  if (!roomId) {
    return NextResponse.json({ rooms: activeRooms });
  }

  // Initialize analytics database for this room if not present
  if (!global.chatAnalyticsDb[roomId]) {
    global.chatAnalyticsDb[roomId] = {
      presentUsers: {},
      leftUsers: {},
      joinHistory: []
    };
  }

  const roomAnalytics = global.chatAnalyticsDb[roomId];
  const now = Date.now();

  // Update presence if user parameters are provided
  if (userId && username) {
    claimRoom(roomId, userId);
    const wasPresent = !!roomAnalytics.presentUsers[userId];
    
    // Remove from leftUsers if they re-joined
    if (roomAnalytics.leftUsers[userId]) {
      delete roomAnalytics.leftUsers[userId];
    }

    // Update presence
    roomAnalytics.presentUsers[userId] = {
      username,
      lastSeen: now
    };

    // If they were not present, record a join event in history
    if (!wasPresent) {
      roomAnalytics.joinHistory.push({
        username,
        type: "join",
        timestamp: new Date().toISOString()
      });
      // Cap history
      if (roomAnalytics.joinHistory.length > 55) {
        roomAnalytics.joinHistory.shift();
      }
    }
  }

  // Scan for expired users (inactive for more than 45 seconds)
  Object.keys(roomAnalytics.presentUsers).forEach(uid => {
    const u = roomAnalytics.presentUsers[uid];
    if (now - u.lastSeen > 45000) {
      roomAnalytics.leftUsers[uid] = {
        username: u.username,
        leftAt: now
      };
      
      roomAnalytics.joinHistory.push({
        username: u.username,
        type: "leave",
        timestamp: new Date().toISOString()
      });
      
      delete roomAnalytics.presentUsers[uid];
    }
  });

  const messages = global.chatMessagesDb[roomId] || [];
  
  // Format lists for client response
  const present = Object.values(roomAnalytics.presentUsers).map(u => ({ username: u.username }));
  const left = Object.values(roomAnalytics.leftUsers).map(u => ({ username: u.username }));
  const history = roomAnalytics.joinHistory;

  return NextResponse.json({
    messages,
    rooms: activeRooms,
    analytics: {
      present,
      left,
      history
    }
  });
}

export async function POST(request) {
  try {
    const limited = rateLimit(request, "chat-post", { limit: 120 });
    if (limited) return limited;
    const body = await readJson(request, MAX_BODY_BYTES);
    const { action, roomId } = body;
    if (!roomId) {
      return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
    }
    if (!ROOM_ID_RE.test(String(roomId))) {
      return NextResponse.json({ error: "Invalid roomId" }, { status: 400 });
    }
    if (!global.chatMessagesDb[roomId] && Object.keys(global.chatMessagesDb).length >= MAX_ROOMS) {
      return NextResponse.json({ error: "Too many active rooms" }, { status: 503 });
    }

    if (!global.chatMessagesDb[roomId]) {
      global.chatMessagesDb[roomId] = [];
    }

    if (action === "send") {
      const { message } = body;
      if (!message || typeof message !== "object" || typeof message.id !== "string") {
        return NextResponse.json({ error: "Missing or malformed message" }, { status: 400 });
      }
      if (JSON.stringify(message).length > MAX_MESSAGE_CHARS) {
        return NextResponse.json({ error: "Message too large" }, { status: 413 });
      }
      claimRoom(roomId, message.senderId);
      
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
        const userIndex = message.reactions[emoji].indexOf(username);
        if (userIndex > -1) {
          message.reactions[emoji].splice(userIndex, 1);
          if (message.reactions[emoji].length === 0) {
            delete message.reactions[emoji];
          }
        } else {
          message.reactions[emoji].push(username);
        }
      }
      return NextResponse.json({ success: true });
    } else if (action === "clear") {
      if (!isOwner(roomId, body.userId)) {
        return NextResponse.json({ error: "Only the room creator can clear this room" }, { status: 403 });
      }
      global.chatMessagesDb[roomId] = [];
      return NextResponse.json({ success: true });
    } else if (action === "pin") {
      const { msgId } = body;
      if (!msgId) {
        return NextResponse.json({ error: "Missing msgId" }, { status: 400 });
      }
      const messages = global.chatMessagesDb[roomId] || [];
      const message = messages.find(m => m.id === msgId);
      if (message) {
        message.isPinned = !message.isPinned;
      }
      return NextResponse.json({ success: true });
    } else if (action === "leave") {
      const { userId, username } = body;
      if (userId && global.chatAnalyticsDb && global.chatAnalyticsDb[roomId]) {
        const u = global.chatAnalyticsDb[roomId].presentUsers[userId];
        if (u) {
          global.chatAnalyticsDb[roomId].leftUsers[userId] = {
            username: u.username,
                leftAt: Date.now()
          };
          global.chatAnalyticsDb[roomId].joinHistory.push({
            username: u.username,
            type: "leave",
                timestamp: new Date().toISOString()
          });
          delete global.chatAnalyticsDb[roomId].presentUsers[userId];
        }
      }
      return NextResponse.json({ success: true });
    } else if (action === "delete_room") {
      if (!isOwner(roomId, body.userId)) {
        return NextResponse.json({ error: "Only the room creator can delete this room" }, { status: 403 });
      }
      delete global.chatMessagesDb[roomId];
      delete global.chatAnalyticsDb[roomId];
      delete global.chatRoomOwners[roomId];
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Chat API error:", err);
    if (err.status) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
