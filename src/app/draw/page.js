"use client";
import { useRef, useState, useEffect } from "react";
import {
  ArrowPathIcon,
  TrashIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ArrowsPointingOutIcon,
  XMarkIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";

export default function WhiteboardPage() {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const imageBackup = useRef(null);

  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#dc2626");
  const [lineWidth, setLineWidth] = useState(3);
  const [text, setText] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  const undoStack = useRef([]);
  const redoStack = useRef([]);

  // ✅ init once
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctxRef.current = ctx;

    resizeCanvas();
    saveState();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ✅ reapply styles whenever state changes
  useEffect(() => {
    if (ctxRef.current) {
      ctxRef.current.strokeStyle = color;
      ctxRef.current.lineWidth = lineWidth;
    }
  }, [color, lineWidth]);

  const handleResize = () => {
    backupCanvas();
    resizeCanvas();
    restoreBackup();
  };

  const backupCanvas = () => {
    imageBackup.current = canvasRef.current.toDataURL();
  };

  const restoreBackup = () => {
    if (!imageBackup.current) return;
    const img = new Image();
    img.src = imageBackup.current;
    img.onload = () => {
      ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctxRef.current.drawImage(img, 0, 0);
      ctxRef.current.strokeStyle = color; // ✅ restore pen color
      ctxRef.current.lineWidth = lineWidth;
    };
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (fullscreen) {
      canvas.style.position = "fixed";
      canvas.style.left = "0";
      canvas.style.top = "0";
      canvas.style.zIndex = "40";
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    } else {
      canvas.style.position = "static";
      canvas.style.zIndex = "1";
      canvas.width = Math.round(window.innerWidth * 0.9);
      canvas.height = Math.round(window.innerHeight * 0.75);
    }
  };

  // ✅ always use boundingRect for correct sync
  const getPointerPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const saveState = () => {
    undoStack.current.push(canvasRef.current.toDataURL());
    if (undoStack.current.length > 50) undoStack.current.shift();
  };

  const restoreState = (stack, opposite) => {
    if (!stack.current.length) return;
    const last = stack.current.pop();
    const img = new Image();
    img.src = last;
    img.onload = () => {
      ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctxRef.current.drawImage(img, 0, 0);
      ctxRef.current.strokeStyle = color;
      ctxRef.current.lineWidth = lineWidth;
      opposite.current.push(last);
    };
  };

  const undo = () => restoreState(undoStack, redoStack);
  const redo = () => restoreState(redoStack, undoStack);

  const handleStart = (e) => {
    e.preventDefault();
    const { x, y } = getPointerPos(e);
    if (tool === "pen") {
      ctxRef.current.beginPath();
      ctxRef.current.moveTo(x, y);
      setDrawing(true);
    } else if (tool === "text" && text) {
      ctxRef.current.fillStyle = color;
      ctxRef.current.font = `${lineWidth * 5}px Arial`;
      ctxRef.current.fillText(text, x, y);
      saveState();
    }
  };

  const handleMove = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const { x, y } = getPointerPos(e);
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
  };

  const handleEnd = (e) => {
    if (!drawing) return;
    e.preventDefault();
    ctxRef.current.closePath();
    setDrawing(false);
    saveState();
    redoStack.current = [];
  };

  const clearCanvas = () => {
    ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    saveState();
  };

  const downloadCanvas = () => {
    const link = document.createElement("a");
    link.download = "whiteboard.png";
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const toggleFullscreen = () => {
    backupCanvas();
    setFullscreen((prev) => !prev);
    setTimeout(() => {
      resizeCanvas();
      restoreBackup();
    }, 50);
  };

  return (
    <main className="min-h-screen bg-white p-6 flex flex-col gap-4 relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold text-gray-800">🖊 Whiteboard</h1>
        <button
          onClick={toggleFullscreen}
          className="flex items-center gap-1 px-3 py-1 bg-gray-800 text-white rounded shadow hover:bg-gray-700"
        >
          {fullscreen ? (
            <>
              <XMarkIcon className="w-5 h-5" /> Exit Fullscreen
            </>
          ) : (
            <>
              <ArrowsPointingOutIcon className="w-5 h-5" /> Fullscreen
            </>
          )}
        </button>
      </div>

      {/* Toolbox (always same state) */}
      {!fullscreen && (
        <div className="flex flex-wrap gap-3 items-center bg-gray-50 p-3 rounded-xl shadow border border-gray-200">
          <select
            value={tool}
            onChange={(e) => setTool(e.target.value)}
            className="border px-3 py-1 rounded focus:outline-none focus:ring-2 focus:ring-red-600"
          >
            <option value="pen">Pen</option>
            <option value="text">Text</option>
          </select>
          {tool === "text" && (
            <input
              type="text"
              placeholder="Enter text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="border px-3 py-1 rounded"
            />
          )}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-8 cursor-pointer"
          />
          <input
            type="range"
            min="1"
            max="10"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
          />
          <button onClick={undo} className="px-3 py-1 bg-gray-200 rounded">
            <ArrowUturnLeftIcon className="w-5 h-5" />
          </button>
          <button onClick={redo} className="px-3 py-1 bg-gray-200 rounded">
            <ArrowUturnRightIcon className="w-5 h-5" />
          </button>
          <button onClick={clearCanvas} className="px-3 py-1 bg-red-600 text-white rounded">
            <TrashIcon className="w-5 h-5" />
          </button>
          <button onClick={downloadCanvas} className="px-3 py-1 bg-gray-800 text-white rounded">
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        className={`border border-gray-300 rounded shadow bg-gray-50 cursor-crosshair ${
          fullscreen ? "fixed inset-0 z-40 touch-none" : ""
        }`}
      />

      {/* Floating toolbox in fullscreen */}
      {fullscreen && (
        <div className="absolute top-4 left-4 z-50 flex flex-col gap-2 bg-white p-2 rounded-lg shadow">
          <button onClick={() => setTool("pen")} className={`p-2 rounded ${tool === "pen" ? "bg-gray-200" : ""}`}>
            <PencilIcon className="w-6 h-6" />
          </button>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8" />
          <input type="range" min="1" max="10" value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} />
          <button onClick={undo} className="p-2 rounded hover:bg-gray-200">
            <ArrowUturnLeftIcon className="w-6 h-6" />
          </button>
          <button onClick={redo} className="p-2 rounded hover:bg-gray-200">
            <ArrowUturnRightIcon className="w-6 h-6" />
          </button>
          <button onClick={clearCanvas} className="p-2 rounded hover:bg-red-200">
            <TrashIcon className="w-6 h-6 text-red-600" />
          </button>
          <button onClick={downloadCanvas} className="p-2 rounded hover:bg-gray-200">
            <ArrowPathIcon className="w-6 h-6" />
          </button>
          <button onClick={toggleFullscreen} className="p-2 rounded hover:bg-gray-200">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
      )}
    </main>
  );
}
