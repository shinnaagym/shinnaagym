// 그래프를 확대해서 보여줄 때, 화면에 그려진 SVG를 그대로 캡처해 PNG로 바꿔주는
// 헬퍼. <svg>를 그대로 확대해서 보여주면 모바일에서 "이미지 저장"(길게 누르기)이
// 동작하지 않는 브라우저가 많아, PNG로 변환한 뒤 <img>로 보여줘야 저장이 된다.
export async function svgToPngDataUrl(svg: SVGSVGElement, scale = 3): Promise<string> {
  const viewBox = svg.getAttribute("viewBox");
  const [, , vbWidth, vbHeight] = viewBox
    ? viewBox.split(/\s+/).map(Number)
    : [0, 0, svg.clientWidth || 640, svg.clientHeight || 220];

  let source = new XMLSerializer().serializeToString(svg);
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
