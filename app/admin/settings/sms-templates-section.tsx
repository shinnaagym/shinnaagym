"use client";

import { useState } from "react";
import {
  SMS_TEMPLATE_DEFS,
  renderSmsTemplate,
  type SmsTemplateKey,
} from "@/lib/sms-templates";

/** 솔라피가 90바이트(UTF-8, 한글 1자=3바이트)를 넘으면 자동으로 더 비싼
    장문(LMS)으로 보낸다 — lib/sms.ts의 실제 판단 기준과 동일하게, 여기서도
    브라우저용 TextEncoder로 같은 길이를 계산해 미리 알려준다. */
function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function TemplateCard({
  def,
  initialBody,
}: {
  def: (typeof SMS_TEMPLATE_DEFS)[number];
  initialBody: string;
}) {
  const [value, setValue] = useState(initialBody);
  const [savedValue, setSavedValue] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = value !== savedValue;
  const isDefault = value === def.defaultBody;
  const preview = renderSmsTemplate(value, def.sampleVars);
  const bytes = byteLength(preview);
  const isLong = bytes > 90;

  async function save(nextBody: string) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/sms-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: def.key, body: nextBody }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "저장에 실패했어요.");
        return;
      }
      const data = (await res.json()) as { templates: Record<SmsTemplateKey, string> };
      const applied = data.templates[def.key];
      setValue(applied);
      setSavedValue(applied);
      setSaved(true);
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-line/60 bg-bone/20 p-4">
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <p className="text-sm font-medium">{def.label}</p>
        {!isDefault && (
          <button
            type="button"
            onClick={() => save("")}
            disabled={saving}
            className="shrink-0 text-xs text-ink/40 hover:text-coral transition disabled:opacity-40"
          >
            기본 문구로 되돌리기
          </button>
        )}
      </div>
      <p className="text-xs text-ink/50 mb-2">{def.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {def.placeholders.map((p) => (
          <span
            key={p.token}
            title={p.description}
            className="rounded-full bg-white border border-line/60 px-2 py-0.5 text-[11px] text-ink/60"
          >
            {p.token}
          </span>
        ))}
      </div>

      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        rows={7}
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral font-mono"
      />

      <div className="mt-2 rounded-lg bg-white border border-line/50 px-3 py-2">
        <p className="text-[11px] text-ink/40 mb-1">
          미리보기 ({bytes}바이트 · {isLong ? "장문(LMS)" : "단문(SMS)"})
        </p>
        <p className="text-xs text-ink/70 whitespace-pre-wrap break-words">{preview}</p>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={() => save(value)}
          disabled={saving || !dirty}
          className="rounded-full bg-coral text-white px-4 py-1.5 text-xs font-medium hover:opacity-90 transition disabled:opacity-40"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        {saved && <span className="text-xs text-sage">저장했어요.</span>}
        {error && <span className="text-xs text-coral">{error}</span>}
      </div>
    </div>
  );
}

export function SmsTemplatesSection({
  initialTemplates,
}: {
  initialTemplates: Record<SmsTemplateKey, string>;
}) {
  return (
    <section className="rounded-2xl bg-white border border-line/60 shadow-sm p-6">
      <h2 className="font-display text-lg mb-1">문자 문구 설정</h2>
      <p className="text-xs text-ink/50 mb-4">
        상담·PT 리마인드 문자의 문구를 직접 고칠 수 있어요. {"{중괄호}"}로 감싼 부분은 발송
        시점에 실제 값(이름·날짜 등)으로 자동 바뀌니 그대로 남겨두세요.
      </p>
      <div className="space-y-4">
        {SMS_TEMPLATE_DEFS.map((def) => (
          <TemplateCard key={def.key} def={def} initialBody={initialTemplates[def.key]} />
        ))}
      </div>
    </section>
  );
}
