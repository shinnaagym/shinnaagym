"use client";

export function PrintButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className ?? "rounded-full border border-line px-4 py-2 text-sm hover:bg-bone transition"}
    >
      🖨️ 인쇄 / PDF 저장
    </button>
  );
}
