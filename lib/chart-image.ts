const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * 화면에 항상 보이는 인라인 그래프는 글자 수와 무관하게 예전 크기를 그대로
 * 유지해야 해서, "처음→최근 요약" 같은 상세 문구는 인라인 SVG에는 넣지 않는다.
 * 대신 확대(줌)·이미지 저장 시에만 이 함수로 원본 SVG를 복제해 아래쪽에 여백을
 * 늘리고 요약 줄을 추가한 새 SVG를 만들어, svgToPngDataUrl로 캡처한다.
 */
export function appendSummaryToSvgClone(
  original: SVGSVGElement,
  lines: string[],
  colors: string[],
  padLeft: number,
  width: number,
  height: number,
): SVGSVGElement {
  const clone = original.cloneNode(true) as SVGSVGElement;
  if (lines.length === 0) return clone;

  const lineHeight = 15;
  const top = height + 14;
  const totalHeight = top + lines.length * lineHeight + 4;
  clone.setAttribute("viewBox", `0 0 ${width} ${totalHeight}`);

  const divider = document.createElementNS(SVG_NS, "line");
  divider.setAttribute("x1", String(padLeft));
  divider.setAttribute("x2", String(width - 16));
  divider.setAttribute("y1", String(height + 2));
  divider.setAttribute("y2", String(height + 2));
  divider.setAttribute("stroke", "#e5e0d3");
  divider.setAttribute("stroke-width", "1");
  clone.appendChild(divider);

  lines.forEach((line, i) => {
    const y = top + i * lineHeight;

    const swatch = document.createElementNS(SVG_NS, "rect");
    swatch.setAttribute("x", String(padLeft));
    swatch.setAttribute("y", String(y - 7));
    swatch.setAttribute("width", "8");
    swatch.setAttribute("height", "8");
    swatch.setAttribute("rx", "2");
    swatch.setAttribute("fill", colors[i] ?? "#4a4638");
    clone.appendChild(swatch);

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(padLeft + 13));
    text.setAttribute("y", String(y));
    text.setAttribute("font-size", "10");
    text.setAttribute("fill", "#4a4638");
    text.textContent = line;
    clone.appendChild(text);
  });

  return clone;
}

// 그래프를 확대해서 보여줄 때, 화면에 그려진 SVG를 그대로 캡처해 PNG로 바꿔주는
// 헬퍼. <svg>를 그대로 확대해서 보여주면 모바일에서 "이미지 저장"(길게 누르기)이
// 동작하지 않는 브라우저가 많아, PNG로 변환한 뒤 <img>로 보여줘야 저장이 된다.
export async function svgToPngDataUrl(svg: SVGSVGElement, scale = 3): Promise<string> {
  const viewBox = svg.getAttribute("viewBox");
  const [, , vbWidth, vbHeight] = viewBox
    ? viewBox.split(/\s+/).map(Number)
    : [0, 0, svg.clientWidth || 640, svg.clientHeight || 220];

  // 그래프 선은 처음 그려질 때 stroke-dasharray/dashoffset + CSS 애니메이션으로
  // 왼쪽에서 오른쪽으로 그려지는 효과를 준다. 이 SVG를 그대로 잘라내 별도
  // 문서(blob URL)로 불러오면 @keyframes 정의가 함께 딸려가지 않아 애니메이션이
  // 아예 적용되지 않고, 선이 시작 상태(dashoffset=1, 즉 안 보이는 상태)로 굳어
  // 버린다. 내보낼 때는 애니메이션 관련 인라인 스타일을 지우고 항상 완성된
  // 모습(선이 끝까지 그려진 상태)으로 캡처한다.
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("path").forEach((path) => {
    path.removeAttribute("style");
  });

  let source = new XMLSerializer().serializeToString(clone);
  if (!source.includes("xmlns=")) {
    source = source.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("이미지를 불러오지 못했어요."));
      el.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = vbWidth * scale;
    canvas.height = vbHeight * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스를 지원하지 않아요.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
