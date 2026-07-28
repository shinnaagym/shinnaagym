// 신규 회원 초진 문진표 구조 정의. 종이 문진표의 항목 순서·구성을 그대로 따른다.

export const EXERCISE_PURPOSE_OPTIONS = [
  { key: "rehab", label: "재활" },
  { key: "posture", label: "체형교정" },
  { key: "diet", label: "다이어트" },
  { key: "learning", label: "운동 배우기" },
  { key: "strength", label: "근력 증가" },
  { key: "growth", label: "키성장" },
] as const;

export const VISIT_CHANNEL_OPTIONS = [
  { value: "blog", label: "블로그" },
  { value: "danggeun", label: "당근" },
  { value: "instagram", label: "인스타그램" },
  { value: "signboard", label: "간판" },
  { value: "banner", label: "현수막" },
  { value: "flyer", label: "전단지" },
  { value: "referral", label: "소개" },
  { value: "other", label: "기타" },
] as const;

export const STANCE_LEG_OPTIONS = [
  { value: "left", label: "왼쪽" },
  { value: "right", label: "오른쪽" },
  { value: "none", label: "없음" },
] as const;

export const LEG_CROSS_OPTIONS = STANCE_LEG_OPTIONS;

export const SLEEP_POSITION_OPTIONS = [
  { value: "supine", label: "바로 누움" },
  { value: "prone", label: "엎드림" },
  { value: "left_side", label: "옆으로(좌)" },
  { value: "right_side", label: "옆으로(우)" },
] as const;

export const SLEEP_QUALITY_OPTIONS = [
  { value: "bad", label: "나쁨" },
  { value: "normal", label: "보통" },
  { value: "good", label: "좋음" },
] as const;

export const STRESS_LEVEL_OPTIONS = [
  { value: "low", label: "낮음" },
  { value: "normal", label: "보통" },
  { value: "high", label: "높음" },
] as const;

// 급성/아급성/만성 구분 기준: 국제통증학회(IASP)의 만성통증 정의(3개월/12주 초과 지속)
// 및 근골격계 재활 문헌(예: APTA 요통 임상실무지침)에서 널리 쓰이는 4주/12주 구간을 따른다.
export const PAIN_ONSET_TYPE_OPTIONS = [
  { value: "acute", label: "급성 (4주 이내)" },
  { value: "subacute", label: "아급성 (4~12주)" },
  { value: "chronic", label: "만성 (12주 초과)" },
] as const;

export const PAIN_CYCLE_PERIODS = [
  { key: "morning", label: "아침" },
  { key: "noon", label: "점심" },
  { key: "evening", label: "저녁" },
  { key: "night", label: "밤" },
] as const;

export type PainCyclePeriodKey = (typeof PAIN_CYCLE_PERIODS)[number]["key"];

export const PAIN_CHARACTERISTIC_OPTIONS = [
  { key: "dull", label: "둔한 느낌" },
  { key: "heavy", label: "무거운 느낌" },
  { key: "sharp", label: "날카로운 통증" },
  { key: "stabbing", label: "찌르는 듯한 통증" },
  { key: "tender", label: "누를 때 아픈 느낌" },
  { key: "burning", label: "불타는 듯한 통증" },
  { key: "shooting", label: "전기 쏘는 듯한 통증" },
  { key: "crawling", label: "벌레가 기어가는 느낌" },
  { key: "numb", label: "감각이 무뎌짐" },
  { key: "allodynia", label: "가벼운 터치에도 통증" },
  { key: "tingling", label: "퍼지듯이 저린 느낌" },
  { key: "cramping", label: "쥐어짜는 듯한 통증" },
  { key: "weakness", label: "힘이 빠지는 느낌" },
  { key: "thermal", label: "온·냉 자극에 통증" },
  { key: "throbbing", label: "통증 부위가 두근거리는 느낌" },
  { key: "ischemic", label: "피가 안 통하는 느낌" },
  { key: "clicking", label: "딸깍거리는 느낌" },
  { key: "stiff", label: "결리는 느낌" },
  { key: "pulling", label: "당기는 느낌" },
] as const;
