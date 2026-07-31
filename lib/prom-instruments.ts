// 표준화된 환자 보고 결과 측정 도구(PROM) 정의.
//
// 아래 문항은 공식 원문을 그대로 옮긴 것이 아니라, 임상 현장에서 널리 쓰이는
// 구성(문항 수·응답 척도·채점 방식)을 바탕으로 이해하기 쉽게 다듬어 재구성한
// 것이다. 실제 임상·법적 판단에 사용하기 전에는 각 도구의 공식 원문(ODI,
// NDI, QuickDASH, KOOS, FAAM, STarT Back)과 문항을 대조해 확인을 권장한다.

export interface PromOption {
  value: number;
  label: string;
}

export interface PromItem {
  key: string;
  title: string;
  options: readonly PromOption[];
}

const ODI_NDI_OPTIONS = (labels: readonly string[]): PromOption[] =>
  labels.map((label, i) => ({ value: i, label: `${i} - ${label}` }));

// ---------------------------------------------------------------------------
// ODI (Oswestry Disability Index) — 요추 기능장애, 10문항, 0~100% (낮을수록 좋음)
// ---------------------------------------------------------------------------
export const ODI_ITEMS: PromItem[] = [
  {
    key: "pain_intensity",
    title: "1. 통증 강도",
    options: ODI_NDI_OPTIONS([
      "통증이 전혀 없다",
      "통증이 있지만 매우 약하다",
      "통증이 보통이다",
      "통증이 꽤 심하다",
      "통증이 매우 심하다",
      "상상할 수 있는 가장 심한 통증이다",
    ]),
  },
  {
    key: "personal_care",
    title: "2. 개인 위생(세면, 옷 입기 등)",
    options: ODI_NDI_OPTIONS([
      "통증 없이 정상적으로 할 수 있다",
      "정상적으로 할 수 있지만 통증이 있다",
      "조심스럽고 천천히 해야 통증이 없다",
      "어느 정도 도움이 필요하다",
      "대부분 매일 도움이 필요하다",
      "혼자 옷을 입거나 씻지 못해 침대에 있어야 한다",
    ]),
  },
  {
    key: "lifting",
    title: "3. 물건 들기",
    options: ODI_NDI_OPTIONS([
      "통증 없이 무거운 물건도 들 수 있다",
      "통증은 있지만 무거운 물건을 들 수 있다",
      "바닥의 무거운 물건은 못 들지만 위치가 편하면(탁자 위 등) 들 수 있다",
      "무거운 물건은 못 들지만 위치가 편하면 가벼운~중간 무게는 들 수 있다",
      "아주 가벼운 물건만 들 수 있다",
      "아무것도 들거나 옮길 수 없다",
    ]),
  },
  {
    key: "walking",
    title: "4. 걷기",
    options: ODI_NDI_OPTIONS([
      "통증과 상관없이 얼마든지 걸을 수 있다",
      "통증은 있지만 얼마든지 걸을 수 있다",
      "통증 때문에 1.6km 이상 걷지 못한다",
      "통증 때문에 800m 이상 걷지 못한다",
      "통증 때문에 100m 이상 걷지 못한다",
      "지팡이나 목발을 짚어야만 걷거나 침대에서 나오지 못한다",
    ]),
  },
  {
    key: "sitting",
    title: "5. 앉기",
    options: ODI_NDI_OPTIONS([
      "원하는 의자에 얼마든지 앉을 수 있다",
      "좋아하는 의자에서만 얼마든지 앉을 수 있다",
      "통증 때문에 1시간 이상 앉지 못한다",
      "통증 때문에 30분 이상 앉지 못한다",
      "통증 때문에 10분 이상 앉지 못한다",
      "통증 때문에 전혀 앉지 못한다",
    ]),
  },
  {
    key: "standing",
    title: "6. 서 있기",
    options: ODI_NDI_OPTIONS([
      "통증 없이 원하는 만큼 서 있을 수 있다",
      "통증은 있지만 원하는 만큼 서 있을 수 있다",
      "통증 때문에 1시간 이상 서 있지 못한다",
      "통증 때문에 30분 이상 서 있지 못한다",
      "통증 때문에 10분 이상 서 있지 못한다",
      "통증 때문에 전혀 서 있지 못한다",
    ]),
  },
  {
    key: "sleeping",
    title: "7. 수면",
    options: ODI_NDI_OPTIONS([
      "통증 때문에 수면을 방해받지 않는다",
      "가끔 통증 때문에 수면을 방해받는다",
      "통증 때문에 6시간 미만 잔다",
      "통증 때문에 4시간 미만 잔다",
      "통증 때문에 2시간 미만 잔다",
      "통증 때문에 전혀 자지 못한다",
    ]),
  },
  {
    key: "sex_life",
    title: "8. 성생활(해당 시)",
    options: ODI_NDI_OPTIONS([
      "정상이며 통증 유발이 없다",
      "정상이지만 약간의 통증이 있다",
      "거의 정상이지만 상당히 아프다",
      "통증 때문에 상당히 제한된다",
      "통증 때문에 거의 하지 못한다",
      "통증 때문에 전혀 할 수 없다",
    ]),
  },
  {
    key: "social_life",
    title: "9. 사회 생활",
    options: ODI_NDI_OPTIONS([
      "정상이며 통증으로 인한 문제가 없다",
      "정상이지만 통증이 증가한다",
      "활동적인 것(운동 등)만 제한되고 그 외 문제는 없다",
      "통증 때문에 사회활동이 제한되어 자주 나가지 못한다",
      "통증 때문에 집에서만 지낸다",
      "통증 때문에 사회생활을 전혀 못한다",
    ]),
  },
  {
    key: "traveling",
    title: "10. 이동(여행)",
    options: ODI_NDI_OPTIONS([
      "어디든 통증 없이 이동할 수 있다",
      "약간의 통증이 있지만 2시간 이상 이동할 수 있다",
      "통증 때문에 이동을 2시간 이내로 제한한다",
      "통증 때문에 이동을 1시간 이내로 제한한다",
      "통증 때문에 30분 이내의 필수적인 이동만 한다",
      "통증 때문에 치료 받으러 가는 것 외에는 이동하지 못한다",
    ]),
  },
];

// ---------------------------------------------------------------------------
// NDI (Neck Disability Index) — 경추 기능장애, 10문항, 0~100% (낮을수록 좋음)
// ---------------------------------------------------------------------------
export const NDI_ITEMS: PromItem[] = [
  {
    key: "pain_intensity",
    title: "1. 통증 강도",
    options: ODI_ITEMS[0].options,
  },
  {
    key: "personal_care",
    title: "2. 개인 위생(세면, 옷 입기 등)",
    options: ODI_ITEMS[1].options,
  },
  {
    key: "lifting",
    title: "3. 물건 들기",
    options: ODI_ITEMS[2].options,
  },
  {
    key: "reading",
    title: "4. 독서",
    options: ODI_NDI_OPTIONS([
      "목 통증 없이 원하는 만큼 읽을 수 있다",
      "목에 약간의 통증이 있지만 원하는 만큼 읽을 수 있다",
      "목에 중간 정도 통증이 있어 원하는 만큼 읽지 못한다",
      "목에 중간 정도 통증이 있어 조금만 읽을 수 있다",
      "목의 심한 통증 때문에 거의 읽지 못한다",
      "목 통증 때문에 전혀 읽지 못한다",
    ]),
  },
  {
    key: "headaches",
    title: "5. 두통",
    options: ODI_NDI_OPTIONS([
      "두통이 전혀 없다",
      "약간의 두통이 가끔 있다",
      "중간 정도의 두통이 가끔 있다",
      "중간 정도의 두통이 자주 있다",
      "심한 두통이 자주 있다",
      "거의 항상 두통이 있다",
    ]),
  },
  {
    key: "concentration",
    title: "6. 집중력",
    options: ODI_NDI_OPTIONS([
      "어려움 없이 완전히 집중할 수 있다",
      "원할 때 약간의 어려움만 있고 집중할 수 있다",
      "집중하는 데 다소 어려움이 있다",
      "집중하는 데 상당한 어려움이 있다",
      "집중하는 데 많은 어려움이 있다",
      "전혀 집중할 수 없다",
    ]),
  },
  {
    key: "work",
    title: "7. 직업/업무",
    options: ODI_NDI_OPTIONS([
      "원하는 만큼 일할 수 있다",
      "평소 하던 일만 할 수 있고 그 이상은 못한다",
      "평소 하던 일의 대부분을 할 수 있다",
      "평소 하던 일을 할 수 없다",
      "어떤 일도 하기 힘들다",
      "어떤 일도 할 수 없다",
    ]),
  },
  {
    key: "driving",
    title: "8. 운전",
    options: ODI_NDI_OPTIONS([
      "목 통증 없이 어디든 운전할 수 있다",
      "목에 약간의 통증이 있지만 어디든 운전할 수 있다",
      "목에 중간 정도 통증이 있어 원할 때만 운전할 수 있다",
      "목에 중간 정도 통증이 있어 운전을 자주 못한다",
      "목의 심한 통증 때문에 거의 운전하지 못한다",
      "통증 때문에 전혀 운전할 수 없다",
    ]),
  },
  {
    key: "sleeping",
    title: "9. 수면",
    options: ODI_ITEMS[6].options,
  },
  {
    key: "recreation",
    title: "10. 여가 활동",
    options: ODI_NDI_OPTIONS([
      "모든 여가 활동을 목 통증 없이 할 수 있다",
      "일부 여가 활동에서 약간의 목 통증이 있다",
      "통증 때문에 대부분(전부는 아닌)의 여가 활동만 할 수 있다",
      "통증 때문에 일부 여가 활동만 할 수 있다",
      "통증 때문에 거의 여가 활동을 할 수 없다",
      "통증 때문에 어떤 여가 활동도 할 수 없다",
    ]),
  },
];

/** ODI/NDI 공통 채점: (응답 합 / (5 × 응답 문항 수)) × 100. 응답이 없으면 null. */
export function computeOdiNdiScore(answers: Record<string, number>): number | null {
  const values = Object.values(answers).filter(
    (v): v is number => typeof v === "number" && v >= 0 && v <= 5,
  );
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round(((sum / (5 * values.length)) * 100 + Number.EPSILON) * 10) / 10;
}

// ---------------------------------------------------------------------------
// QuickDASH — 상지(어깨·팔·손) 기능장애, 11문항, 0~100 (낮을수록 좋음)
// ---------------------------------------------------------------------------
const QUICKDASH_DIFFICULTY_OPTIONS: PromOption[] = [
  { value: 1, label: "1 - 어려움 없음" },
  { value: 2, label: "2 - 약간 어려움" },
  { value: 3, label: "3 - 중간 정도 어려움" },
  { value: 4, label: "4 - 매우 어려움" },
  { value: 5, label: "5 - 할 수 없음" },
];

const QUICKDASH_SEVERITY_OPTIONS: PromOption[] = [
  { value: 1, label: "1 - 없음" },
  { value: 2, label: "2 - 약함" },
  { value: 3, label: "3 - 중간" },
  { value: 4, label: "4 - 심함" },
  { value: 5, label: "5 - 매우 심함" },
];

export const QUICKDASH_ITEMS: PromItem[] = [
  { key: "open_jar", title: "1. 꽉 닫힌 병뚜껑 열기", options: QUICKDASH_DIFFICULTY_OPTIONS },
  { key: "housework", title: "2. 집안일(청소, 심부름 등) 하기", options: QUICKDASH_DIFFICULTY_OPTIONS },
  { key: "carry_bag", title: "3. 가방·서류가방 들고 이동하기", options: QUICKDASH_DIFFICULTY_OPTIONS },
  { key: "wash_back", title: "4. 등 씻기", options: QUICKDASH_DIFFICULTY_OPTIONS },
  { key: "use_knife", title: "5. 칼로 음식 자르기", options: QUICKDASH_DIFFICULTY_OPTIONS },
  {
    key: "recreational_force",
    title: "6. 힘이 필요한 여가 활동(골프·못질·테니스 등)",
    options: QUICKDASH_DIFFICULTY_OPTIONS,
  },
  {
    key: "social_activities",
    title: "7. 팔·어깨·손 문제로 사회활동이 제한된 정도",
    options: QUICKDASH_DIFFICULTY_OPTIONS,
  },
  {
    key: "daily_activities",
    title: "8. 팔·어깨·손 문제로 일·일상활동이 제한된 정도",
    options: QUICKDASH_DIFFICULTY_OPTIONS,
  },
  { key: "pain", title: "9. 지난 1주간 팔·어깨·손 통증 정도", options: QUICKDASH_SEVERITY_OPTIONS },
  {
    key: "tingling",
    title: "10. 지난 1주간 팔·어깨·손 저림·따끔거림 정도",
    options: QUICKDASH_SEVERITY_OPTIONS,
  },
  {
    key: "sleep",
    title: "11. 지난 1주간 통증으로 수면을 방해받은 정도",
    options: QUICKDASH_SEVERITY_OPTIONS,
  },
];

/** QuickDASH 채점: ((응답 평균) - 1) × 25. 최소 10문항 응답 필요, 미만이면 null. */
export function computeQuickDashScore(answers: Record<string, number>): number | null {
  const values = Object.values(answers).filter(
    (v): v is number => typeof v === "number" && v >= 1 && v <= 5,
  );
  if (values.length < 10) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(((avg - 1) * 25 + Number.EPSILON) * 10) / 10;
}

// ---------------------------------------------------------------------------
// KOOS-12 — 무릎, 12문항(증상·통증 4 / 일상기능 6 / 삶의 질 2), 0~100 (높을수록 좋음)
// ---------------------------------------------------------------------------
const KOOS_SEVERITY_OPTIONS: PromOption[] = [
  { value: 0, label: "0 - 없음" },
  { value: 1, label: "1 - 약간" },
  { value: 2, label: "2 - 보통" },
  { value: 3, label: "3 - 심함" },
  { value: 4, label: "4 - 매우 심함" },
];

export const KOOS12_ITEMS: PromItem[] = [
  { key: "swelling", title: "무릎이 붓는다", options: KOOS_SEVERITY_OPTIONS, },
  { key: "catching", title: "무릎이 삐걱거리거나 걸리는 느낌이 있다", options: KOOS_SEVERITY_OPTIONS },
  { key: "stair_pain", title: "계단을 오르내릴 때 통증이 있다", options: KOOS_SEVERITY_OPTIONS },
  { key: "night_pain", title: "잠자리에서 무릎 통증이 있다", options: KOOS_SEVERITY_OPTIONS },
  { key: "stairs", title: "계단 오르내리기가 어렵다", options: KOOS_SEVERITY_OPTIONS },
  { key: "rising_bed", title: "침대에서 일어나기가 어렵다", options: KOOS_SEVERITY_OPTIONS },
  { key: "standing", title: "서 있는 것이 어렵다", options: KOOS_SEVERITY_OPTIONS },
  { key: "rising_chair", title: "바닥이나 의자에서 일어나기가 어렵다", options: KOOS_SEVERITY_OPTIONS },
  { key: "socks", title: "양말·신발을 신는 것이 어렵다", options: KOOS_SEVERITY_OPTIONS },
  { key: "squatting", title: "쪼그려 앉는 것이 어렵다", options: KOOS_SEVERITY_OPTIONS },
  { key: "awareness", title: "무릎 문제를 얼마나 자주 의식하는가", options: KOOS_SEVERITY_OPTIONS },
  {
    key: "lifestyle",
    title: "무릎 문제 때문에 일상생활 전반이 어려운 정도",
    options: KOOS_SEVERITY_OPTIONS,
  },
];

/** KOOS-12 채점: 100 - (응답 합 / (4 × 응답 문항 수)) × 100. 높을수록 좋음. */
export function computeKoos12Score(answers: Record<string, number>): number | null {
  const values = Object.values(answers).filter(
    (v): v is number => typeof v === "number" && v >= 0 && v <= 4,
  );
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((100 - (sum / (4 * values.length)) * 100 + Number.EPSILON) * 10) / 10;
}

// ---------------------------------------------------------------------------
// FAAM — 발·발목, ADL 21문항 + 스포츠 8문항, 0~100% (높을수록 좋음)
// ---------------------------------------------------------------------------
const FAAM_OPTIONS: PromOption[] = [
  { value: 4, label: "4 - 어려움 없음" },
  { value: 3, label: "3 - 약간 어려움" },
  { value: 2, label: "2 - 보통 어려움" },
  { value: 1, label: "1 - 심한 어려움" },
  { value: 0, label: "0 - 할 수 없음" },
];

export const FAAM_ADL_ITEMS: PromItem[] = [
  "서기",
  "평평한 곳 걷기",
  "고르지 않은 지면 걷기",
  "오르막 걷기",
  "내리막 걷기",
  "계단 오르기",
  "계단 내리기",
  "걷기를 시작할 때",
  "5분 이하로 걷기",
  "약 10분 걷기",
  "15분 이상 걷기",
  "집안일 하기",
  "일상생활 활동(ADL)",
  "개인위생(세면 등)",
  "가벼운~중간 강도의 노동(서기·걷기 포함)",
  "힘든 노동(밀기·당기기·오르기·무거운 것 나르기)",
  "레크리에이션 활동",
  "정상적인 걷기 능력에 대한 자신감",
  "발·발목의 조절 능력",
  "평소 최대 능력 대비 현재 능력",
  "발·발목 문제 없이 하루를 보낼 수 있는 정도",
].map((title, i) => ({ key: `adl_${i + 1}`, title: `${i + 1}. ${title}`, options: FAAM_OPTIONS }));

export const FAAM_SPORTS_ITEMS: PromItem[] = [
  "달리기",
  "점프하고 착지하기",
  "급정지 및 방향 전환",
  "커팅·측면 이동 동작",
  "낮은 강도 활동(빨리 걷기 등)",
  "민첩성이 필요한 동작 수행 능력",
  "스포츠 활동 중 발·발목 조절 능력",
  "부상 전 수준 대비 스포츠 참여 능력",
].map((title, i) => ({ key: `sports_${i + 1}`, title: `${i + 1}. ${title}`, options: FAAM_OPTIONS }));

/** FAAM 채점(ADL/스포츠 공통): (응답 합 / (4 × 응답 문항 수)) × 100. 높을수록 좋음. */
export function computeFaamScore(answers: Record<string, number>): number | null {
  const values = Object.values(answers).filter(
    (v): v is number => typeof v === "number" && v >= 0 && v <= 4,
  );
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round(((sum / (4 * values.length)) * 100 + Number.EPSILON) * 10) / 10;
}

// ---------------------------------------------------------------------------
// STarT Back Screening Tool — 요통 위험군 분류, 9문항
// ---------------------------------------------------------------------------
const AGREE_OPTIONS: PromOption[] = [
  { value: 0, label: "아니다" },
  { value: 1, label: "그렇다" },
];

// 화면에는 5단계 그대로 보여주고, 채점 시 3~4(매우/극도로 괴로움)만 1점으로 환산한다.
const BOTHER_OPTIONS: PromOption[] = [
  { value: 0, label: "0 - 전혀 괴롭지 않았다" },
  { value: 1, label: "1 - 약간 괴로웠다" },
  { value: 2, label: "2 - 다소 괴로웠다" },
  { value: 3, label: "3 - 매우 괴로웠다" },
  { value: 4, label: "4 - 극도로 괴로웠다" },
];

export const STARTBACK_ITEMS: PromItem[] = [
  { key: "q1_referred_pain", title: "1. 지난 2주간 통증이 다리(엉덩이 포함)까지 뻗쳤다", options: AGREE_OPTIONS },
  { key: "q2_other_pain", title: "2. 지난 2주간 다른 부위(어깨, 목 등)에도 통증이 있었다", options: AGREE_OPTIONS },
  { key: "q3_short_distance", title: "3. 통증 때문에 짧은 거리만 걸었다", options: AGREE_OPTIONS },
  { key: "q4_dressed_slowly", title: "4. 통증 때문에 평소보다 천천히 옷을 입었다", options: AGREE_OPTIONS },
  {
    key: "q5_unsafe_activity",
    title: "5. 지금 상태로 신체 활동을 하는 것이 안전하지 않다고 느낀다",
    options: AGREE_OPTIONS,
  },
  { key: "q6_worry", title: "6. 걱정스러운 생각이 자꾸 머릿속에 떠오른다", options: AGREE_OPTIONS },
  {
    key: "q7_serious",
    title: "7. 내 요통이 심각하며 나아지지 않을 것 같다고 느낀다",
    options: AGREE_OPTIONS,
  },
  { key: "q8_less_enjoyment", title: "8. 전반적으로 예전만큼 즐겁지 않다", options: AGREE_OPTIONS },
  {
    key: "q9_bothersome",
    title: "9. 지난 2주간 요통이 전반적으로 얼마나 괴로웠는가",
    options: BOTHER_OPTIONS,
  },
];

export interface StartBackScore {
  total: number;
  subscale: number;
  risk: "low" | "medium" | "high";
  riskLabel: string;
}

/**
 * STarT Back 채점: 전체 9문항 합(0~9) + 심리사회 하위척도(5~9번 합, 0~5).
 * 위험군: 총점 ≤3 저위험 / 총점 ≥4 & 하위척도 ≤3 중위험 / 하위척도 ≥4 고위험.
 */
export function computeStartBackScore(answers: Record<string, number>): StartBackScore | null {
  const keys = STARTBACK_ITEMS.map((item) => item.key);
  const answered = keys.filter((k) => typeof answers[k] === "number");
  if (answered.length < keys.length) return null;
  // 9번(괴로움 정도)만 0~4 척도 → 3(매우 괴로움) 이상이면 1점으로 환산해 채점한다.
  const scoreOf = (key: string): number => {
    const raw = answers[key] ?? 0;
    return key === "q9_bothersome" ? (raw >= 3 ? 1 : 0) : raw;
  };
  const total = keys.reduce((sum, k) => sum + scoreOf(k), 0);
  const subscaleKeys = keys.slice(4); // q5~q9
  const subscale = subscaleKeys.reduce((sum, k) => sum + scoreOf(k), 0);
  let risk: StartBackScore["risk"] = "low";
  if (subscale >= 4) risk = "high";
  else if (total >= 4) risk = "medium";
  const riskLabel = risk === "low" ? "저위험" : risk === "medium" ? "중위험" : "고위험";
  return { total, subscale, risk, riskLabel };
}
