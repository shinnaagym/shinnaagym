"use client";

/** 로컬에 임시저장된 작성 중 내용을 발견했을 때 폼 맨 위에 띄우는 배너.
    PT 일지·문진표·평가지 폼에서 공통으로 쓴다. */
export function DraftRestoreBanner({
  onRestore,
  onDiscard,
}: {
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="no-print rounded-2xl border border-coral/30 bg-coral/5 px-5 py-4 mb-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink/70">
        <span className="font-medium text-ink">임시저장된 작성 중 내용이 있어요.</span> 불러올까요?
      </p>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-bone transition"
        >
          지우고 새로 작성
        </button>
        <button
          type="button"
          onClick={onRestore}
          className="rounded-full bg-coral text-white px-3 py-1.5 text-xs hover:opacity-90 transition"
        >
          불러오기
        </button>
      </div>
    </div>
  );
}
