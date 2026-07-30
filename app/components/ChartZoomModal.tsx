"use client";

// 통증 척도·운동 수행능력 그래프를 탭하면 뜨는 확대 보기 모달. 이미지를 길게
// 눌러 저장하거나(모바일) 다운로드 버튼을 눌러(데스크톱) 저장할 수 있다.
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
  if (!open) return null;

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
            <a
              href={imageUrl}
              download={`${title}.png`}
              className="mt-3 block w-full rounded-full bg-ink text-white py-2.5 text-sm font-medium text-center hover:bg-coral transition"
            >
              이미지 다운로드
            </a>
          </>
        )}
      </div>
    </div>
  );
}
