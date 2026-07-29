"use client";

import { memo } from "react";
import type { PromItem } from "@/lib/prom-instruments";

export function Accordion({
  label,
  isOpen,
  onToggle,
  children,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white overflow-hidden mb-3">
      <button
        type="button"
        onClick={onToggle}
        className="no-print w-full flex items-center justify-between px-4 py-3 text-left font-display text-base hover:bg-bone/40 transition"
      >
        <span>{label}</span>
        <span className="text-ink/40">{isOpen ? "▲" : "▼"}</span>
      </button>
      <div className={isOpen ? "block" : "hidden print:block"}>{children}</div>
    </div>
  );
}

const PromItemRow = memo(function PromItemRow({
  item,
  value,
  onAnswer,
}: {
  item: PromItem;
  value: number | undefined;
  onAnswer: (key: string, value: number) => void;
}) {
  return (
    <div className="px-4 py-2.5 border-t border-line/50 first:border-t-0">
      <label className="block text-sm mb-1.5">{item.title}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onAnswer(item.key, Number(e.target.value))}
        className="w-full rounded-lg border border-line px-2.5 py-2 text-sm outline-none focus:border-coral bg-white"
      >
        <option value="" disabled>
          선택
        </option>
        {item.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
});

export const PromAccordion = memo(function PromAccordion({
  title,
  scoreLabel,
  items,
  answers,
  onAnswer,
  isOpen,
  toggleKey,
  onToggle,
}: {
  title: string;
  scoreLabel: string | null;
  items: readonly PromItem[];
  answers: Record<string, number>;
  onAnswer: (key: string, value: number) => void;
  isOpen: boolean;
  toggleKey: string;
  onToggle: (key: string) => void;
}) {
  return (
    <Accordion
      label={scoreLabel ? `${title} — ${scoreLabel}` : title}
      isOpen={isOpen}
      onToggle={() => onToggle(toggleKey)}
    >
      {items.map((item) => (
        <PromItemRow key={item.key} item={item} value={answers[item.key]} onAnswer={onAnswer} />
      ))}
    </Accordion>
  );
});
