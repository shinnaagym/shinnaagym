"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface MemberOption {
  id: number;
  name: string;
  phone: string;
}

export function AssessmentLanding({
  members,
  assessmentCounts,
}: {
  members: MemberOption[];
  assessmentCounts: [number, number][];
}) {
  const router = useRouter();
  const countMap = useMemo(() => new Map(assessmentCounts), [assessmentCounts]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.trim();
    return members.filter((m) => m.name.includes(q) || m.phone.includes(q));
  }, [members, search]);

  async function handleCreate() {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) {
      setError("이름을 입력해주세요.");
      return;
    }
    if (!trimmedPhone) {
      setError("연락처를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/consultees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, phone: trimmedPhone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "등록에 실패했어요.");
        return;
      }
      const data = await res.json();
      router.push(`/admin/members/${data.member.id}/assessment/new`);
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="rounded-2xl border border-coral/30 bg-coral/5 px-5 py-4 mb-6">
        <h2 className="font-display text-base mb-3">+ 새 상담자 등록</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className="flex-1 min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="연락처 *"
            className="flex-1 min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={submitting}
            className="shrink-0 whitespace-nowrap rounded-lg bg-coral text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {submitting ? "등록 중..." : "평가지 작성 시작"}
          </button>
        </div>
        {error && <p className="text-xs text-coral mt-2">{error}</p>}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="이름 또는 연락처 검색"
        className="w-full rounded-full border border-line bg-white px-4 py-2 text-sm outline-none focus:border-coral mb-4"
      />

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-line/60 px-5 py-8 text-center text-ink/40 text-sm">
          회원이 없어요.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => {
            const count = countMap.get(m.id) ?? 0;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/admin/members/${m.id}/assessment`)}
                  className="w-full flex items-center justify-between rounded-2xl bg-white border border-line/60 shadow-sm px-4 py-3 text-left hover:border-coral/40 transition"
                >
                  <div>
                    <p className="font-medium">{m.name}</p>
                    {m.phone && <p className="text-xs text-ink/40 mt-0.5">{m.phone}</p>}
                  </div>
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
                      count > 0 ? "bg-sage/20 text-sage" : "bg-line/40 text-ink/50",
                    ].join(" ")}
                  >
                    {count > 0 ? `평가 ${count}건` : "미작성"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
