"use client";
import { useRef, useState, useEffect } from "react";

export default function WhiteboardPage() {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState("pen"); // "pen" | "text"
  const [color, setColor] = useState("#dc2626");
  const [lineWidth, setLineWidth] = useState(3);
  const [text, setText] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth * 0.9;
    canvas.height = window.innerHeight * 0.75;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctxRef.current = ctx;
  }, []);

  useEffect(() => {
    if (ctxRef.current) {
      ctxRef.current.strokeStyle = color;
      ctxRef.current.lineWidth = lineWidth;
    }
  }, [color, lineWidth]);

  const startDraw = ({ nativeEvent }) => {
    if (tool === "pen") {
      const { offsetX, offsetY } = nativeEvent;
      ctxRef.current.beginPath();
      ctxRef.current.moveTo(offsetX, offsetY);
      setDrawing(true);
    } else if (tool === "text" && text) {
      const { offsetX, offsetY } = nativeEvent;
      ctxRef.current.fillStyle = color;
      ctxRef.current.font = `${lineWidth * 5}px Arial`;
      ctxRef.current.fillText(text, offsetX, offsetY);
    }
  };

  const draw = ({ nativeEvent }) => {
    if (!drawing) return;
    const { offsetX, offsetY } = nativeEvent;
    ctxRef.current.lineTo(offsetX, offsetY);
    ctxRef.current.stroke();
  };

  const stopDraw = () => {
    if (drawing) ctxRef.current.closePath();
    setDrawing(false);
  };

  const clearCanvas = () => {
    ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const downloadCanvas = () => {
    const link = document.createElement("a");
    link.download = "whiteboard.png";
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  return (
    <main className="min-h-screen bg-white p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4  text-center">🖊 Whiteboard</h1>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        <select
          value={tool}
          onChange={(e) => setTool(e.target.value)}
          className="border px-2 py-1 rounded"
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
            className="border px-2 py-1 rounded"
          />
        )}

        <label className="flex items-center gap-2">
          Color:
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-8 p-0 border-0"
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
          onClick={clearCanvas}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-gray-700 shadow"
        >
          Clear
        </button>

        <button
          onClick={downloadCanvas}
          className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-red-700 shadow"
        >
          Download
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
