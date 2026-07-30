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

const PEN_WIDTHS = [
  { value: 2.5, label: "얇게" },
  { value: 4.5, label: "보통" },
  { value: 7, label: "굵게" },
  { value: 10.5, label: "매우 굵게" },
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
  front: { label: "전면", src: "/body-diagram/front.png", width: 350, height: 704 },
  back: { label: "후면", src: "/body-diagram/back.png", width: 355, height: 704 },
  left: { label: "좌측면", src: "/body-diagram/side.png", width: 170, height: 704 },
  right: { label: "우측면", src: "/body-diagram/side-flipped.png", width: 170, height: 704 },
  feet: { label: "발", src: "/body-diagram/feet.png", width: 366, height: 310 },
  hands: { label: "손", src: "/body-diagram/hands.png", width: 365, height: 292 },
};

function DiagramCanvas({
  regionKey,
  value,
  color,
  strokeWidth,
  readOnly,
  onChange,
}: {
  regionKey: BodyRegionKey;
  value: string;
  color: string;
  strokeWidth: number;
  readOnly?: boolean;
  onChange: (dataUrl: string) => void;
}) {
  const meta = REGION_META[regionKey];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasContentRef = useRef(false);
  // 획을 하나 그리기 시작할 때마다 "그 직전 상태"를 스냅샷으로 쌓아두고, 되돌리기를
  // 누르면 가장 최근 스냅샷 하나만 복원한다(전체 지우기가 아니라 한 획씩 되돌리기).
  const historyRef = useRef<{ dataUrl: string; hadContent: boolean }[]>([]);

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

  // 부위마다 캔버스 내부 해상도(meta.width)와 실제 화면에 렌더링되는 크기가 달라
  // (예: 측면은 폭이 좁아 후면과 다른 배율로 확대/축소된다), 같은 strokeWidth
  // 값이라도 화면에 보이는 굵기가 부위마다 달라질 수 있다. strokeWidth는 "화면
  // 픽셀 기준 굵기"로 취급하고, 실제로 그릴 때는 그 순간의 캔버스-화면 배율
  // (scaleX)을 곱해 항상 같은 화면 굵기로 보이게 한다.
  function getPointAndScale(e: React.PointerEvent<HTMLCanvasElement>): {
    x: number;
    y: number;
    scaleX: number;
  } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY, scaleX };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    historyRef.current.push({
      dataUrl: canvas.toDataURL("image/png"),
      hadContent: hasContentRef.current,
    });
    drawingRef.current = true;
    hasContentRef.current = true;
    const { x, y, scaleX } = getPointAndScale(e);
    // 드래그 없이 콕 찍기만 해도 점이 남도록, 시작점에 펜 굵기만한 점을 먼저 찍어둔다.
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, (strokeWidth * scaleX) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y, scaleX } = getPointAndScale(e);
    ctx.lineWidth = strokeWidth * scaleX;
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

  function handleUndo() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const prev = historyRef.current.pop();
    if (!prev) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (prev.hadContent) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      hasContentRef.current = prev.hadContent;
      onChange(prev.hadContent ? prev.dataUrl : "");
    };
    img.src = prev.dataUrl;
  }

  return (
    <div>
      <div
        className="relative rounded-xl border border-line bg-white overflow-hidden touch-none mx-auto"
        style={{ aspectRatio: `${meta.width} / ${meta.height}`, maxWidth: 280, maxHeight: 560 }}
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
          onClick={handleUndo}
          className="mt-1.5 w-full text-xs text-coral hover:opacity-70 transition"
        >
          되돌리기 (한 획씩 취소)
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
  const [strokeWidth, setStrokeWidth] = useState(PEN_WIDTHS[1].value);
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

      {!readOnly && (
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="text-xs text-ink/50 mr-0.5">굵기</span>
          {PEN_WIDTHS.map((w) => (
            <button
              key={w.value}
              type="button"
              onClick={() => setStrokeWidth(w.value)}
              title={w.label}
              aria-label={w.label}
              className={[
                "h-7 w-7 rounded-full border flex items-center justify-center transition",
                strokeWidth === w.value ? "border-coral bg-coral/5" : "border-line hover:bg-bone",
              ].join(" ")}
            >
              <span
                className="rounded-full bg-ink"
                style={{ width: w.value, height: w.value }}
              />
            </button>
          ))}
        </div>
      )}

      <DiagramCanvas
        key={active}
        regionKey={active}
        value={value[active]}
        color={color}
        strokeWidth={strokeWidth}
        readOnly={readOnly}
        onChange={(v) => onChange?.({ ...value, [active]: v })}
      />
    </div>
  );
}
