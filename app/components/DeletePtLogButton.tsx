"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeletePtLogButton({
  ptLogId,
  className,
}: {
  ptLogId: number;
  className?: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("이 PT 일지를 삭제할까요? 되돌릴 수 없어요.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/pt-logs/${ptLogId}`, { method: "DELETE" });
      if (!res.ok) {
        window.alert("삭제에 실패했어요.");
        setDeleting(false);
        return;
      }
      router.refresh();
    } catch {
      window.alert("네트워크 오류가 발생했어요.");
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className={className ?? "text-sm text-coral hover:opacity-70 disabled:opacity-50"}
    >
      {deleting ? "삭제 중..." : "삭제"}
    </button>
  );
}
