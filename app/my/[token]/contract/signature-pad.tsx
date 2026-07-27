"use client";

import { useRef, useState } from "react";

export function SignaturePad({ token, contractId }: { token: string; contractId: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);

  function getContext(): CanvasRenderingContext2D | null {
    const canvas = canvasRef.current;
    return canvas ? canvas.getContext("2d") : null;
  }

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = getContext();
    if (!ctx) return;
    drawingRef.current = true;
    hasDrawnRef.current = true;
    const { x, y } = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = getContext();
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#16241f";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
  }

  async function submitSignature() {
    if (!hasDrawnRef.current) {
      setError("서명을 그려주세요.");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSubmitting(true);
    setError(null);
    try {
      const signatureDataUrl = canvas.toDataURL("image/png");
      const res = await fetch(`/api/my/${token}/contract/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "서명 저장에 실패했어요.");
        return;
      }
      setSigned(true);
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (signed) {
    return (
      <div className="rounded-2xl border border-sage/40 bg-sage/10 px-6 py-8 text-center">
        <p className="font-display text-lg mb-1">서명이 완료됐어요</p>
        <p className="text-sm text-ink/60">계약서 서명이 정상적으로 접수됐어요.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium mb-2">회원 서명</p>
      <p className="text-xs text-ink/50 mb-3">
        아래 네모 칸 안에 손가락(또는 마우스)으로 서명해주세요.
      </p>
      <canvas
        ref={canvasRef}
        width={560}
        height={180}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full touch-none rounded-xl border border-line bg-white"
        style={{ height: 180 }}
        data-contract-id={contractId}
      />
      {error && <p className="text-sm text-coral mt-2">{error}</p>}
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={clearCanvas}
          className="rounded-full border border-line px-4 py-2 text-sm hover:bg-bone transition"
        >
          다시 그리기
        </button>
        <button
          type="button"
          onClick={submitSignature}
          disabled={submitting}
          className="flex-1 rounded-full bg-ink text-white py-2 text-sm font-medium hover:bg-coral transition disabled:opacity-50"
        >
          {submitting ? "저장 중..." : "서명 완료하기"}
        </button>
      </div>
    </div>
  );
}
