"use client";

// Universal FixDrop Client Service for cross-app 1-click sharing
export async function shareToFixDrop({ pin = "7492", type = "text", content, name, size, dataUrl, sender = "Desk_Trader" }) {
  try {
    // Safely guard API payload size (truncate heavy dataUrls > 3MB for API POST relay to prevent HTTP 413)
    const apiDataUrl = dataUrl && dataUrl.length > 3 * 1024 * 1024 ? dataUrl.slice(0, 100) + "...[TRUNCATED_FOR_RELAY]" : dataUrl;

    // 1. Post to Universal Next.js API Relay
    const res = await fetch("/api/fixdrop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, type, content, name, size, dataUrl: apiDataUrl, sender })
    });

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

export async function fetchWebRTCSignals(pin = "7492") {
  try {
    const res = await fetch(`/api/fixdrop?pin=${pin}&action=signal`);
    return await res.json();
  } catch (e) {
    return { success: false, signals: [] };
  }
}
