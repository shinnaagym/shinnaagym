/** 날짜별 스케줄 메모를 체크리스트로 다루기 위한 순수 파싱/직렬화 로직.
    클라이언트 컴포넌트(schedule-grid.tsx)와 서버 쪽(recurring-events.ts) 양쪽에서
    같이 쓰므로, DB 접근 코드가 없는 이 파일에 따로 둔다(daily-schedule-memos.ts는
    "./db"를 import해서 클라이언트 번들에 넣을 수 없다). */

export interface DailyMemoItem {
  text: string;
  done: boolean;
}

const CHECKBOX_RE = /^\[([ xX])\]\s?(.*)$/;

/** 저장된 메모(줄바꿈으로 구분된 문자열)를 체크리스트 항목으로 바꾼다. 이
    기능이 생기기 전에 적어둔 줄이나 정기 일정이 자동으로 추가한 줄처럼
    체크박스 표시가 없는 줄도 미완료 항목으로 취급한다. */
export function parseDailyMemoItems(content: string): DailyMemoItem[] {
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line) => {
      const m = line.match(CHECKBOX_RE);
      return m ? { text: m[2], done: m[1].toLowerCase() === "x" } : { text: line, done: false };
    });
}

export function serializeDailyMemoItems(items: DailyMemoItem[]): string {
  return items.map((it) => `[${it.done ? "x" : " "}] ${it.text}`).join("\n");
}

/** 체크박스 표시를 떼고 순수 텍스트만 비교할 때 쓴다 — 정기 일정이 같은
    이름의 줄을 이미 추가해뒀는지 확인할 때, 체크 여부와 무관하게 비교해야
    중복으로 추가하지 않는다. */
export function dailyMemoLineText(line: string): string {
  const m = line.trim().match(CHECKBOX_RE);
  return m ? m[2] : line.trim();
}
