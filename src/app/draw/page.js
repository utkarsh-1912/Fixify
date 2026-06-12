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

  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#dc2626");
  const [lineWidth, setLineWidth] = useState(3);
  const [text, setText] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const imageBackup = useRef(null);

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

  // ✅ backup & restore use ImageData
  const backupCanvas = () => {
    const canvas = canvasRef.current;
    imageBackup.current = ctxRef.current.getImageData(0, 0, canvas.width, canvas.height);
  };

  const restoreBackup = () => {
    if (!imageBackup.current) return;
    ctxRef.current.putImageData(imageBackup.current, 0, 0);
  };

  // ✅ resize without distortion
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const temp = document.createElement("canvas");
    const tempCtx = temp.getContext("2d");

    // backup before resize
    temp.width = canvas.width;
    temp.height = canvas.height;
    tempCtx.drawImage(canvas, 0, 0);

    if (fullscreen) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.position = "fixed";
      canvas.style.left = "0";
      canvas.style.top = "0";
      canvas.style.zIndex = "40";
    } else {
      canvas.width = Math.round(window.innerWidth * 0.9);
      canvas.height = Math.round(window.innerHeight * 0.75);
      canvas.style.position = "static";
      canvas.style.zIndex = "1";
    }

    // restore scaled content
    ctxRef.current.drawImage(
      temp,
      0,
      0,
      temp.width,
      temp.height,
      0,
      0,
      canvas.width,
      canvas.height
    );
  };

  // ✅ always recalc bounding rect
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

  // ✅ use ImageData for undo/redo
  const saveState = () => {
    const canvas = canvasRef.current;
    undoStack.current.push(ctxRef.current.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStack.current.length > 50) undoStack.current.shift();
  };

  const restoreState = (stack, opposite) => {
    if (!stack.current.length) return;
    const last = stack.current.pop();
    ctxRef.current.putImageData(last, 0, 0);
    const canvas = canvasRef.current;
    opposite.current.push(ctxRef.current.getImageData(0, 0, canvas.width, canvas.height));
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
    requestAnimationFrame(() => {
      resizeCanvas();
      restoreBackup();
    });
  };

  return (
    <main className="min-h-screen bg-[var(--background)] p-6 flex flex-col gap-4 relative transition-colors duration-200">
      {/* Header */}
      <div className="flex justify-between items-center mb-2 border-b border-zinc-850 pb-4">
        <h1 className="text-2xl font-extrabold text-[var(--foreground)]">Whiteboard</h1>
        <button
          onClick={toggleFullscreen}
          className="flex items-center gap-1.5 px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-lg shadow text-xs font-mono transition-colors"
        >
          {fullscreen ? (
            <>
              <XMarkIcon className="w-4 h-4" /> Exit Fullscreen
            </>
          ) : (
            <>
              <ArrowsPointingOutIcon className="w-4 h-4" /> Fullscreen
            </>
          )}
        </button>
      </div>

      {/* Toolbox (normal mode) */}
      {!fullscreen && (
        <div className="flex flex-wrap gap-4 items-center bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 font-mono text-xs text-zinc-300">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Tool:</span>
            <select
              value={tool}
              onChange={(e) => setTool(e.target.value)}
              className="border border-zinc-800 bg-zinc-950 text-zinc-350 px-2.5 py-1.5 rounded-lg outline-none focus:border-emerald-500"
            >
              <option value="pen">Pen</option>
              <option value="text">Text</option>
            </select>
          </div>

          {tool === "text" && (
            <input
              type="text"
              placeholder="Enter text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="border border-zinc-800 bg-zinc-950 text-zinc-250 px-2.5 py-1.5 rounded-lg outline-none focus:border-emerald-500"
            />
          )}

          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Color:</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-8 cursor-pointer rounded border border-zinc-800 bg-zinc-950"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Width:</span>
            <input
              type="range"
              min="1"
              max="10"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="accent-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button onClick={undo} className="p-1.5 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded" title="Undo">
              <ArrowUturnLeftIcon className="w-4 h-4" />
            </button>
            <button onClick={redo} className="p-1.5 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded" title="Redo">
              <ArrowUturnRightIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button onClick={clearCanvas} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg flex items-center gap-1 shadow">
              <TrashIcon className="w-4 h-4" /> Clear
            </button>
            <button onClick={downloadCanvas} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-lg flex items-center gap-1 shadow">
              <ArrowPathIcon className="w-4 h-4" /> Save PNG
            </button>
          </div>
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
        className={`border border-zinc-800 rounded-xl shadow bg-zinc-950/20 cursor-crosshair ${
          fullscreen ? "fixed inset-0 z-40 touch-none bg-zinc-950" : ""
        }`}
      />

      {/* Floating toolbox in fullscreen */}
      {fullscreen && (
        <div className="absolute top-4 left-4 z-50 flex flex-col gap-3 bg-zinc-950 border border-zinc-800 p-3 rounded-xl shadow-2xl">
          <button
            onClick={() => setTool("pen")}
            className={`p-2 rounded-lg text-zinc-400 hover:text-white ${tool === "pen" ? "bg-zinc-900 border border-zinc-800" : ""}`}
            title="Pen"
          >
            <PencilIcon className="w-5 h-5" />
          </button>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 cursor-pointer rounded border border-zinc-850 bg-zinc-950"
            title="Select Color"
          />
          <input
            type="range"
            min="1"
            max="10"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-16 accent-emerald-500"
            title="Line Width"
          />
          <hr className="border-zinc-850" />
          <button onClick={undo} className="p-2 rounded hover:bg-zinc-900 text-zinc-400 hover:text-white" title="Undo">
            <ArrowUturnLeftIcon className="w-5 h-5" />
          </button>
          <button onClick={redo} className="p-2 rounded hover:bg-zinc-900 text-zinc-400 hover:text-white" title="Redo">
            <ArrowUturnRightIcon className="w-5 h-5" />
          </button>
          <hr className="border-zinc-850" />
          <button onClick={clearCanvas} className="p-2 rounded text-red-500 hover:bg-red-500/10" title="Clear Canvas">
            <TrashIcon className="w-5 h-5" />
          </button>
          <button onClick={downloadCanvas} className="p-2 rounded text-zinc-400 hover:text-white hover:bg-zinc-900" title="Download Canvas">
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          <button onClick={toggleFullscreen} className="p-2 rounded text-zinc-400 hover:text-white hover:bg-zinc-900" title="Exit Fullscreen">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}
    </main>
  );
}
