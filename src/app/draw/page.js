"use client";
import { useRef, useState, useEffect } from "react";

export default function DrawPage() {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth * 0.9;
    canvas.height = window.innerHeight * 0.75;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.strokeStyle = "#dc2626"; // red-600
    ctx.lineWidth = 3;
    ctxRef.current = ctx;
  }, []);

  const startDraw = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(offsetX, offsetY);
    setDrawing(true);
  };

  const draw = ({ nativeEvent }) => {
    if (!drawing) return;
    const { offsetX, offsetY } = nativeEvent;
    ctxRef.current.lineTo(offsetX, offsetY);
    ctxRef.current.stroke();
  };

  const stopDraw = () => {
    ctxRef.current.closePath();
    setDrawing(false);
  };

  const clearCanvas = () => {
    ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  return (
    <main className="min-h-screen bg-white p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">🖊 Whiteboard</h1>
      <button
        onClick={clearCanvas}
        className="mb-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 shadow"
      >
        Clear
      </button>
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
