"use client";

import { useState } from "react";

// 통증 척도·운동 수행능력 그래프를 탭하면 뜨는 확대 보기 모달. 이미지를 길게
// 눌러 저장하거나(모바일) 다운로드 버튼을 눌러(데스크톱) 저장할 수 있다.
//
// 다운로드 버튼은 <a download>만으로는 iOS Safari에서 data: URL을 그냥
// 열어버릴 뿐 실제로 저장되지 않는 경우가 많아, 우선 Web Share API(파일 공유
// 시트에서 "사진에 저장"을 고를 수 있음)를 시도하고, 지원하지 않는 환경(주로
// 데스크톱 브라우저)에서만 기존 <a download> 방식으로 폴백한다.
export function ChartZoomModal({
  open,
  title,
  imageUrl,
  loading,
  onClose,
}: {
  open: boolean;
  title: string;
  imageUrl: string | null;
  loading: boolean;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleSave() {
    if (!imageUrl) return;
    setSaving(true);
    try {
      const nav = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
        canShare?: (data: ShareData) => boolean;
      };
      if (nav.share && nav.canShare) {
        const blob = await (await fetch(imageUrl)).blob();
        const file = new File([blob], `${title}.png`, { type: "image/png" });
        if (nav.canShare({ files: [file] })) {
          await nav.share({ files: [file] });
          return;
        }
      }
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = `${title}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // 공유 시트를 취소한 경우 등은 조용히 무시한다.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/70 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-full overflow-y-auto rounded-2xl bg-white shadow-xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-display text-base">{title}</p>
          <button onClick={onClose} className="text-ink/40 hover:text-ink text-xl leading-none">
            ×
          </button>
        </div>

        {loading && <p className="text-sm text-ink/40 py-10 text-center">이미지 준비 중...</p>}

        {!loading && imageUrl && (
          <>
            <img src={imageUrl} alt={title} className="w-full h-auto rounded-lg border border-line/60" />
            <p className="text-xs text-ink/40 mt-3 text-center">
              이미지를 길게 눌러 저장하거나, 아래 버튼으로 다운로드하세요.
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="mt-3 block w-full rounded-full bg-ink text-white py-2.5 text-sm font-medium text-center hover:bg-coral transition disabled:opacity-50"
            >
              {saving ? "저장 중..." : "이미지 다운로드"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
