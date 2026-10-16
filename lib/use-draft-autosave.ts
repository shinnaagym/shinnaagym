"use client";

import { useEffect, useRef, useState } from "react";

// PT 일지·문진표·평가지처럼 작성에 시간이 걸리는 긴 폼은, 세션 만료나 실수로
// 탭을 닫는 일이 있어도 적던 내용을 복구할 수 있도록 브라우저(localStorage)에
// 주기적으로 임시저장해둔다. 서버 저장과는 무관한 편의 기능이라 실패해도
// 조용히 넘어가야 한다(사파리 프라이빗 모드, 저장 공간 꽉 참 등).
const AUTOSAVE_DEBOUNCE_MS = 800;
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface DraftEnvelope<T> {
  value: T;
  savedAt: number;
}

function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 조용히 무시 — 자동저장은 편의 기능일 뿐, 실패해도 수동 저장 흐름에는 영향 없어야 한다.
  }
}

function safeRemoveItem(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 위와 같음.
  }
}

/** 임시저장된 값을 읽는다. 저장한 지 너무 오래됐으면(7일) 의미가 없다고 보고 버린다. */
export function readDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = safeGetItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      safeRemoveItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  safeRemoveItem(key);
}

/** value가 바뀔 때마다(짧은 디바운스를 두고) 로컬에 임시저장한다. enabled가
    false인 동안은 아무것도 쓰지 않는다 — 복구할지 아직 묻는 중인데 빈 초기값으로
    기존 임시저장을 덮어쓰는 일을 막기 위함. */
export function useDraftAutosave<T>(key: string, value: T, enabled: boolean): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const envelope: DraftEnvelope<T> = { value, savedAt: Date.now() };
      safeSetItem(key, JSON.stringify(envelope));
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [key, value, enabled]);
}

/** 마운트 시 로컬에 남아있는 임시저장을 한 번 확인한다. 있으면 그대로 반환해
    "불러올까요?" 배너를 띄우는 데 쓰고, 선택이 끝나면 resolve()로 자동저장을
    켠다(불러오기/삭제 둘 다 resolve 필요). */
export function usePendingDraft<T>(key: string): {
  pendingDraft: T | null;
  resolved: boolean;
  resolve: () => void;
  discard: () => void;
} {
  const [pendingDraft, setPendingDraft] = useState<T | null>(null);
  const [resolved, setResolved] = useState(false);

  // localStorage는 서버에 없어 SSR 시점엔 항상 "임시저장 없음"으로 그리고, 마운트
  // 후 이 한 번만 클라이언트에 실제로 남아있는 임시저장을 확인한다(구독할 외부
  // 이벤트가 없는 최초 1회성 하이드레이션이라 setState-in-effect 규칙을 비켜간다).
  useEffect(() => {
    const existing = readDraft<T>(key);
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingDraft(existing);
    } else {
      setResolved(true);
    }
    // key는 마운트 시점에 고정된 값이라 최초 1회만 확인하면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resolve() {
    setPendingDraft(null);
    setResolved(true);
  }

  function discard() {
    clearDraft(key);
    resolve();
  }

  return { pendingDraft, resolved, resolve, discard };
}
