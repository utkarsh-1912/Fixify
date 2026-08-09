"use client";

// Universal FixDrop Client Service for cross-app 1-click sharing
export async function shareToFixDrop({ pin = "7492", type = "text", content, name, size, dataUrl, sender = "Desk_Trader", senderId = null, isP2P = false, fileId = null, fileBlob = null }) {
  try {
    let res;
    if (fileBlob) {
      const formData = new FormData();
      formData.append("file", fileBlob, name || fileBlob.name || "file");
      formData.append("pin", pin);
      formData.append("sender", sender);
      if (senderId) formData.append("senderId", senderId);
      if (fileId) formData.append("fileId", fileId);
      if (size) formData.append("size", size);

      res = await fetch("/api/fixdrop", {
        method: "POST",
        body: formData
      });
    } else {
      res = await fetch("/api/fixdrop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, type, content, name, size, dataUrl, sender, senderId, isP2P, fileId })
      });
    }

    const data = await res.json();

    // 2. Broadcast to local BroadcastChannel for zero-latency local tab sync
    if (typeof window !== "undefined") {
      try {
        const channel = new BroadcastChannel("fixify-airshare-channel");
        channel.postMessage({ pin, action: "new_payload", payload: data.item });
        channel.close();
      } catch (e) {}

      // Dispatch local custom window event
      window.dispatchEvent(new CustomEvent("fixify-fixdrop-broadcast", { detail: data.item }));
    }

    return data;
  } catch (error) {
    console.warn("FixDrop broadcast error:", error);
    return { success: false, error: error.message };
  }
}

export async function fetchFixDropRoom(pin = "7492") {
  try {
    const res = await fetch(`/api/fixdrop?pin=${pin}`);
    return await res.json();
  } catch (error) {
    return { success: false, items: [] };
  }
}

export async function sendWebRTCSignal({ pin = "7492", sender = "Device_Peer", signal }) {
  try {
    const res = await fetch("/api/fixdrop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signal", pin, sender, signal })
    });
    return await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function fetchWebRTCSignals(pin = "7492", peerId = "") {
  try {
    const res = await fetch(`/api/fixdrop?pin=${pin}&action=signal&peerId=${peerId}`);
    return await res.json();
  } catch (e) {
    return { success: false, signals: [] };
  }
}
