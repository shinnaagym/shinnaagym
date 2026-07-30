"use client";

import { useEffect, useRef, useState } from "react";

// 통증 위치를 그림으로 콕 짚어 표시할 수 있는 캔버스. 전면/후면/좌측면/우측면/발/손
// 6개 부위 중 하나를 골라 그 부위의 해부학 그림 위에 직접 그린다. 펜 색상은 임상에서
// 흔히 쓰는 관례대로 의미를 부여한다(빨강=통증/파랑=저림·감각저하/초록=약화/검정=기타).
const PEN_COLORS = [
  { value: "#d1483f", label: "통증" },
  { value: "#3b6fd6", label: "저림·감각저하" },
  { value: "#4c9a6b", label: "약화" },
  { value: "#22262b", label: "기타" },
];

export type BodyRegionKey = "front" | "back" | "left" | "right" | "feet" | "hands";
export type BodyDiagramValue = Record<BodyRegionKey, string>;

export const EMPTY_BODY_DIAGRAM: BodyDiagramValue = {
  front: "",
  back: "",
  left: "",
  right: "",
  feet: "",
  hands: "",
};

const REGION_ORDER: BodyRegionKey[] = ["front", "back", "left", "right", "feet", "hands"];

const REGION_META: Record<
  BodyRegionKey,
  { label: string; src: string; width: number; height: number }
> = {
  front: { label: "전면", src: "/body-diagram/front.png", width: 340, height: 704 },
  back: { label: "후면", src: "/body-diagram/back.png", width: 350, height: 704 },
  left: { label: "좌측면", src: "/body-diagram/side.png", width: 295, height: 704 },
  right: { label: "우측면", src: "/body-diagram/side-flipped.png", width: 295, height: 704 },
  feet: { label: "발", src: "/body-diagram/feet.png", width: 439, height: 334 },
  hands: { label: "손", src: "/body-diagram/hands.png", width: 439, height: 337 },
};

function DiagramCanvas({
  regionKey,
  value,
  color,
  readOnly,
  onChange,
}: {
  regionKey: BodyRegionKey;
  value: string;
  color: string;
  readOnly?: boolean;
  onChange: (dataUrl: string) => void;
}) {
  const meta = REGION_META[regionKey];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasContentRef = useRef(false);

  // 부위를 바꾸거나 처음 열었을 때, 저장된 그림이 있으면 캔버스에 미리 그려서
  // 이어서 계속 그릴 수 있게 한다.
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
    ctx.arc(x, y, 2.25, 0, Math.PI * 2);
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
    ctx.lineWidth = 4.5;
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
      <div
        className="relative rounded-xl border border-line bg-white overflow-hidden touch-none mx-auto"
        style={{ aspectRatio: `${meta.width} / ${meta.height}`, maxWidth: 280 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={meta.src}
          alt={meta.label}
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain pointer-events-none select-none"
        />
        {readOnly ? (
          value && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt={`${meta.label} 통증 표시`}
              className="absolute inset-0 h-full w-full"
            />
          )
        ) : (
          <canvas
            ref={canvasRef}
            width={meta.width}
            height={meta.height}
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
  value,
  onChange,
  readOnly,
}: {
  value: BodyDiagramValue;
  onChange?: (next: BodyDiagramValue) => void;
  readOnly?: boolean;
}) {
  const [color, setColor] = useState(PEN_COLORS[0].value);
  const [active, setActive] = useState<BodyRegionKey>("front");

  if (readOnly && REGION_ORDER.every((k) => !value[k])) {
    return <p className="text-sm text-ink/40">표시된 통증 위치가 없어요.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {REGION_ORDER.map((key) => {
          const meta = REGION_META[key];
          const marked = !!value[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={[
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                active === key
                  ? "bg-coral text-white border-coral"
                  : "border-line text-ink/60 hover:bg-bone",
              ].join(" ")}
            >
              {meta.label}
              {marked && (
                <span className={active === key ? "ml-1" : "ml-1 text-coral"}>●</span>
              )}
            </button>
          );
        })}
      </div>

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

      <DiagramCanvas
        key={active}
        regionKey={active}
        value={value[active]}
        color={color}
        readOnly={readOnly}
        onChange={(v) => onChange?.({ ...value, [active]: v })}
      />
    </div>
  );
}
