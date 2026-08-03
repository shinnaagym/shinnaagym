"use client";

/** 카드 우측 상단에 놓는 삼각형 펼침/접힘 버튼. 눌렀을 때 접혀있던 내용이 카드
    아래로 나타나고, 다시 누르면 접힌다. 펼쳐지면 삼각형이 180도 돌아 위를 가리킨다. */
export function DisclosureToggle({
  expanded,
  onToggle,
  label,
}: {
  expanded: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={label}
      className="shrink-0 text-lg leading-none text-gold hover:text-gold-deep transition-transform"
      style={{ transform: expanded ? "rotate(180deg)" : undefined }}
    >
      ▽
    </button>
  );
}
