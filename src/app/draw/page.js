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
  RectangleGroupIcon,
} from "@heroicons/react/24/outline";

export default function WhiteboardPage() {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState("pen"); // "pen" | "text"
  const [color, setColor] = useState("#dc2626");
  const [lineWidth, setLineWidth] = useState(3);
  const [text, setText] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  const undoStack = useRef([]);
  const redoStack = useRef([]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    resizeCanvas();
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctxRef.current = ctx;
    saveState();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  useEffect(() => {
    if (ctxRef.current) {
      ctxRef.current.strokeStyle = color;
      ctxRef.current.lineWidth = lineWidth;
    }
  }, [color, lineWidth]);

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (fullscreen) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    } else {
      canvas.width = window.innerWidth * 0.9;
      canvas.height = window.innerHeight * 0.75;
    }
  };

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (e.touches) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
  };

  const saveState = () => {
    undoStack.current.push(canvasRef.current.toDataURL());
    if (undoStack.current.length > 50) undoStack.current.shift();
  };

  const restoreState = (stack, oppositeStack) => {
    if (!stack.current.length) return;
    const lastState = stack.current.pop();
    const img = new Image();
    img.src = lastState;
    img.onload = () => {
      ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctxRef.current.drawImage(img, 0, 0);
      oppositeStack.current.push(lastState);
    };
  };

  const undo = () => restoreState(undoStack, redoStack);
  const redo = () => restoreState(redoStack, undoStack);

  const startDraw = (e) => {
    e.preventDefault();
    const { x, y } = getPos(e);
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

  const draw = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
  };

  const stopDraw = (e) => {
    if (drawing) {
      e.preventDefault();
      ctxRef.current.closePath();
      setDrawing(false);
      saveState();
      redoStack.current = [];
    }
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

  return (
    <main className="min-h-screen bg-white p-6 flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-2 flex justify-between">
        🖊 Whiteboard
        <button
          onClick={() => {
            setFullscreen(true);
            setTimeout(resizeCanvas, 50);
          }}
          className="flex items-center gap-1 px-3 py-1 bg-gray-800 text-white rounded shadow hover:bg-gray-700"
        >
          <ArrowsPointingOutIcon className="w-5 h-5" /> Fullscreen
        </button>
      </h1>

      {/* Toolbar */}
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
            className="border px-3 py-1 rounded focus:outline-none focus:ring-2 focus:ring-red-600"
          />
        )}

        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-10 h-8 p-0 border-0 cursor-pointer"
        />

        <input
          type="range"
          min="1"
          max="10"
          value={lineWidth}
          onChange={(e) => setLineWidth(e.target.value)}
        />

        <button onClick={undo} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded shadow">
          <ArrowUturnLeftIcon className="w-5 h-5" />
        </button>
        <button onClick={redo} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded shadow">
          <ArrowUturnRightIcon className="w-5 h-5" />
        </button>
        <button
          onClick={clearCanvas}
          className="px-3 py-1 bg-red-600 text-white rounded shadow hover:bg-red-700"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
        <button
          onClick={downloadCanvas}
          className="px-3 py-1 bg-gray-800 text-white rounded shadow hover:bg-gray-700"
        >
          <ArrowPathIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
        className="border border-gray-300 rounded shadow bg-gray-50 cursor-crosshair"
      />

      {/* Fullscreen modal */}
      {fullscreen && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          {/* floating toolbox with icons only */}
          <div className="absolute top-4 left-4 flex flex-col gap-2 bg-gray-100 p-2 rounded-lg shadow">
            <button onClick={() => setTool("pen")} className={`${tool==="pen"?"bg-gray-300":""} p-2 rounded`}>
              <PencilIcon className="w-6 h-6" />
            </button>
            <button onClick={() => setTool("text")} className={`${tool==="text"?"bg-gray-300":""} p-2 rounded`}>
              <RectangleGroupIcon className="w-6 h-6" />
            </button>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 p-0 border-0 cursor-pointer rounded"
            />
            <input
              type="range"
              min="1"
              max="10"
              value={lineWidth}
              onChange={(e) => setLineWidth(e.target.value)}
              className="w-20"
            />
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
            <button
              onClick={() => {
                setFullscreen(false);
                setTimeout(resizeCanvas, 50);
              }}
              className="p-2 rounded hover:bg-gray-200"
            >
              <XMarkIcon className="w-6 h-6 text-gray-700" />
            </button>
          </div>

          {/* fullscreen canvas */}
          <canvas
            ref={canvasRef}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
            className="flex-1 bg-gray-50 touch-none cursor-crosshair"
          />
        </div>
      )}
    </main>
  );
}
