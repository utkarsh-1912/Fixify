"use client";
import { useRef, useState, useEffect } from "react";
import {
  ArrowPathIcon,
  TrashIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
} from "@heroicons/react/24/outline";

export default function WhiteboardPage() {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState("pen"); // "pen" | "text"
  const [color, setColor] = useState("#dc2626");
  const [lineWidth, setLineWidth] = useState(3);
  const [text, setText] = useState("");

  const undoStack = useRef([]);
  const redoStack = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth * 0.9;
    canvas.height = window.innerHeight * 0.75;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctxRef.current = ctx;
    saveState();
  }, []);

  useEffect(() => {
    if (ctxRef.current) {
      ctxRef.current.strokeStyle = color;
      ctxRef.current.lineWidth = lineWidth;
    }
  }, [color, lineWidth]);

  const saveState = () => {
    undoStack.current.push(canvasRef.current.toDataURL());
    if (undoStack.current.length > 50) undoStack.current.shift(); // limit history
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

  const startDraw = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    if (tool === "pen") {
      ctxRef.current.beginPath();
      ctxRef.current.moveTo(offsetX, offsetY);
      setDrawing(true);
    } else if (tool === "text" && text) {
      ctxRef.current.fillStyle = color;
      ctxRef.current.font = `${lineWidth * 5}px Arial`;
      ctxRef.current.fillText(text, offsetX, offsetY);
      saveState();
    }
  };

  const draw = ({ nativeEvent }) => {
    if (!drawing) return;
    const { offsetX, offsetY } = nativeEvent;
    ctxRef.current.lineTo(offsetX, offsetY);
    ctxRef.current.stroke();
  };

  const stopDraw = () => {
    if (drawing) {
      ctxRef.current.closePath();
      setDrawing(false);
      saveState();
      redoStack.current = []; // clear redo stack on new action
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
      <h1 className="text-2xl font-bold text-gray-800 mb-2">🖊 Whiteboard</h1>

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

        <label className="flex items-center gap-2">
          Color:
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-8 p-0 border-0 cursor-pointer"
          />
        </label>

        <label className="flex items-center gap-2">
          Size:
          <input
            type="range"
            min="1"
            max="10"
            value={lineWidth}
            onChange={(e) => setLineWidth(e.target.value)}
          />
        </label>

        <button
          onClick={undo}
          className="flex items-center gap-1 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded shadow"
        >
          <ArrowUturnLeftIcon className="w-5 h-5 text-gray-700" /> Undo
        </button>

        <button
          onClick={redo}
          className="flex items-center gap-1 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded shadow"
        >
          <ArrowUturnRightIcon className="w-5 h-5 text-gray-700" /> Redo
        </button>

        <button
          onClick={clearCanvas}
          className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded shadow hover:bg-red-700"
        >
          <TrashIcon className="w-5 h-5" /> Clear
        </button>

        <button
          onClick={downloadCanvas}
          className="flex items-center gap-1 px-3 py-1 bg-gray-800 text-white rounded shadow hover:bg-gray-700"
        >
          <ArrowPathIcon className="w-5 h-5" /> Download
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        className="border border-gray-300 rounded shadow bg-gray-50 cursor-crosshair"
      />
    </main>
  );
}
