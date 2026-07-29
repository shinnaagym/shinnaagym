"use client";

import { useState } from "react";
import type { NoticeCategory, NoticeRow } from "@/lib/db";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function NoticeSection({
  category,
  title,
  description,
  initialItems,
}: {
  category: NoticeCategory;
  title: string;
  description: string;
  initialItems: NoticeRow[];
}) {
  const [items, setItems] = useState(initialItems);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function addItem() {
    if (!newTitle.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    setError(null);
    const res = await fetch("/api/admin/notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, title: newTitle.trim(), content: newContent.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "등록에 실패했습니다.");
      return;
    }
    setItems((prev) => [data.notice, ...prev]);
    setNewTitle("");
    setNewContent("");
  }

  function startEdit(item: NoticeRow) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: number) {
    if (!editTitle.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    setError(null);
    const res = await fetch(`/api/admin/notices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim(), content: editContent.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "수정에 실패했습니다.");
      return;
    }
    setItems((prev) => prev.map((n) => (n.id === id ? data.notice : n)));
    setEditingId(null);
  }

  async function removeItem(id: number) {
    if (!confirm("삭제할까요?")) return;
    await fetch(`/api/admin/notices/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <section className="rounded-2xl bg-white border border-line/60 shadow-sm p-6">
      <h2 className="font-display text-lg mb-1">{title}</h2>
      <p className="text-xs text-ink/50 mb-4">{description}</p>

      <div className="divide-y divide-line/50">
        {items.length === 0 && (
          <p className="py-4 text-sm text-ink/40">등록된 항목이 없어요.</p>
        )}
        {items.map((item) =>
          editingId === item.id ? (
            <div key={item.id} className="py-3 space-y-2">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="제목"
                className="w-full rounded-lg border border-line px-3.5 py-2 text-sm outline-none focus:border-coral"
              />
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="내용"
                rows={3}
                className="w-full rounded-lg border border-line px-3.5 py-2 text-sm outline-none focus:border-coral resize-y"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={cancelEdit}
                  className="rounded-full border border-line px-3.5 py-1.5 text-xs text-ink/60 hover:bg-bone transition"
                >
                  취소
                </button>
                <button
                  onClick={() => saveEdit(item.id)}
                  className="rounded-full bg-ink text-white px-3.5 py-1.5 text-xs hover:bg-coral transition"
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
            <div key={item.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.content && (
                    <p className="text-xs text-ink/60 mt-1 whitespace-pre-wrap">{item.content}</p>
                  )}
                  <p className="text-[11px] text-ink/35 mt-1.5">{formatDate(item.created_at)}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => startEdit(item)}
                    className="rounded-full border border-line px-3 py-1 text-xs text-ink/60 hover:bg-bone transition"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-400 hover:bg-red-50 transition"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ),
        )}
      </div>

      <div className="flex flex-col gap-2 mt-4">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="제목"
          className="w-full rounded-lg border border-line px-3.5 py-2 text-sm outline-none focus:border-coral"
        />
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="내용 (선택)"
          rows={2}
          className="w-full rounded-lg border border-line px-3.5 py-2 text-sm outline-none focus:border-coral resize-y"
        />
        <button
          onClick={addItem}
          className="self-end whitespace-nowrap rounded-full bg-ink text-white px-4 py-2 text-sm hover:bg-coral transition"
        >
          추가
        </button>
      </div>
      {error && <p className="text-sm text-coral mt-2">{error}</p>}
    </section>
  );
}

export function NoticesView({
  initialNotices,
  initialEvents,
}: {
  initialNotices: NoticeRow[];
  initialEvents: NoticeRow[];
}) {
  return (
    <div className="space-y-6">
      <NoticeSection
        category="notice"
        title="공지사항"
        description="회원과 상담자에게 안내할 일반 공지를 등록하세요."
        initialItems={initialNotices}
      />
      <NoticeSection
        category="event"
        title="진행 중인 이벤트"
        description="현재 진행 중인 이벤트나 프로모션을 등록하세요."
        initialItems={initialEvents}
      />
    </div>
  );
}
