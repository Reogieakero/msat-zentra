"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, PenLine } from "lucide-react";
import styles from "./SignaturePad.module.css";

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}

const INK = "#1a237e";
const PAD_HEIGHT = 160;

/**
 * Drawn-signature capture: mouse, stylus, or finger via Pointer Events.
 * Exports a transparent PNG data URL for POST /api/anecdotal/:id/sign.
 */
export function SignaturePad({ onSave, onCancel, saving, error }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const drawnRef = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.floor(PAD_HEIGHT * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.25;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
  }, []);

  function point(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (saving) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    const p = point(e);
    ctx?.beginPath();
    ctx?.moveTo(p.x, p.y);
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || saving) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!drawnRef.current) {
      drawnRef.current = true;
      setEmpty(false);
    }
  }

  function endStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // Pointer already released — harmless.
    }
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    drawnRef.current = false;
    setEmpty(true);
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas || drawnRef.current === false) return;
    onSave(canvas.toDataURL("image/png"));
  }

  return (
    <div className={styles.pad}>
      <p className={styles.padHint}>
        <PenLine aria-hidden />
        Sign inside the box with your mouse or finger.
      </p>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        style={{ height: PAD_HEIGHT }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
        role="img"
        aria-label="Signature drawing area"
      />
      {error ? (
        <p className={styles.padError} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.padActions}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          Back
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={saving || empty}
        >
          <Eraser aria-hidden />
          Clear
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={saving || empty}
        >
          {saving ? "Saving…" : "Save signature"}
        </Button>
      </div>
    </div>
  );
}
