import { NextResponse } from "next/server";

if (!global.chatMessagesDb) {
  global.chatMessagesDb = {};
}

if (!global.chatAnalyticsDb) {
  global.chatAnalyticsDb = {};
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId");
  const userId = searchParams.get("userId");
  const username = searchParams.get("username");

  if (!roomId) {
    const activeRooms = Object.keys(global.chatMessagesDb || {});
    return NextResponse.json({ rooms: activeRooms });
  }

  // Determine client IP
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(/, /)[0] : "127.0.0.1";

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
    const wasPresent = !!roomAnalytics.presentUsers[userId];
    
    // Remove from leftUsers if they re-joined
    if (roomAnalytics.leftUsers[userId]) {
      delete roomAnalytics.leftUsers[userId];
    }

    // Update presence
    roomAnalytics.presentUsers[userId] = {
      username,
      ip,
      lastSeen: now
    };

    // If they were not present, record a join event in history
    if (!wasPresent) {
      roomAnalytics.joinHistory.push({
        username,
        type: "join",
        ip,
        timestamp: new Date().toISOString()
      });
      // Cap history
      if (roomAnalytics.joinHistory.length > 55) {
        roomAnalytics.joinHistory.shift();
      }
    }
  }

  // Scan for expired users (inactive for more than 8 seconds)
  Object.keys(roomAnalytics.presentUsers).forEach(uid => {
    const u = roomAnalytics.presentUsers[uid];
    if (now - u.lastSeen > 8000) {
      roomAnalytics.leftUsers[uid] = {
        username: u.username,
        ip: u.ip,
        leftAt: now
      };
      
      roomAnalytics.joinHistory.push({
        username: u.username,
        type: "leave",
        ip: u.ip,
        timestamp: new Date().toISOString()
      });
      
      delete roomAnalytics.presentUsers[uid];
    }
  });

  const messages = global.chatMessagesDb[roomId] || [];
  
  // Format lists for client response
  const present = Object.values(roomAnalytics.presentUsers).map(u => ({ username: u.username, ip: u.ip }));
  const left = Object.values(roomAnalytics.leftUsers).map(u => ({ username: u.username, ip: u.ip }));
  const history = roomAnalytics.joinHistory;

  return NextResponse.json({
    messages,
    analytics: {
      present,
      left,
      history,
      clientIp: ip
    }
  });
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
            ip: u.ip,
            leftAt: Date.now()
          };
          global.chatAnalyticsDb[roomId].joinHistory.push({
            username: u.username,
            type: "leave",
            ip: u.ip,
            timestamp: new Date().toISOString()
          });
          delete global.chatAnalyticsDb[roomId].presentUsers[userId];
        }
      }
      return NextResponse.json({ success: true });
    } else if (action === "delete_room") {
      delete global.chatMessagesDb[roomId];
      delete global.chatAnalyticsDb[roomId];
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
