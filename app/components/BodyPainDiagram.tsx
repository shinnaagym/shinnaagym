"use client";

import { useEffect, useRef, useState } from "react";

// 통증 위치를 그림으로 콕 짚어 표시할 수 있는 캔버스. 임상에서 흔히 쓰는 관례대로
// 펜 색상에 의미를 부여한다(빨강=통증/파랑=저림·감각저하/초록=약화/검정=기타).
// 몸 그림은 저작권 걱정 없는 아주 단순한 실루엣(원+두꺼운 둥근 선)으로 직접 그려서
// 어디를 짚었는지 알아볼 수 있을 정도로만 깔끔하게 표현한다.
const PEN_COLORS = [
  { value: "#d1483f", label: "통증" },
  { value: "#3b6fd6", label: "저림·감각저하" },
  { value: "#4c9a6b", label: "약화" },
  { value: "#22262b", label: "기타" },
];

const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 400;

type BodyShape =
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "path"; points: [number, number][]; width: number };

const BODY_SHAPES: BodyShape[] = [
  { kind: "circle", cx: 100, cy: 36, r: 25 },
  { kind: "path", points: [[100, 60], [100, 76]], width: 18 },
  { kind: "path", points: [[100, 78], [100, 208]], width: 70 },
  { kind: "path", points: [[76, 92], [54, 146], [49, 200]], width: 21 },
  { kind: "path", points: [[124, 92], [146, 146], [151, 200]], width: 21 },
  { kind: "path", points: [[81, 205], [77, 300], [73, 378]], width: 29 },
  { kind: "path", points: [[119, 205], [123, 300], [127, 378]], width: 29 },
];

function pointsAttr(points: [number, number][]): string {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function BodyOutline({ borderColor, fillColor }: { borderColor: string; fillColor: string }) {
  return (
    <svg
      viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
      className="absolute inset-0 h-full w-full pointer-events-none"
    >
      {[
        { color: borderColor, extra: 5 },
        { color: fillColor, extra: 0 },
      ].map((pass, passIdx) =>
        BODY_SHAPES.map((shape, i) => {
          const key = `${passIdx}-${i}`;
          if (shape.kind === "circle") {
            return (
              <circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r + pass.extra} fill={pass.color} />
            );
          }
          return (
            <polyline
              key={key}
              points={pointsAttr(shape.points)}
              fill="none"
              stroke={pass.color}
              strokeWidth={shape.width + pass.extra * 2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }),
      )}
    </svg>
  );
}

function DiagramCanvas({
  label,
  value,
  color,
  readOnly,
  onChange,
}: {
  label: string;
  value: string;
  color: string;
  readOnly?: boolean;
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasContentRef = useRef(false);

  // 처음 열었을 때 저장된 그림이 있으면 캔버스에 미리 그려서, 이어서 계속 그릴 수 있게 한다.
  useEffect(() => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !value) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      hasContentRef.current = true;
    };
    img.src = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawingRef.current = true;
    hasContentRef.current = true;
    const { x, y } = getPoint(e);
    // 드래그 없이 콕 찍기만 해도 점이 남도록, 시작점에 펜 굵기만한 점을 먼저 찍어둔다.
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, 1.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = getPoint(e);
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function handlePointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(hasContentRef.current ? canvas.toDataURL("image/png") : "");
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasContentRef.current = false;
    onChange("");
  }

  return (
    <div>
      <p className="text-xs text-ink/50 mb-1.5 text-center">{label}</p>
      <div
        className="relative rounded-xl border border-line bg-white overflow-hidden touch-none"
        style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
      >
        <BodyOutline borderColor="#ddd6c4" fillColor="#f7f5ee" />
        {readOnly ? (
          value && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt={`${label} 통증 표시`}
              className="absolute inset-0 h-full w-full"
            />
          )
        ) : (
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="absolute inset-0 h-full w-full touch-none"
          />
        )}
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={handleClear}
          className="mt-1.5 w-full text-xs text-coral hover:opacity-70 transition"
        >
          지우기
        </button>
      )}
    </div>
  );
}

export function BodyPainDiagram({
  front,
  back,
  onChange,
  readOnly,
}: {
  front: string;
  back: string;
  onChange?: (next: { front: string; back: string }) => void;
  readOnly?: boolean;
}) {
  const [color, setColor] = useState(PEN_COLORS[0].value);

  if (readOnly && !front && !back) {
    return <p className="text-sm text-ink/40">표시된 통증 위치가 없어요.</p>;
  }

  return (
    <div>
      {!readOnly && (
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-xs text-ink/50 mr-0.5">펜 색상</span>
          {PEN_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              title={c.label}
              aria-label={c.label}
              className={[
                "h-7 w-7 rounded-full border-2 transition",
                color === c.value ? "border-ink" : "border-transparent",
              ].join(" ")}
              style={{ backgroundColor: c.value }}
            />
          ))}
          <label className="flex items-center gap-1.5 text-xs text-ink/50 cursor-pointer ml-1">
            직접 선택
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-7 w-9 rounded border border-line/60 cursor-pointer p-0.5"
            />
          </label>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <DiagramCanvas
          label="앞"
          value={front}
          color={color}
          readOnly={readOnly}
          onChange={(v) => onChange?.({ front: v, back })}
        />
        <DiagramCanvas
          label="뒤"
          value={back}
          color={color}
          readOnly={readOnly}
          onChange={(v) => onChange?.({ front, back: v })}
        />
      </div>
    </div>
  );
}
