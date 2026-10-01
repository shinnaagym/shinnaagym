"use client";

import { memo } from "react";
import { NRS_PAIN_OPTIONS } from "@/lib/assessment-movements";
import type { CustomFunctionalTestEntry, ExercisePerformanceEntry } from "@/lib/db";

// h-10을 명시하는 이유: <input type="date">는 브라우저 자체 달력 아이콘 때문에
// 같은 padding을 준 일반 텍스트 input보다 몇 px 더 높게 렌더링되는 경우가 있어,
// 높이를 고정해두지 않으면 같은 줄에 나란히 둔 입력칸들의 세로 정렬이 어긋난다.
export function inputClass(): string {
  return "w-full h-10 rounded-lg border border-line px-2.5 py-2 text-sm outline-none focus:border-coral";
}

export interface PainTriggerFormEntry {
  note: string;
  painScale: number | null;
}

// 평가 기록 작성 폼과 PT 일지 목록 페이지가 공유하는 "통증 유발 동작" 입력
// 한 줄 — 어디서 쓰든 같은 모양·같은 데이터(assessments.pain_triggers)로
// 저장된다.
export const PainTriggerRow = memo(function PainTriggerRow({
  index,
  entry,
  pastNotes,
  onChange,
  onRemove,
}: {
  index: number;
  entry: PainTriggerFormEntry;
  pastNotes: string[];
  onChange: (index: number, patch: Partial<PainTriggerFormEntry>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="rounded-xl border border-line/60 px-3 py-3 mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <label className="text-xs text-ink/40">동작 설명</label>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-xs text-coral hover:opacity-70"
        >
          삭제
        </button>
      </div>
      {pastNotes.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) onChange(index, { note: e.target.value });
          }}
          className={inputClass() + " bg-white mb-2"}
        >
          <option value="">이 회원의 과거 문구에서 선택</option>
          {pastNotes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      )}
      <input
        value={entry.note}
        onChange={(e) => onChange(index, { note: e.target.value })}
        placeholder="예: 계단 내려갈 때 무릎 안쪽 통증"
        className={inputClass() + " mb-2"}
      />
      <label className="block text-xs text-ink/40 mb-1.5">통증 척도 (NRS 0~10)</label>
      <div className="flex flex-wrap gap-1.5">
        {NRS_PAIN_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(index, { painScale: Number(n) })}
            className={[
              "h-8 w-8 rounded-full border text-xs font-medium transition",
              entry.painScale === Number(n)
                ? "bg-coral text-white border-coral"
                : "border-line text-ink/60 hover:bg-bone",
            ].join(" ")}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
});

// 평가 기록 작성 폼과 PT 일지 목록 페이지가 공유하는 "운동 수행능력" 입력
// 한 줄 — 어디서 쓰든 같은 모양·같은 데이터(assessments.exercise_performance,
// e1RM 그래프)로 저장된다.
export const ExercisePerformanceRow = memo(function ExercisePerformanceRow({
  index,
  entry,
  pastExercises,
  onChange,
  onRemove,
}: {
  index: number;
  entry: ExercisePerformanceEntry;
  pastExercises: string[];
  onChange: (index: number, patch: Partial<ExercisePerformanceEntry>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="rounded-xl border border-line/60 px-3 py-3 mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <label className="text-xs text-ink/40">운동</label>
        <button type="button" onClick={() => onRemove(index)} className="text-xs text-coral hover:opacity-70">
          삭제
        </button>
      </div>
      {pastExercises.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) onChange(index, { exercise: e.target.value });
          }}
          className={inputClass() + " bg-white mb-2"}
        >
          <option value="">이 회원의 과거 운동에서 선택</option>
          {pastExercises.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      )}
      <input
        value={entry.exercise}
        onChange={(e) => onChange(index, { exercise: e.target.value })}
        placeholder="예: 한 발 점프"
        className={inputClass() + " mb-2"}
      />
      <label className="block text-xs text-ink/40 mb-1.5">메모 (수행능력)</label>
      <input
        value={entry.note}
        onChange={(e) => onChange(index, { note: e.target.value })}
        placeholder="예: 60bpm으로 45회 수행 가능"
        className={inputClass() + " mb-2"}
      />
      <label className="block text-xs text-ink/40 mb-1.5">
        탑세트 (무게·횟수·RPE) — 기록하면 e1RM 그래프에 반영돼요
      </label>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <input
            type="number"
            min="0"
            step="0.5"
            value={entry.weight ?? ""}
            onChange={(e) =>
              onChange(index, { weight: e.target.value === "" ? null : Number(e.target.value) })
            }
            placeholder="무게(kg)"
            className={inputClass()}
          />
        </div>
        <div>
          <input
            type="number"
            min="1"
            step="1"
            value={entry.reps ?? ""}
            onChange={(e) =>
              onChange(index, { reps: e.target.value === "" ? null : Number(e.target.value) })
            }
            placeholder="횟수"
            className={inputClass()}
          />
        </div>
        <div>
          <select
            value={entry.rpe ?? ""}
            onChange={(e) =>
              onChange(index, { rpe: e.target.value === "" ? null : Number(e.target.value) })
            }
            className={inputClass() + " bg-white"}
          >
            <option value="">RPE</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
              <option key={v} value={v}>
                RPE {v}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
});

// 평가 기록 작성 폼이 쓰는 "기능적 움직임 검사 — 추가 검사" 입력 한 줄.
// 미리 정의된 코어/스쿼트/오버헤드스쿼트/푸쉬업/힙힌지/밸런스/YBT 외에
// 트레이너가 그때그때 필요한 검사를 제목+관찰 소견 자유 입력으로 덧붙일
// 때 쓴다(assessments.custom_functional_tests).
export const CustomFunctionalTestRow = memo(function CustomFunctionalTestRow({
  index,
  entry,
  onChange,
  onRemove,
}: {
  index: number;
  entry: CustomFunctionalTestEntry;
  onChange: (index: number, patch: Partial<CustomFunctionalTestEntry>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="rounded-xl border border-line/60 px-3 py-3 mb-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <label className="text-xs text-ink/40">검사 제목</label>
        <button type="button" onClick={() => onRemove(index)} className="text-xs text-coral hover:opacity-70">
          삭제
        </button>
      </div>
      <input
        value={entry.title}
        onChange={(e) => onChange(index, { title: e.target.value })}
        placeholder="예: 싱글레그 스쿼트"
        className={inputClass() + " mb-2"}
      />
      <label className="block text-xs text-ink/40 mb-1.5">관찰 소견</label>
      <textarea
        value={entry.note}
        onChange={(e) => onChange(index, { note: e.target.value })}
        rows={2}
        placeholder="관찰 소견"
        className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-coral resize-none"
      />
    </div>
  );
});
