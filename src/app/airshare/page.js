"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  Shredder,
  UploadCloud,
  FileText,
  FileCode,
  Trash2,
  Copy,
  Check,
  Download,
  QrCode,
  Image,
  ArrowRightLeftIcon,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  GitCompare,
  Brain,
  FileSpreadsheet,
  FileType,
  Presentation,
  FileCheck,
  X,
  Plus,
  Send,
  Sliders,
  CheckCircle2,
  Lock,
  Loader2,
  Info,
  Play,
  Pause,
  ExternalLink
} from "lucide-react";
import { validateFIXMessage } from "@/lib/fixParser";
import { shareToFixDrop, fetchFixDropRoom, fetchWebRTCSignals, sendWebRTCSignal } from "@/lib/fixDropService";



function getFileMeta(filename) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) {
    return { label: "PDF", icon: FileText };
  }
  if (["doc", "docx"].includes(ext)) {
    return { label: "WORD", icon: FileType };
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return { label: "EXCEL", icon: FileSpreadsheet };
  }
  if (["ppt", "pptx"].includes(ext)) {
    return { label: "POWERPOINT", icon: Presentation };
  }
  if (["png", "jpg", "jpeg", "svg"].includes(ext)) {
    return { label: "IMAGE", icon: Image };
  }
  if (["xml", "json", "pcap", "log", "fix"].includes(ext)) {
    return { label: ext.toUpperCase(), icon: FileCode };
  }
  return { label: ext.toUpperCase() || "FILE", icon: FileCheck };
}

export default function AirSharePage() {
  const [stage, setStage] = useState(1);
  const [inputMode, setInputMode] = useState("file");
  const [payloadText, setPayloadText] = useState("");
  const [stagedFiles, setStagedFiles] = useState([]);
  const [autoSanitize, setAutoSanitize] = useState(true);
  const [pinCode, setPinCode] = useState("7492");
  const [sharedItems, setSharedItems] = useState([]);
  const bundledItems = useMemo(() => {
    const bundles = [];
    let currentBundle = null;

    const getBaseSender = (sender) => {
      if (!sender) return "Device";
      return sender.split(" (")[0].trim();
    };

    for (const item of sharedItems) {
      const itemSenderId = item.senderId || null;
      const itemBaseSender = getBaseSender(item.sender);
      const currentBaseSender = currentBundle ? getBaseSender(currentBundle.sender) : null;

      if (currentBundle && currentBaseSender === itemBaseSender && (currentBundle.senderId === itemSenderId || !currentBundle.senderId || !itemSenderId)) {
        currentBundle.items.push(item);
      } else {
        currentBundle = {
          id: item.id,
          sender: item.sender,
          senderId: itemSenderId,
          timestamp: item.timestamp,
          items: [item]
        };
        bundles.push(currentBundle);
      }
    }
    return bundles;
  }, [sharedItems]);
  const [copiedId, setCopiedId] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [downloadedFiles, setDownloadedFiles] = useState({});
  const [qrSvgString, setQrSvgString] = useState("");
  const stagedFileObjects = useRef({});
  const activePeerConnections = useRef({});
  const activeDataChannels = useRef({});
  const activeSendNextChunk = useRef({});
  const [p2pTransfer, setP2pTransfer] = useState(null);
  const myPeerId = useRef(typeof window !== "undefined" ? (() => {
    let id = localStorage.getItem("fixify-peer-id");
    if (!id) {
      id = "peer_" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("fixify-peer-id", id);
    }
    return id;
  })() : "runner");
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const pausedTransfers = useRef({});
  const speedTimeRef = useRef(Date.now());
  const speedBytesRef = useRef(0);

  const toggleP2PPause = () => {
    if (!p2pTransfer) return;
    const { itemId, mode, status } = p2pTransfer;
    const isPaused = status === "paused";
    const nextStatus = isPaused ? "transferring" : "paused";

    if (mode === "send") {
      pausedTransfers.current[itemId] = !isPaused;
      setP2pTransfer(prev => prev ? { ...prev, status: nextStatus } : null);
      if (isPaused) {
        const fn = activeSendNextChunk.current[itemId];
        if (fn) fn();
      }
      Object.values(activeDataChannels.current).forEach(channel => {
        if (channel.readyState === "open") {
          try {
            channel.send(JSON.stringify({ type: isPaused ? "resume" : "pause", itemId }));
          } catch (e) {}
        }
      });
    } else {
      Object.values(activeDataChannels.current).forEach(channel => {
        if (channel.readyState === "open") {
          try {
            channel.send(JSON.stringify({ type: isPaused ? "resume" : "pause", itemId }));
          } catch (e) {}
        }
      });
      setP2pTransfer(prev => prev ? { ...prev, status: nextStatus } : null);
    }
  };

  const playPing = () => {
    if (typeof window === "undefined") return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {}
  };

  const peerConnectionConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "stun:stun.services.mozilla.com" }
    ]
  };

  const handleIncomingSignal = async (envelope) => {
    const { signal, sender: remotePeerId } = envelope;
    if (remotePeerId === myPeerId.current) return;

    const { type, itemId, sdp, candidate } = signal;

    if (type === "offer") {
      const file = stagedFileObjects.current[itemId];
      if (!file) {
        console.warn(`[P2P] Offer received for file ${itemId}, but file buffer is not in sender memory.`);
        await sendWebRTCSignal({
          pin: pinCode,
          sender: myPeerId.current,
          signal: { type: "error", itemId, message: "File memory buffer unavailable on sender tab", targetPeerId: remotePeerId }
        });
        return;
      }

      console.log(`[P2P] Received offer for file ${itemId} from peer ${remotePeerId}`);
      const pc = new RTCPeerConnection(peerConnectionConfig);
      activePeerConnections.current[remotePeerId] = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWebRTCSignal({
            pin: pinCode,
            sender: myPeerId.current,
            signal: { type: "candidate", itemId, candidate: event.candidate, targetPeerId: remotePeerId }
          });
        }
      };

      pc.ondatachannel = (event) => {
        const channel = event.channel;
        channel.bufferedAmountLowThreshold = 65536;
        activeDataChannels.current[remotePeerId] = channel;
        setupSenderDataChannel(channel, file, itemId);
      };

      await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendWebRTCSignal({
        pin: pinCode,
        sender: myPeerId.current,
        signal: { type: "answer", itemId, sdp: answer.sdp, targetPeerId: remotePeerId }
      });
    }
    else if (type === "answer" && signal.targetPeerId === myPeerId.current) {
      const pc = activePeerConnections.current[remotePeerId];
      if (pc) {
        console.log(`[P2P] Received answer from peer ${remotePeerId}`);
        await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp }));
      }
    }
    else if (type === "candidate" && signal.targetPeerId === myPeerId.current) {
      const pc = activePeerConnections.current[remotePeerId];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn("[P2P] Error adding ICE candidate", e);
        }
      }
    }
    else if (type === "error" && signal.targetPeerId === myPeerId.current) {
      console.warn(`[P2P] Signal error received from peer ${remotePeerId}:`, signal.message);
      setP2pTransfer(prev => prev ? { ...prev, status: "failed" } : null);
      setTimeout(() => setP2pTransfer(null), 4000);
    }
  };

  const setupSenderDataChannel = (channel, file, fileId) => {
    channel.binaryType = "arraybuffer";
    let offset = 0;
    const chunkSize = 65536; // 64KB optimal chunk size
    channel.bufferedAmountLowThreshold = chunkSize;

    const sendNextChunk = () => {
      if (pausedTransfers.current[fileId]) return;

      while (offset < file.size && channel.bufferedAmount <= channel.bufferedAmountLowThreshold) {
        if (channel.readyState !== "open") return;

        const slice = file.slice(offset, offset + chunkSize);
        channel.send(slice);
        offset += slice.size;

        const now = Date.now();
        const timeDiff = now - speedTimeRef.current;
        let speedMB = "";
        let etaStr = "";
        if (timeDiff >= 1000) {
          const bytesDiff = offset - speedBytesRef.current;
          const bps = (bytesDiff / timeDiff) * 1000;
          speedMB = (bps / (1024 * 1024)).toFixed(1) + " MB/s";
          const remaining = file.size - offset;
          const etaSec = bps > 0 ? Math.ceil(remaining / bps) : 0;
          etaStr = etaSec > 0 ? `${Math.floor(etaSec / 60)}m ${etaSec % 60}s` : "0s";
          
          speedTimeRef.current = now;
          speedBytesRef.current = offset;
        }

        const isDone = offset >= file.size;
        if (isDone) {
          playPing();
        }

        setP2pTransfer(prev => ({
          itemId: fileId,
          mode: "send",
          fileName: file.name,
          size: file.size > 1024 * 1024 ? (file.size / (1024 * 1024)).toFixed(2) + " MB" : (file.size / 1024).toFixed(1) + " KB",
          progress: Math.min(Math.floor((offset / file.size) * 100), 100),
          status: isDone ? "completed" : "transferring",
          speed: speedMB || (prev?.speed || "0 MB/s"),
          eta: etaStr || (prev?.eta || "Calculating...")
        }));
      }

      if (offset >= file.size) {
        try {
          channel.send(JSON.stringify({ type: "EOF", fileId, exactSize: file.size }));
          console.log(`[P2P] Sender transmitted EOF control signal for ${file.name}`);
        } catch (e) {}
        setTimeout(() => {
          try { channel.close(); } catch (e) {}
          setP2pTransfer(null);
        }, 3000);
      }
    };

    channel.onopen = () => {
      console.log("[P2P] Sender DataChannel is open!");
      activeSendNextChunk.current[fileId] = sendNextChunk;
      sendNextChunk();
    };

    if (channel.readyState === "open") {
      console.log("[P2P] Sender DataChannel is already open!");
      activeSendNextChunk.current[fileId] = sendNextChunk;
      sendNextChunk();
    }

    channel.onbufferedamountlow = () => {
      sendNextChunk();
    };

    channel.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "pause") {
            pausedTransfers.current[fileId] = true;
            setP2pTransfer(prev => prev ? { ...prev, status: "paused" } : null);
          } else if (msg.type === "resume") {
            pausedTransfers.current[fileId] = false;
            setP2pTransfer(prev => prev ? { ...prev, status: "transferring" } : null);
            sendNextChunk();
          }
        } catch (e) {
          console.warn(e);
        }
      }
    };

    channel.onerror = (err) => {
      console.error("[P2P] DataChannel error", err);
      setP2pTransfer(prev => prev ? { ...prev, status: "failed" } : null);
    };
  };

  const handleP2PDownload = async (item) => {
    console.log(`[P2P] Starting peer download request for ${item.name} (${item.size})`);
    
    setP2pTransfer({
      itemId: item.id,
      mode: "receive",
      fileName: item.name,
      size: item.size,
      progress: 0,
      status: "connecting",
      speed: "0 MB/s",
      eta: "Calculating..."
    });

    const pc = new RTCPeerConnection(peerConnectionConfig);
    const remotePeerId = item.senderId || ("sender_" + Math.random().toString(36).substring(2, 6));
    activePeerConnections.current[remotePeerId] = pc;

    const channel = pc.createDataChannel("p2p-file-transfer");
    channel.bufferedAmountLowThreshold = 65536;
    activeDataChannels.current[remotePeerId] = channel;

    const receivedChunks = [];
    let receivedSize = 0;
    
    let totalBytes = 0;
    if (item.size.includes("MB")) {
      totalBytes = parseFloat(item.size) * 1024 * 1024;
    } else if (item.size.includes("GB")) {
      totalBytes = parseFloat(item.size) * 1024 * 1024 * 1024;
    } else {
      totalBytes = parseFloat(item.size) * 1024;
    }

    speedTimeRef.current = Date.now();
    speedBytesRef.current = 0;

    channel.binaryType = "arraybuffer";
    channel.onopen = () => {
      console.log("[P2P] Receiver DataChannel is open!");
      setP2pTransfer(prev => prev ? { ...prev, status: "transferring" } : null);
    };

    if (channel.readyState === "open") {
      setP2pTransfer(prev => prev ? { ...prev, status: "transferring" } : null);
    }

    pc.onconnectionstatechange = () => {
      console.log("[P2P] PeerConnection state:", pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setP2pTransfer(prev => prev ? { ...prev, status: "failed" } : null);
        setTimeout(() => setP2pTransfer(null), 4000);
      }
    };

    let downloadCompleted = false;

    const finishDownload = () => {
      if (downloadCompleted || receivedChunks.length === 0) return;
      downloadCompleted = true;
      console.log(`[P2P] Finalizing download for ${item.name} (${receivedChunks.length} chunks)...`);

      playPing();
      setP2pTransfer({
        itemId: item.id,
        mode: "receive",
        fileName: item.name,
        size: item.size,
        progress: 100,
        status: "completed",
        speed: "0 MB/s",
        eta: "0s"
      });

      const blob = new Blob(receivedChunks, { type: item.type || "application/octet-stream" });
      const url = URL.createObjectURL(blob);

      // Trigger automatic file download prompt on receiving device
      const a = document.createElement("a");
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Store in downloadedFiles so receiver can click "Open File" anytime
      setDownloadedFiles(prev => ({
        ...prev,
        [item.id]: { url, name: item.name, blob }
      }));

      setTimeout(() => setP2pTransfer(null), 4000);
    };

    channel.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === "EOF") {
            console.log("[P2P] Received EOF signal from sender! Auto-downloading file...");
            finishDownload();
            return;
          }
        } catch (e) {}
      }

      receivedChunks.push(event.data);
      receivedSize += event.data.byteLength;
      
      const now = Date.now();
      const timeDiff = now - speedTimeRef.current;
      let speedMB = "";
      let etaStr = "";
      if (timeDiff >= 1000) {
        const bytesDiff = receivedSize - speedBytesRef.current;
        const bps = (bytesDiff / timeDiff) * 1000;
        speedMB = (bps / (1024 * 1024)).toFixed(1) + " MB/s";
        const remaining = totalBytes - receivedSize;
        const etaSec = bps > 0 ? Math.ceil(remaining / bps) : 0;
        etaStr = etaSec > 0 ? `${Math.floor(etaSec / 60)}m ${etaSec % 60}s` : "0s";
        
        speedTimeRef.current = now;
        speedBytesRef.current = receivedSize;
      }

      const percent = totalBytes > 0 ? Math.min(Math.floor((receivedSize / totalBytes) * 99), 99) : 0;
      setP2pTransfer(prev => ({
        itemId: item.id,
        mode: "receive",
        fileName: item.name,
        size: item.size,
        progress: percent,
        status: "transferring",
        speed: speedMB || (prev?.speed || "0 MB/s"),
        eta: etaStr || (prev?.eta || "Calculating...")
      }));
    };

    channel.onclose = () => {
      console.log("[P2P] Receiver DataChannel closed.");
      finishDownload();
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendWebRTCSignal({
          pin: pinCode,
          sender: myPeerId.current,
          signal: { type: "candidate", itemId: item.id, candidate: event.candidate, targetPeerId: remotePeerId }
        });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await sendWebRTCSignal({
      pin: pinCode,
      sender: myPeerId.current,
      signal: { type: "offer", itemId: item.id, sdp: offer.sdp, targetPeerId: remotePeerId }
    });
  };

  useEffect(() => {
    if (typeof window === "undefined" || stage !== 3) return;

    const interval = setInterval(async () => {
      const res = await fetchWebRTCSignals(pinCode, myPeerId.current);
      if (res?.success && res.signals && res.signals.length > 0) {
        for (const sig of res.signals) {
          handleIncomingSignal(sig);
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [stage, pinCode]);

  const roomLink = typeof window !== "undefined" ? `${window.location.origin}/airshare?pin=${pinCode}` : `https://fixify.app/airshare?pin=${pinCode}`;

  // Generate spec-compliant QR Code SVG string dynamically when modal is shown
  useEffect(() => {
    if (!showQrModal) return;
    try {
      const qrCodeLib = require("qrcode");
      qrCodeLib.toString(roomLink, { type: "svg", margin: 1, width: 160 }, (err, svg) => {
        if (!err) {
          setQrSvgString(svg);
        }
      });
    } catch (e) {
      console.error(e);
    }
  }, [roomLink, showQrModal]);

  // Auto-connect to room PIN from URL query param `?pin=XXXX` (e.g. when mobile scans QR code)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlPin = params.get("pin");
      if (urlPin) {
        setPinCode(urlPin);
        // Pre-fetch room items and switch to Stage 3 directly if there are active items
        fetchFixDropRoom(urlPin).then((res) => {
          if (res?.success && res.items && res.items.length > 0) {
            setSharedItems(res.items);
            setStage(3);
          }
        });
      }
    } catch (e) {}
  }, []);

  // Poll backend API & BroadcastChannel for real-time live room updates
  useEffect(() => {
    if (typeof window === "undefined") return;

    let isMounted = true;
    const syncRoomData = async () => {
      const res = await fetchFixDropRoom(pinCode);
      if (res?.success && Array.isArray(res.items) && isMounted) {
        setSharedItems((prev) => {
          const itemMap = new Map();
          // First add all incoming items from server response
          res.items.forEach((item) => {
            if (item && item.id) itemMap.set(item.id, item);
          });
          // Preserve any local in-flight items that may not be in GET response yet
          prev.forEach((item) => {
            if (item && item.id && !itemMap.has(item.id)) {
              itemMap.set(item.id, item);
            }
          });
          return Array.from(itemMap.values());
        });
      }
    };

    syncRoomData();
    const interval = setInterval(syncRoomData, 3000);

    let channel;
    try {
      channel = new BroadcastChannel("fixify-airshare-channel");
      channel.onmessage = () => syncRoomData();
    } catch (e) {}

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (channel) channel.close();
    };
  }, [pinCode]);

  // If Room Stream becomes empty while on Stage 3, auto-switch back to Stage 1 (Input)
  useEffect(() => {
    if (stage === 3 && sharedItems.length === 0) {
      setStage(1);
    }
  }, [sharedItems.length, stage]);

  const generateNewPin = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setPinCode(code);
  };

  const onDrop = useCallback((acceptedFiles) => {
    acceptedFiles.forEach((file) => {
      const fileId = "file_" + Date.now().toString() + "_" + Math.random().toString(36).substring(2, 9) + "_" + Math.floor(Math.random() * 10000);
      stagedFileObjects.current[fileId] = file;

      // If file is larger than 4MB, register it as a WebRTC P2P stream instead of reading it in RAM
      if (file.size > 4 * 1024 * 1024) {
        stagedFileObjects.current[fileId] = file;
        const fileObj = {
          id: fileId,
          name: file.name,
          size: file.size > 1024 * 1024 * 1024
            ? (file.size / (1024 * 1024 * 1024)).toFixed(2) + " GB"
            : (file.size / (1024 * 1024)).toFixed(2) + " MB",
          type: file.type || "application/octet-stream",
          dataUrl: null, // transferred P2P
          isP2P: true,
          meta: getFileMeta(file.name)
        };
        setStagedFiles((prev) => [...prev, fileObj]);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const fileObj = {
            id: fileId,
            name: file.name,
            size: file.size > 1024 * 1024 ? (file.size / (1024 * 1024)).toFixed(2) + " MB" : (file.size / 1024).toFixed(1) + " KB",
            type: file.type || "application/octet-stream",
            dataUrl: event.target.result,
            rawFile: file,
            isP2P: false,
            meta: getFileMeta(file.name)
          };
          setStagedFiles((prev) => [...prev, fileObj]);
        };
        reader.readAsDataURL(file);
      }
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 1024 * 1024 * 1024, // 1 GB max file size limit
    onDropRejected: (fileRejections) => {
      fileRejections.forEach((rejection) => {
        const tooLarge = rejection.errors.some((e) => e.code === "file-too-large");
        if (tooLarge) {
          alert(`File "${rejection.file.name}" exceeds the 1 GB file size limit.`);
        } else {
          alert(`File "${rejection.file.name}" was rejected. Please select valid documents or FIX log files.`);
        }
      });
    },
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/csv": [".csv"],
      "application/vnd.ms-powerpoint": [".ppt"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "text/plain": [".txt", ".log", ".fix"],
      "text/xml": [".xml"],
      "application/json": [".json"],
      "application/octet-stream": [".pcap"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/svg+xml": [".svg"]
    }
  });

  const sanitizeText = (text) => {
    return text
      .replace(/55=\w+/g, "55=***")
      .replace(/1=\w+/g, "1=ACCT_MASKED")
      .replace(/50=\w+/g, "50=USER_MASKED")
      .replace(/57=\w+/g, "57=DEST_MASKED");
  };

  const handleDownloadBatchZip = async () => {
    try {
      const JSZip = require("jszip");
      const zip = new JSZip();
      
      const selectedItems = sharedItems.filter(item => selectedItemIds.includes(item.id) && item.type === "file");
      if (selectedItems.length === 0) {
        alert("Select at least one standard file (non-P2P) to package into a ZIP.");
        return;
      }

      for (const item of selectedItems) {
        if (item.isP2P) {
          alert(`File "${item.name}" is a P2P stream and cannot be packaged in a client-side ZIP. Please download it individually.`);
          return;
        }
        
        if (!item.dataUrl) continue;
        const parts = item.dataUrl.split(",");
        if (parts.length < 2) continue;
        const base64Data = parts[1];
        zip.file(item.name, base64Data, { base64: true });
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `FixDrop_Batch_${pinCode}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setSelectedItemIds([]);
    } catch (e) {
      console.error(e);
      alert("Error packaging ZIP file: " + e.message);
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      const res = await fetch(`/api/fixdrop?pin=${pinCode}&itemId=${itemId}&senderId=${myPeerId.current}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        setSharedItems((prev) => prev.filter((i) => i.id !== itemId));
        setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
      } else {
        alert(data.error || "Failed to delete item.");
      }
    } catch (e) {
      console.error(e);
      alert("Error deleting item: " + e.message);
    }
  };

  const getDeviceName = () => {
    if (typeof window === "undefined" || !window.navigator) return "Trader Desk";
    const ua = window.navigator.userAgent;
    if (ua.includes("Windows")) return "Windows PC";
    if (ua.includes("Macintosh")) return "MacBook";
    if (ua.includes("iPhone")) return "iPhone";
    if (ua.includes("iPad")) return "iPad";
    if (ua.includes("Android")) return "Android Mobile";
    if (ua.includes("Linux")) return "Linux Machine";
    return "Trader Desk";
  };

  const processAndBroadcast = async () => {
    if (isBroadcasting) return;
    setIsBroadcasting(true);

    try {
      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const newBroadcasts = [];
      const deviceName = getDeviceName();

      if (inputMode === "paste" && payloadText.trim()) {
        let finalContent = payloadText.trim();
        if (autoSanitize) finalContent = sanitizeText(finalContent);
        const parsed = validateFIXMessage(finalContent);

        const item = {
          id: Date.now().toString(),
          type: "text",
          sender: deviceName,
          senderId: myPeerId.current,
          timestamp,
          content: finalContent,
          isFix: parsed?.isValid || false,
          msgType: parsed?.msgTypeName || null
        };

        newBroadcasts.push(item);
        await shareToFixDrop({ pin: pinCode, type: "text", content: finalContent, sender: deviceName, senderId: myPeerId.current });
      }

      if (inputMode === "file" && stagedFiles.length > 0) {
        const uploadPromises = stagedFiles.map(async (file) => {
          const item = {
            id: file.id,
            type: "file",
            sender: deviceName,
            senderId: myPeerId.current,
            timestamp,
            name: file.name,
            size: file.size,
            dataUrl: file.dataUrl,
            isP2P: file.isP2P || false,
            fileId: file.id,
            meta: file.meta
          };
          const broadcastResult = await shareToFixDrop({
            pin: pinCode,
            type: "file",
            name: file.name,
            size: file.size,
            dataUrl: file.dataUrl,
            fileBlob: file.rawFile || null,
            sender: deviceName,
            senderId: myPeerId.current,
            isP2P: file.isP2P || false,
            fileId: file.id
          });
          if (broadcastResult?.item) {
            item.sender = broadcastResult.item.sender || item.sender;
            item.dataUrl = broadcastResult.item.dataUrl || item.dataUrl;
          }
          return item;
        });

        const uploadedItems = await Promise.all(uploadPromises);
        newBroadcasts.push(...uploadedItems);
      }

      setSharedItems((prev) => [...newBroadcasts, ...prev]);
      setPayloadText("");
      setStagedFiles([]);
      setShowAddModal(false);
      setStage(3);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyLink = () => {
    const link = typeof window !== "undefined" ? `${window.location.origin}/airshare?pin=${pinCode}` : `https://fixify.app/airshare?pin=${pinCode}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const loadSampleData = () => {
    setPayloadText("8=FIX.4.4|9=145|35=D|49=DESK_NY|56=EXECUTOR|34=1022|52=20260809-12:35:00.100|11=ORD_9910|55=AAPL|54=1|38=1000|44=225.50|10=188|");
    setInputMode("paste");
  };

  return (
    <div className="fx-page space-y-6 max-w-5xl mx-auto">

      {/* Header Banner matching Fixify global design system */}
      <div className="fx-page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
            <span>FixDrop Instant Transfer</span>
            <button
              onClick={() => setInfoModalOpen(true)}
              className="p-1 rounded-lg transition-all hover:scale-110 cursor-pointer flex items-center justify-center"
              style={{ color: "var(--text-muted)" }}
              title="FixDrop Information & Usage Guide"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Staged cross-device sharing for FIX logs, Word, PDF, Excel, and PCAP captures over Wi-Fi & WebRTC.
          </p>
        </div>

        {/* Top Right Controls: Refresh -> Reset -> Separator -> QR -> Separator -> Room PIN */}
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          {/* 1. Refresh PIN Button */}
          <button
            onClick={generateNewPin}
            className="p-1.5 rounded-lg transition-all hover:scale-105 cursor-pointer flex items-center justify-center"
            style={{ color: "var(--foreground)" }}
            title="Refresh Room PIN"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* 2. Reset Room Button */}
          <button
            onClick={() => setSharedItems([])}
            className="p-1.5 rounded-lg transition-all hover:scale-105 cursor-pointer flex items-center justify-center"
            style={{ color: "var(--text-muted)" }}
            title="Reset Room Payloads & Files"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {/* Separator 1 */}
          <div className="h-4 w-px" style={{ background: "var(--border)" }} />

          {/* 3. QR Code Button (Icon only, no text) */}
          <button
            onClick={() => setShowQrModal(true)}
            className="p-1.5 rounded-lg transition-all hover:scale-105 cursor-pointer flex items-center justify-center"
            style={{ background: "var(--primary-faint)", color: "var(--primary)" }}
            title="Scan Mobile QR Code"
          >
            <QrCode className="h-4 w-4" />
          </button>

          {/* Separator 2 */}
          <div className="h-4 w-px" style={{ background: "var(--border)" }} />

          {/* 4. Room PIN Badge & Connection Controller */}
          <div className="flex items-center gap-1.5 px-1 font-mono text-xs">
            <span style={{ color: "var(--text-muted)" }}>Room:</span>
            <input
              type="text"
              maxLength={4}
              value={pinCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                setPinCode(val);
              }}
              placeholder="PIN"
              className="w-12 text-center font-bold font-mono outline-none rounded border py-0.5"
              style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--primary)" }}
            />
          </div>
        </div>
      </div>

      {/* STAGE 1: INPUT PAYLOAD (EXACT CARD ARCHITECTURE FROM /latency) */}
      {stage === 1 && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div
            className="rounded-xl overflow-hidden animate-fade-in"
            style={{ border: "1px solid var(--border)", background: "var(--card)" }}
          >
            {/* Top Card Navigation Bar matching /latency */}
            <div
              className="px-5 py-3.5 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}
            >
              <div className="fx-tab-group">
                <button
                  className={`fx-tab${inputMode === "file" ? " active" : ""}`}
                  onClick={() => setInputMode("file")}
                >
                  <UploadCloud className="h-3.5 w-3.5" /> <span className="hidden sm:inline">File</span>
                </button>
                <button
                  className={`fx-tab${inputMode === "paste" ? " active" : ""}`}
                  onClick={() => setInputMode("paste")}
                >
                  <FileText className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Paste logs</span>
                </button>
              </div>

              <button
                onClick={async () => {
                const res = await fetchFixDropRoom(pinCode);
                if (res?.success && res.items && res.items.length > 0) {
                  setSharedItems(res.items);
                  setStage(3);
                } else {
                  alert(`No active items found in room #${pinCode}. Ensure another device has uploaded to it first.`);
                }
              }}
                className="fx-btn-primary py-1 px-3 text-[10px] flex items-center gap-1.5 cursor-pointer"
                title="Join Room & Load Active Items from Another Device"
              >
                <ArrowRightLeftIcon className="h-3.5 w-3.5 animate-pulse" />
                <span className="hidden sm:inline">Join Room</span>
              </button>
            </div>

            {/* Inner Dropzone / Paste Area matching /latency */}
            <div className="p-6">
              {inputMode === "file" ? (
                <div className="space-y-4">
                  <div
                    {...getRootProps()}
                    className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all"
                    style={{
                      borderColor: isDragActive ? "var(--primary)" : "var(--border)",
                      background: isDragActive ? "var(--primary-faint)" : "var(--background)"
                    }}
                  >
                    <input {...getInputProps()} />
                    <UploadCloud
                      className="h-10 w-10 mx-auto mb-3"
                      style={{ color: isDragActive ? "var(--primary)" : "var(--text-muted)" }}
                    />
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Drag & drop trading session logs & documents
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Supports .txt · .fix · .log · .pdf ·{" "}
                      <span
                        className="cursor-help"
                        style={{ color: "var(--primary)" }}
                        title="Word (.docx) · Excel (.xlsx) · PowerPoint (.pptx) · Network Packet (.pcap) · Images (.png, .jpg, .jpeg, .svg)"
                      >
                        +8 more
                      </span>
                    </p>
                  </div>

                  {/* Staged Files List */}
                  {stagedFiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Queued Files ({stagedFiles.length})</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {stagedFiles.map((file, idx) => (
                          <div key={file.id} className="p-3 rounded-xl border flex items-center justify-between gap-3" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0" style={{ background: "var(--primary-faint)", borderColor: "var(--primary-border)", color: "var(--primary)" }}>
                                {file.meta.label}
                              </span>
                              <span className="text-xs font-semibold truncate" style={{ color: "var(--foreground)" }}>{file.name}</span>
                            </div>
                            <button
                              onClick={() => setStagedFiles(stagedFiles.filter((_, i) => i !== idx))}
                              className="p-1 rounded transition-colors"
                              style={{ color: "var(--text-muted)" }}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={payloadText}
                    onChange={(e) => setPayloadText(e.target.value)}
                    placeholder="Paste FIX logs with tags, JSON, code snippet, or notes..."
                    className="w-full h-64 p-4 rounded-xl resize-none text-xs font-mono outline-none"
                    style={{
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)"
                    }}
                    onFocus={e => e.target.style.borderColor = "var(--primary)"}
                    onBlur={e => e.target.style.borderColor = "var(--border)"}
                  />
                </div>
              )}
            </div>

            {/* Bottom Card Action Footer */}
            <div
              className="px-5 py-3.5 flex items-center justify-end"
              style={{ borderTop: "1px solid var(--border)", background: "var(--background)" }}
            >
              <button
                onClick={() => setStage(2)}
                disabled={(inputMode === "file" && stagedFiles.length === 0) || (inputMode === "paste" && !payloadText.trim())}
                className="fx-btn-primary py-2 px-6 text-xs flex items-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                <span className="hidden sm:inline">Next: Process Payload</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 2: PROCESS & REVIEW */}
      {stage === 2 && (
        <div className="p-6 rounded-2xl border space-y-6 animate-fadeIn" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
              <Sliders className="h-4 w-4" style={{ color: "var(--primary)" }} />
              Process & Sanitize Payload Options
            </h2>
            <button onClick={() => setStage(1)} className="text-xs flex items-center gap-1 cursor-pointer" style={{ color: "var(--text-muted)" }}>
              <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Back to Input</span>
            </button>
          </div>

          <div className="space-y-4">
            {/* Sanitize Toggle */}
            <div className="p-4 rounded-xl border flex items-center justify-between" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
              <div className="space-y-0.5">
                <div className="text-xs font-bold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                  <ShieldCheck className="h-4 w-4" style={{ color: "var(--primary)" }} /> Auto-Sanitize Sensitive PII & Account Keys
                </div>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Automatically masks FIX tags 1 (Account), 50 (SenderSubID), and 57 (TargetSubID).</p>
              </div>
              <input
                type="checkbox"
                checked={autoSanitize}
                onChange={(e) => setAutoSanitize(e.target.checked)}
                className="h-4 w-4 rounded cursor-pointer"
              />
            </div>

            {/* Payload Preview */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Payload Summary</div>
              {inputMode === "paste" ? (
                <div className="p-4 rounded-xl border font-mono text-xs break-all max-h-32 overflow-y-auto fx-custom-scroll" style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
                  {autoSanitize ? sanitizeText(payloadText) : payloadText}
                </div>
              ) : (
                <div className="p-4 rounded-xl border text-xs font-mono" style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
                  {stagedFiles.length} file(s) queued: {stagedFiles.map((f) => f.name).join(", ")}
                </div>
              )}
            </div>
          </div>

          {/* Broadcast Action Button */}
          <div className="flex justify-end pt-2 gap-3">
            <button onClick={() => setStage(1)} className="px-4 py-2 text-xs font-semibold cursor-pointer" style={{ color: "var(--text-muted)" }}>
              Cancel
            </button>
            <button
              onClick={processAndBroadcast}
              disabled={isBroadcasting}
              className="fx-btn-primary py-2 px-6 text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBroadcasting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Broadcasting...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Broadcast to Room</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STAGE 3: ACTIVE AIRSHARE ROOM */}
      {stage === 3 && (
        <div className="space-y-4 animate-fadeIn">
          
          <div className="flex flex-row sm:items-center justify-between gap-3 px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
              <CheckCircle2 className="h-4 w-4" style={{ color: "var(--primary)" }} /> Active Payload Stream ({sharedItems.length})
            </h2>
            <div className="flex items-center gap-2">
              {selectedItemIds.length > 0 && (
                <button
                  onClick={handleDownloadBatchZip}
                  className="fx-btn-primary py-1 px-3 text-xs flex items-center gap-1.5 cursor-pointer animate-fadeIn"
                  style={{ background: "#10b981", borderColor: "#10b981" }}
                >
                  <Download className="h-3.5 w-3.5" /> <span>Download ZIP ({selectedItemIds.length})</span>
                </button>
              )}
              <button onClick={() => setShowAddModal(true)} className="fx-btn-primary py-1 px-3 text-xs flex items-center gap-1.5 cursor-pointer">
                <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Share New Item</span>
              </button>
            </div>
          </div>

          {sharedItems.length === 0 ? (
            <div className="p-12 rounded-2xl border text-center space-y-3" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <Shredder className="h-8 w-8 mx-auto" style={{ color: "var(--text-muted)" }} />
              <h3 className="text-xs font-bold" style={{ color: "var(--foreground)" }}>Room Stream Empty</h3>
              <button onClick={() => setShowAddModal(true)} className="fx-btn-primary py-1.5 px-4 text-xs cursor-pointer">
                Share New Item
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {bundledItems.map((bundle) => (
                <div
                  key={bundle.id}
                  className="p-4 rounded-2xl border space-y-3 transition-all animate-fadeIn"
                  style={{ background: "var(--card)", borderColor: "var(--border)" }}
                >
                  {/* Bundle Header */}
                  <div className="flex items-center justify-between text-xs pb-2 border-b" style={{ borderColor: "var(--border)" }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[13px]" style={{ color: "var(--foreground)" }}>{bundle.sender}</span>
                      <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{bundle.timestamp}</span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--background)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                        {bundle.items.length} {bundle.items.length === 1 ? "item" : "items"}
                      </span>
                    </div>
                  </div>

                  {/* Bundle Items List */}
                  <div className="space-y-3 pt-1">
                    {bundle.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 md:p-2.5 rounded-xl border md:border-0 md:border-b last:border-b-0 space-y-2.5 md:space-y-0 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs transition-all"
                        style={{ background: "var(--background)", borderColor: "var(--border)" }}
                      >
                        {/* Left / Top Section: Checkbox, Icon, Filename, Size, Badges */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {item.type === "file" && !item.isP2P && (
                            <input
                              type="checkbox"
                              checked={selectedItemIds.includes(item.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedItemIds((prev) => [...prev, item.id]);
                                } else {
                                  setSelectedItemIds((prev) => prev.filter((id) => id !== item.id));
                                }
                              }}
                              className="cursor-pointer flex-shrink-0"
                              style={{ accentColor: "var(--primary)" }}
                            />
                          )}

                          {/* Type Icon */}
                          <div className="flex-shrink-0 p-1.5 rounded-lg border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                            {item.type === "text" ? (
                              <FileText className="h-4 w-4" style={{ color: "var(--primary)" }} />
                            ) : (
                              (() => {
                                const IconComp = item.meta?.icon || FileCheck;
                                return <IconComp className="h-4 w-4" style={{ color: "var(--primary)" }} />;
                              })()
                            )}
                          </div>

                          {/* File Details */}
                          <div className="min-w-0 flex-1 flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold text-xs truncate" style={{ color: "var(--foreground)" }}>
                                {item.type === "file" ? item.name : (item.content.slice(0, 50) + (item.content.length > 50 ? "..." : ""))}
                              </span>
                              {item.type === "file" && (
                                <span className="text-[10px] font-mono flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                                  ({item.size})
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.isFix && (
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border" style={{ background: "var(--primary-faint)", borderColor: "var(--primary-border)", color: "var(--primary)" }}>
                                  {item.msgType || "FIX"}
                                </span>
                              )}
                              {item.type === "file" && item.meta && (
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border" style={{ background: "var(--primary-faint)", borderColor: "var(--primary-border)", color: "var(--primary)" }}>
                                  {item.meta.label}
                                </span>
                              )}
                              {item.isP2P && (
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border" style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "rgba(16, 185, 129, 0.3)", color: "#10b981" }}>
                                  WebRTC P2P
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions Bar (Row on Desktop, Clean Bottom Section on Mobile) */}
                        <div className="flex items-center justify-between md:justify-end gap-2 flex-wrap flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0" style={{ borderColor: "var(--border)" }}>
                          {p2pTransfer && p2pTransfer.itemId === item.id && (
                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg border text-[10px] font-mono w-full md:w-auto justify-between" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                              <span>{p2pTransfer.mode === "send" ? "Uploading P2P" : "Downloading P2P"}: <strong style={{ color: "var(--primary)" }}>{p2pTransfer.progress}%</strong></span>
                              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                                <div className="h-full bg-primary" style={{ width: `${p2pTransfer.progress}%`, background: "var(--primary)" }} />
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
                            {item.isFix && (
                              <>
                                <button
                                  onClick={() => {
                                    if (typeof window !== "undefined") localStorage.setItem("fixify-compare-msg1", item.content);
                                    window.location.href = "/compare";
                                  }}
                                  className="px-2 py-1 rounded-lg transition-all border flex items-center gap-1 text-[10px] font-semibold cursor-pointer"
                                  style={{ background: "var(--primary-faint)", borderColor: "var(--primary-border)", color: "var(--primary)" }}
                                >
                                  <GitCompare className="h-3 w-3" /> <span>Compare</span>
                                </button>
                                <button
                                  onClick={() => {
                                    window.location.href = `/interpreter?q=${encodeURIComponent("Explain this FIX log message in detail: " + item.content)}`;
                                  }}
                                  className="px-2 py-1 rounded-lg transition-all border flex items-center gap-1 text-[10px] font-semibold cursor-pointer"
                                  style={{ background: "var(--primary-faint)", borderColor: "var(--primary-border)", color: "var(--primary)" }}
                                >
                                  <Brain className="h-3 w-3" /> <span>FIXi AI</span>
                                </button>
                              </>
                            )}

                            {item.type === "text" ? (
                              <button
                                onClick={() => handleCopy(item.id, item.content)}
                                className="px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 text-xs cursor-pointer border"
                                style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
                              >
                                {copiedId === item.id ? <Check className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} /> : <Copy className="h-3.5 w-3.5" />}
                                <span>{copiedId === item.id ? "Copied!" : "Copy"}</span>
                              </button>
                            ) : downloadedFiles[item.id] ? (
                              <a
                                href={downloadedFiles[item.id].url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1 rounded-lg border transition-all flex items-center gap-1 text-xs font-semibold"
                                style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "rgba(16, 185, 129, 0.3)", color: "#10b981" }}
                              >
                                <ExternalLink className="h-3.5 w-3.5" /> <span>Open File</span>
                              </a>
                            ) : item.isP2P ? (
                              <button
                                onClick={() => handleP2PDownload(item)}
                                className="px-3 py-1 rounded-lg border transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer"
                                style={{ background: "var(--primary-faint)", borderColor: "var(--primary-border)", color: "var(--primary)" }}
                              >
                                <Download className="h-3.5 w-3.5 animate-pulse" /> <span>P2P Download</span>
                              </button>
                            ) : (
                              <a
                                href={item.dataUrl}
                                download={item.name}
                                className="px-3 py-1 rounded-lg border transition-all flex items-center gap-1 text-xs font-semibold"
                                style={{ background: "var(--primary-faint)", borderColor: "var(--primary-border)", color: "var(--primary)" }}
                              >
                                <Download className="h-3.5 w-3.5" /> <span>Download</span>
                              </a>
                            )}

                            {(!item.senderId || item.senderId === myPeerId.current) && (
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1.5 rounded-lg transition-all cursor-pointer hover:text-red-500 border md:border-0"
                                style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
                                title="Delete Payload"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Full scrollable content box for text items */}
                        {item.type === "text" && (
                          <div className="p-3 rounded-xl border font-mono text-xs break-all whitespace-pre-wrap max-h-32 overflow-y-auto fx-custom-scroll" style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}>
                            {item.content}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* Info Panel Modal (Matching /log-sanitizer & /binary-decoder) */}
      {infoModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-fade-in"
            onClick={() => setInfoModalOpen(false)}
          />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg p-6 rounded-2xl border shadow-2xl z-50 flex flex-col max-h-[85vh] animate-scale-up"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Info className="h-4 w-4" style={{ color: "var(--primary)" }} />
                <span>FixDrop Instant Transfer Guide</span>
              </h3>
              <button
                onClick={() => setInfoModalOpen(false)}
                className="text-xs font-semibold cursor-pointer"
                style={{ color: "var(--text-muted)" }}
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 text-xs leading-relaxed fx-custom-scroll">
              <div className="space-y-2">
                <p className="font-bold" style={{ color: "var(--foreground)" }}>What is FixDrop Instant Transfer?</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  FixDrop is a local-first, zero-server cross-device payload and file sharing engine. It enables trading desks, QA engineers, and market integration teams to share raw FIX log lines, Word (.docx), PDF (.pdf), Excel (.xlsx), and PCAP captures instantly between laptops, workstations, tablets, and phones.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-bold" style={{ color: "var(--foreground)" }}>How to use FixDrop in 3 Steps:</p>
                <ul className="list-disc pl-4 space-y-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <li><strong>Stage 1 (Input Payload):</strong> Drop files or paste raw FIX logs into the dropzone (re-using Fixify's standard tabbed input card).</li>
                  <li><strong>Stage 2 (Process &amp; Sanitize):</strong> Review your queued payload. Optionally enable <em>Auto-Sanitize PII</em> to mask sensitive accounts (Tag 1), SenderSubIDs (Tag 50), and TargetSubIDs (Tag 57).</li>
                  <li><strong>Stage 3 (Active Room Stream):</strong> Broadcast to your room stream. Connected peers in room <code>#{pinCode}</code> automatically receive the broadcast.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-bold" style={{ color: "var(--foreground)" }}>Device Pairing &amp; Mobile QR Code:</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Click the QR icon in the header bar to present a high-contrast vector QR code. Scan the code with any mobile camera (iOS/Android) to open <code>?pin=XXXX</code> and automatically join the room.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
      {showQrModal && (
        <div onClick={() => setShowQrModal(false)} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm p-6 rounded-2xl border shadow-2xl space-y-4 text-center" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <QrCode className="h-4 w-4" style={{ color: "var(--primary)" }} /> Mobile Camera QR Scan
              </h3>
              <button onClick={() => setShowQrModal(false)} className="p-1 rounded-lg cursor-pointer" style={{ color: "var(--text-muted)" }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Instant Pure SVG QR Matrix */}
            <div className="p-4 rounded-xl flex items-center justify-center mx-auto w-48 h-48 bg-white border" style={{ borderColor: "var(--border)" }}>
              {qrSvgString ? (
                <div dangerouslySetInnerHTML={{ __html: qrSvgString }} className="w-44 h-44 flex items-center justify-center bg-white rounded-xl overflow-hidden" />
              ) : (
                <div className="w-44 h-44 flex items-center justify-center bg-white rounded-xl border text-[10px] text-zinc-400">
                  Generating QR...
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-mono font-bold" style={{ color: "var(--primary)" }}>PIN: #{pinCode}</div>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Scan with any phone camera to open AirShare room #{pinCode}.</p>
              <button
                onClick={handleCopyLink}
                className="w-full py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                {copiedLink ? <Check className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} /> : <Copy className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />}
                <span>{copiedLink ? "Link Copied!" : "Copy Direct Room Link"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {p2pTransfer && (
        <div
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-80 z-50 p-3.5 sm:p-4 rounded-2xl border shadow-2xl space-y-2.5 animate-fadeIn max-w-md mx-auto sm:mx-0 backdrop-blur-md"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          {/* Toaster Header with X Close Button */}
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold flex items-center gap-1.5" style={{ color: "var(--foreground)" }}>
              {p2pTransfer.mode === "send" ? <UploadCloud className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} /> : <Download className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />}
              <span>{p2pTransfer.mode === "send" ? "Sending File..." : "Receiving File..."}</span>
            </h4>
            <button
              onClick={() => setP2pTransfer(null)}
              className="p-1 rounded-lg transition-all hover:bg-background cursor-pointer"
              style={{ color: "var(--text-muted)" }}
              title="Close Toaster"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Filename & Progress */}
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="truncate font-semibold text-[11px]" style={{ color: "var(--foreground)" }}>
              {p2pTransfer.fileName}
            </span>
            <span className="text-[11px] font-mono font-bold flex-shrink-0" style={{ color: "var(--primary)" }}>
              {p2pTransfer.progress}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--background)" }}>
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${p2pTransfer.progress}%`, background: "var(--primary)" }}
            />
          </div>

          {/* Useful Metadata Bar */}
          <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--text-muted)" }}>
            <span>
              {p2pTransfer.size}
              {p2pTransfer.speed && p2pTransfer.status === "transferring" && ` • ${p2pTransfer.speed} (${p2pTransfer.eta})`}
            </span>
            <span
              className="font-mono font-bold px-1.5 py-0.2 rounded border uppercase text-[9px]"
              style={{
                background:
                  p2pTransfer.status === "completed"
                    ? "rgba(16, 185, 129, 0.1)"
                    : p2pTransfer.status === "failed"
                    ? "rgba(239, 68, 68, 0.1)"
                    : p2pTransfer.status === "paused"
                    ? "rgba(245, 158, 11, 0.1)"
                    : "var(--primary-faint)",
                borderColor:
                  p2pTransfer.status === "completed"
                    ? "rgba(16, 185, 129, 0.3)"
                    : p2pTransfer.status === "failed"
                    ? "rgba(239, 68, 68, 0.3)"
                    : p2pTransfer.status === "paused"
                    ? "rgba(245, 158, 11, 0.3)"
                    : "var(--primary-border)",
                color:
                  p2pTransfer.status === "completed"
                    ? "#10b981"
                    : p2pTransfer.status === "failed"
                    ? "#ef4444"
                    : p2pTransfer.status === "paused"
                    ? "#f59e0b"
                    : "var(--primary)"
              }}
            >
              {p2pTransfer.status}
            </span>
          </div>

          {/* Pause / Resume Controls */}
          {(p2pTransfer.status === "transferring" || p2pTransfer.status === "paused") && (
            <button
              onClick={toggleP2PPause}
              className="w-full py-1.5 rounded-xl border text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all mt-1"
              style={{
                background: p2pTransfer.status === "paused" ? "var(--primary-faint)" : "var(--background)",
                borderColor: "var(--border)",
                color: "var(--foreground)"
              }}
            >
              {p2pTransfer.status === "paused" ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              <span>{p2pTransfer.status === "paused" ? "Resume Transfer" : "Pause Transfer"}</span>
            </button>
          )}
        </div>
      )}
      {/* ADD ITEM MODAL DIALOG (STAGE 3 STREAM PRESENCE) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div
            className="w-full max-w-2xl bg-card border rounded-2xl p-6 shadow-2xl space-y-4 animate-scaleUp max-h-[90vh] overflow-y-auto fx-custom-scroll"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <Shredder className="h-4 w-4" style={{ color: "var(--primary)" }} />
                <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                  Share New Payload to Room #{pinCode}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg transition-all hover:bg-background cursor-pointer"
                style={{ color: "var(--text-muted)" }}
                title="Close Modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Input Mode Selector */}
            <div className="flex rounded-xl p-1 border gap-1" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
              <button
                onClick={() => setInputMode("paste")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  inputMode === "paste" ? "bg-card shadow-sm" : ""
                }`}
                style={{
                  color: inputMode === "paste" ? "var(--primary)" : "var(--text-muted)",
                  background: inputMode === "paste" ? "var(--card)" : "transparent"
                }}
              >
                <FileText className="h-3.5 w-3.5" /> <span>Paste FIX Text</span>
              </button>
              <button
                onClick={() => setInputMode("file")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  inputMode === "file" ? "bg-card shadow-sm" : ""
                }`}
                style={{
                  color: inputMode === "file" ? "var(--primary)" : "var(--text-muted)",
                  background: inputMode === "file" ? "var(--card)" : "transparent"
                }}
              >
                <UploadCloud className="h-3.5 w-3.5" /> <span>Drop Files</span>
              </button>
            </div>

            {/* Paste Text Mode */}
            {inputMode === "paste" && (
              <div className="space-y-3">
                <textarea
                  value={payloadText}
                  onChange={(e) => setPayloadText(e.target.value)}
                  placeholder="Paste FIX log, execution report, order tag string, or raw text message..."
                  className="w-full h-40 p-4 rounded-xl border font-mono text-xs focus:outline-none focus:ring-1 resize-none fx-custom-scroll"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-xs" style={{ color: "var(--text-muted)" }}>
                    <input
                      type="checkbox"
                      checked={autoSanitize}
                      onChange={(e) => setAutoSanitize(e.target.checked)}
                      className="cursor-pointer"
                      style={{ accentColor: "var(--primary)" }}
                    />
                    <span>Sanitize Sensitive Tags (Tag 55, Tag 554, API keys)</span>
                  </label>
                  <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {payloadText.length} chars
                  </span>
                </div>
              </div>
            )}

            {/* Drop Files Mode */}
            {inputMode === "file" && (
              <div className="space-y-3">
                <div
                  {...getRootProps()}
                  className={`p-8 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                    isDragActive ? "border-primary bg-primary/5" : ""
                  }`}
                  style={{ borderColor: isDragActive ? "var(--primary)" : "var(--border)", background: "var(--background)" }}
                >
                  <input {...getInputProps()} />
                  <UploadCloud className="h-8 w-8 animate-bounce" style={{ color: "var(--primary)" }} />
                  <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                    Drag & drop files here, or <span style={{ color: "var(--primary)" }}>browse</span>
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    Supports logs, PCAP, CSV, XML, images, PDFs & large files up to 1GB
                  </p>
                </div>

                {/* Staged Files List */}
                {stagedFiles.length > 0 && (
                  <div className="space-y-2 max-h-36 overflow-y-auto fx-custom-scroll">
                    {stagedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-2.5 rounded-xl border flex items-center justify-between text-xs"
                        style={{ background: "var(--background)", borderColor: "var(--border)" }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileCheck className="h-4 w-4 flex-shrink-0" style={{ color: "var(--primary)" }} />
                          <span className="truncate font-semibold" style={{ color: "var(--foreground)" }}>{file.name}</span>
                          <span className="text-[10px] font-mono flex-shrink-0" style={{ color: "var(--text-muted)" }}>({file.size})</span>
                        </div>
                        <button
                          onClick={() => setStagedFiles((prev) => prev.filter((f) => f.id !== file.id))}
                          className="p-1 rounded-lg hover:text-red-500 cursor-pointer"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold cursor-pointer rounded-xl border"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                Cancel
              </button>
              <button
                onClick={processAndBroadcast}
                disabled={isBroadcasting || (inputMode === "paste" && !payloadText.trim()) || (inputMode === "file" && stagedFiles.length === 0)}
                className="fx-btn-primary py-2 px-6 text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBroadcasting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Broadcasting...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Broadcast to Room</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
