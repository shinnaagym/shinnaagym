import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// 인스타그램 릴스 촬영용 데모 회원(홍길동)을 실제 배포 DB에 한 번만 만들어주는
// 임시 엔드포인트. 관리자 비밀번호 대신 배포 시점에만 아는 비밀 키로 보호하고,
// 사용 후 이 파일 자체를 지운다(영구적으로 남겨두지 않는다).
const SEED_KEY = "f86b2da15a1f01812cf9e8ba6b325455a9e7489929bfc40f";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildSessionDates(): string[] {
  const dates: string[] = [];
  let cur = "2026-03-03";
  const end = "2026-08-25";
  while (cur <= end) {
    const dow = new Date(cur + "T00:00:00Z").getUTCDay();
    if (dow === 2 || dow === 5) dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function phaseFor(weekIdx: number, totalWeeks: number): "A" | "B" | "C" | "D" | "E" {
  const t = weekIdx / totalWeeks;
  if (t < 4 / 26) return "A";
  if (t < 10 / 26) return "B";
  if (t < 16 / 26) return "C";
  if (t < 22 / 26) return "D";
  return "E";
}

const COACH_NOTES_POOL: Record<string, string[]> = {
  A: [
    "무릎 통증으로 저강도 등척성 운동 위주 진행. 통증 반응 관찰하며 강도 조절.",
    "브릿지·밴드 워크로 둔근·중둔근 활성화. 무릎 부담 최소화.",
    "통증 없는 범위 내에서만 가동, 컨디션 체크하며 진행.",
    "정적 스트레칭 + 등척성 운동. 계단 내려갈 때 통증 여전히 호소.",
  ],
  B: [
    "레그프레스 가벼운 무게로 도입. 통증 반응 양호해 다음 세션부터 소폭 증량 예정.",
    "낮은 박스 스텝업 시작. 우측 무릎 통증 감소 추세, 가동범위 개선 중.",
    "레그프레스 무게 소폭 증량. 세트 간 통증 없음 확인.",
    "사이드스텝·미니밴드 운동 추가. 고관절 안정성 향상 목적.",
  ],
  C: [
    "레그프레스 꾸준히 증량 중. 고블릿 스쿼트 가벼운 덤벨로 도입, 자세 안정적.",
    "하프 스쿼트 통증 없이 수행. 계단 오르내리기 통증 많이 줄었다고 함.",
    "레그프레스 무게 증량, 폼 안정적. 밸런스 훈련 추가.",
    "고블릿 스쿼트 깊이 조금씩 늘림. 만보 이상 걸어도 통증 없다고 보고.",
  ],
  D: [
    "바벨 스쿼트 가벼운 무게로 도입. 무릎 정렬 양호, valgus 패턴 거의 소실.",
    "런지 동작 추가, 좌우 밸런스 확인. 레그프레스 고중량대 진입.",
    "풀스쿼트 시도, 통증 없이 수행 성공. 자신감 상승.",
    "계단 오르내리기 훈련 병행. 실생활 동작에서도 통증 보고 없음.",
  ],
  E: [
    "바벨 스쿼트 고중량 세트. 통증 없이 안정적으로 수행, 컨디션 최상.",
    "헥스바 데드리프트 도입. 무릎 부담 적고 폼 좋음.",
    "레그프레스 최고 중량 갱신. 6개월 전 대비 확연히 강해진 게 느껴진다고 함.",
    "풀스쿼트+런지 조합. 비 오는 날에도 통증 없다고 확인.",
  ],
};

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

interface SetGroup {
  weight: string | null;
  reps: string | null;
  sets: number | null;
}
interface Exercise {
  name: string;
  equipment: string;
  groups: SetGroup[];
  note: string;
}

function buildExercisesForSession(phase: string, weekIdx: number): Exercise[] {
  const legPressWeight = Math.round(
    phase === "A"
      ? 0
      : phase === "B"
        ? lerp(40, 55, (weekIdx - 4) / 6)
        : phase === "C"
          ? lerp(55, 80, (weekIdx - 10) / 6)
          : phase === "D"
            ? lerp(80, 110, (weekIdx - 16) / 6)
            : lerp(110, 140, (weekIdx - 22) / 4),
  );
  const squatWeight = Math.round(
    phase === "A" || phase === "B"
      ? 0
      : phase === "C"
        ? lerp(8, 12, (weekIdx - 10) / 6)
        : phase === "D"
          ? lerp(20, 40, (weekIdx - 16) / 6)
          : lerp(40, 65, (weekIdx - 22) / 4),
  );

  const exercises: Exercise[] = [];

  if (phase === "A") {
    exercises.push({
      name: "무릎 등척성 신전(Isometric Quad Set)",
      equipment: "bodyweight",
      groups: [
        { weight: null, reps: "10초 유지", sets: 3 },
        { weight: null, reps: "10초 유지", sets: 3 },
      ],
      note: "통증 없는 범위에서만 수행",
    });
    exercises.push({
      name: "글루트 브릿지",
      equipment: "bodyweight",
      groups: [{ weight: null, reps: "12", sets: 3 }],
      note: "",
    });
    exercises.push({
      name: "미니밴드 사이드스텝",
      equipment: "small_equipment",
      groups: [{ weight: null, reps: "15", sets: 2 }],
      note: "고관절 외전근 활성화",
    });
  } else {
    exercises.push({
      name: "레그프레스",
      equipment: "machine",
      groups: [
        { weight: String(legPressWeight), reps: "12", sets: 3 },
        { weight: String(Math.round(legPressWeight * 0.9)), reps: "10", sets: 1 },
      ],
      note: phase === "B" ? "무릎 통증 반응 확인하며 증량" : "",
    });

    if (phase === "B") {
      exercises.push({
        name: "박스 스텝업(낮은 박스)",
        equipment: "bodyweight",
        groups: [{ weight: null, reps: "10", sets: 3 }],
        note: "",
      });
    } else if (phase === "C") {
      exercises.push({
        name: "고블릿 스쿼트",
        equipment: "dumbbell",
        groups: [{ weight: String(squatWeight), reps: "10", sets: 3 }],
        note: "가동범위 점진적으로 확대",
      });
    } else if (phase === "D") {
      exercises.push({
        name: "바벨 스쿼트",
        equipment: "barbell",
        groups: [{ weight: String(squatWeight), reps: "8", sets: 3 }],
        note: "무릎 정렬 확인",
      });
      exercises.push({
        name: "워킹 런지",
        equipment: "bodyweight",
        groups: [{ weight: null, reps: "10(편도)", sets: 2 }],
        note: "",
      });
    } else {
      exercises.push({
        name: "바벨 스쿼트",
        equipment: "barbell",
        groups: [
          { weight: String(squatWeight), reps: "6", sets: 4 },
          { weight: String(Math.round(squatWeight * 0.85)), reps: "8", sets: 1 },
        ],
        note: "",
      });
      if (weekIdx % 2 === 0) {
        exercises.push({
          name: "헥스바 데드리프트",
          equipment: "hex_bar",
          groups: [{ weight: String(Math.round(lerp(30, 50, (weekIdx - 22) / 4))), reps: "8", sets: 3 }],
          note: "무릎 부담 적은 데드리프트 변형",
        });
      }
    }
  }

  return exercises;
}

const koos = (o: Record<string, number>) => ({
  swelling: 0,
  catching: 0,
  stair_pain: 0,
  night_pain: 0,
  stairs: 0,
  rising_bed: 0,
  standing: 0,
  rising_chair: 0,
  socks: 0,
  squatting: 0,
  awareness: 0,
  lifestyle: 0,
  ...o,
});

const ASSESSMENT_PLAN = [
  {
    evaluated_at: "2026-03-02",
    pain_scale: 7,
    squat_note:
      "우측 무릎 굽힘 제한으로 하강 깊이 얕음(1/4 스쿼트 수준). 하강 시 무릎이 안쪽으로 밀리는 valgus 패턴 관찰, 통증으로 완전한 스쿼트 어려움.",
    core_note: "플랭크 20초 유지, 하부 코어 활성화 저하 관찰.",
    overhead_squat_note: "팔 거상 시 상체 과보상, 무릎 통증으로 평가 조기 중단.",
    pushup_note: "특이사항 없음, 통증 무.",
    hip_hinge_note: "고관절보다 무릎 굽힘 위주 패턴, 힙힌지 학습 필요.",
    pain_trigger_note: "계단 하강·장시간 보행·기압 변화 시 통증 악화.",
    movements: {
      "knee-flexion-r": { romPassive: "0-110°", romActive: "0-95°", compensation: "굽힘 시 골반 후방 경사 대상동작 관찰", painPassive: "3", painActive: "5" },
      "knee-extension-r": { romPassive: "0°", romActive: "-5°(신전 제한)", compensation: "", painPassive: "2", painActive: "3" },
    },
    pain_triggers: [
      { note: "계단 내려갈 때", painScale: 7 },
      { note: "만보 이상 걸을 때", painScale: 5 },
      { note: "비 오는 날", painScale: 4 },
    ],
    exercise_performance: [
      { exercise: "레그프레스", note: "초기 평가 — 통증 반응 확인용 저중량", weight: 30, reps: 12, rpe: 6 },
      { exercise: "힙쓰러스트", note: "초기 평가 — 둔근 활성화 확인용 저중량", weight: 20, reps: 12, rpe: 6 },
    ],
    koos12: koos({ swelling: 2, catching: 1, stair_pain: 3, night_pain: 1, stairs: 3, rising_bed: 1, standing: 2, rising_chair: 3, socks: 2, squatting: 4, awareness: 3, lifestyle: 3 }),
    nprs_rest: 3,
    nprs_activity: 7,
    functional_test_pain_free: { core: true, squat: false, overheadSquat: false, pushup: true, hipHinge: true },
    hop_test_lsi: null as number | null,
    cmj_lsi: null as number | null,
    hamstring_lsi: null as number | null,
    asymptomatic_loading_weeks: null as number | null,
  },
  {
    evaluated_at: "2026-04-13",
    pain_scale: 5,
    squat_note: "가동범위 소폭 개선. 통증으로 딥스쿼트는 여전히 제한되나 하프 스쿼트까지는 가능. valgus 패턴 약간 남아있음.",
    core_note: "플랭크 35초, 활성화 개선 중.",
    overhead_squat_note: "상체 보상 감소, 평가 완주 가능.",
    pushup_note: "특이사항 없음.",
    hip_hinge_note: "힙힌지 패턴 학습됨, 무릎 부담 감소.",
    pain_trigger_note: "계단 하강 시 통증 여전하나 강도 감소.",
    movements: {
      "knee-flexion-r": { romPassive: "0-120°", romActive: "0-110°", compensation: "경미한 대상동작 남음", painPassive: "2", painActive: "3" },
      "knee-extension-r": { romPassive: "0°", romActive: "0°", compensation: "", painPassive: "1", painActive: "1" },
    },
    pain_triggers: [
      { note: "계단 내려갈 때", painScale: 5 },
      { note: "만보 이상 걸을 때", painScale: 3 },
      { note: "비 오는 날", painScale: 3 },
    ],
    exercise_performance: [
      { exercise: "레그프레스", note: "6주차 재평가", weight: 55, reps: 10, rpe: 7 },
      { exercise: "힙쓰러스트", note: "6주차 재평가", weight: 35, reps: 10, rpe: 7 },
      { exercise: "레그컬", note: "6주차 — 햄스트링 강화 도입", weight: 15, reps: 12, rpe: 6 },
      { exercise: "고블릿 스쿼트", note: "6주차 — 가벼운 덤벨로 도입", weight: 6, reps: 10, rpe: 5 },
    ],
    koos12: koos({ swelling: 1, catching: 1, stair_pain: 2, night_pain: 0, stairs: 2, rising_bed: 1, standing: 1, rising_chair: 2, socks: 1, squatting: 3, awareness: 2, lifestyle: 2 }),
    nprs_rest: 2,
    nprs_activity: 5,
    functional_test_pain_free: { core: true, squat: false, overheadSquat: true, pushup: true, hipHinge: true },
    hop_test_lsi: null as number | null,
    cmj_lsi: null as number | null,
    hamstring_lsi: null as number | null,
    asymptomatic_loading_weeks: null as number | null,
  },
  {
    evaluated_at: "2026-05-25",
    pain_scale: 3,
    squat_note: "하프 스쿼트까지 통증 없이 가능. valgus 패턴 대부분 개선, 고블릿 스쿼트 가벼운 중량 수행 양호.",
    core_note: "플랭크 50초, 안정적.",
    overhead_squat_note: "정상 패턴에 가까움.",
    pushup_note: "특이사항 없음.",
    hip_hinge_note: "정상 패턴.",
    pain_trigger_note: "만보 이상 걸어도 경미한 통증만 보고.",
    movements: {
      "knee-flexion-r": { romPassive: "0-130°", romActive: "0-125°", compensation: "", painPassive: "1", painActive: "1" },
      "knee-extension-r": { romPassive: "0°", romActive: "0°", compensation: "", painPassive: "", painActive: "" },
    },
    pain_triggers: [
      { note: "계단 내려갈 때", painScale: 3 },
      { note: "만보 이상 걸을 때", painScale: 1 },
      { note: "비 오는 날", painScale: 2 },
    ],
    exercise_performance: [
      { exercise: "레그프레스", note: "12주차 재평가", weight: 80, reps: 10, rpe: 7 },
      { exercise: "힙쓰러스트", note: "12주차 재평가", weight: 50, reps: 8, rpe: 7 },
      { exercise: "레그컬", note: "12주차 재평가", weight: 20, reps: 10, rpe: 7 },
      { exercise: "고블릿 스쿼트", note: "12주차 재평가", weight: 12, reps: 10, rpe: 6 },
      { exercise: "헥스바 데드리프트", note: "12주차 — 무릎 부담 적은 데드리프트 변형 도입", weight: 20, reps: 10, rpe: 6 },
    ],
    koos12: koos({ swelling: 0, catching: 0, stair_pain: 1, night_pain: 0, stairs: 1, rising_bed: 0, standing: 0, rising_chair: 1, socks: 1, squatting: 2, awareness: 1, lifestyle: 1 }),
    nprs_rest: 1,
    nprs_activity: 3,
    functional_test_pain_free: { core: true, squat: true, overheadSquat: true, pushup: true, hipHinge: true },
    hop_test_lsi: 78,
    cmj_lsi: 80,
    hamstring_lsi: 85,
    asymptomatic_loading_weeks: 2,
  },
  {
    evaluated_at: "2026-07-06",
    pain_scale: 1,
    squat_note: "풀스쿼트 통증 없이 가능. 무릎 정렬 양호, 바벨 스쿼트 가벼운 중량 도입.",
    core_note: "플랭크 60초 이상, 코어 안정성 우수.",
    overhead_squat_note: "정상.",
    pushup_note: "특이사항 없음.",
    hip_hinge_note: "정상, 고중량 힙힌지 동작 가능.",
    pain_trigger_note: "비 오는 날에도 통증 거의 없음.",
    movements: {
      "knee-flexion-r": { romPassive: "0-140°", romActive: "0-135°", compensation: "", painPassive: "", painActive: "" },
      "knee-extension-r": { romPassive: "0°", romActive: "0°", compensation: "", painPassive: "", painActive: "" },
    },
    pain_triggers: [
      { note: "계단 내려갈 때", painScale: 1 },
      { note: "만보 이상 걸을 때", painScale: 0 },
      { note: "비 오는 날", painScale: 1 },
    ],
    exercise_performance: [
      { exercise: "레그프레스", note: "18주차 재평가", weight: 110, reps: 8, rpe: 8 },
      { exercise: "스쿼트", note: "바벨 도입", weight: 35, reps: 8, rpe: 7 },
      { exercise: "힙쓰러스트", note: "18주차 재평가", weight: 65, reps: 8, rpe: 8 },
      { exercise: "레그컬", note: "18주차 재평가", weight: 28, reps: 8, rpe: 7 },
      { exercise: "헥스바 데드리프트", note: "18주차 재평가", weight: 35, reps: 8, rpe: 7 },
    ],
    koos12: koos({ swelling: 0, catching: 0, stair_pain: 0, night_pain: 0, stairs: 1, rising_bed: 0, standing: 0, rising_chair: 0, socks: 0, squatting: 1, awareness: 1, lifestyle: 0 }),
    nprs_rest: 0,
    nprs_activity: 1,
    functional_test_pain_free: { core: true, squat: true, overheadSquat: true, pushup: true, hipHinge: true },
    hop_test_lsi: 88,
    cmj_lsi: 90,
    hamstring_lsi: 92,
    asymptomatic_loading_weeks: 4,
  },
  {
    evaluated_at: "2026-08-24",
    pain_scale: 0,
    squat_note: "풀스쿼트 고중량에서도 통증 없이 안정적 수행. 좌우 대칭적이고 정상적인 움직임 패턴 확립.",
    core_note: "플랭크 90초, 매우 안정적.",
    overhead_squat_note: "정상.",
    pushup_note: "특이사항 없음.",
    hip_hinge_note: "정상, 데드리프트 변형 동작 무리 없이 수행.",
    pain_trigger_note: "문진표 작성 당시 호소했던 계단·장거리 보행·우천 시 통증 모두 소실.",
    movements: {
      "knee-flexion-r": { romPassive: "0-145°", romActive: "0-140°", compensation: "", painPassive: "", painActive: "" },
      "knee-extension-r": { romPassive: "0°", romActive: "0°", compensation: "", painPassive: "", painActive: "" },
    },
    pain_triggers: [
      { note: "계단 내려갈 때", painScale: 0 },
      { note: "만보 이상 걸을 때", painScale: 0 },
      { note: "비 오는 날", painScale: 0 },
    ],
    exercise_performance: [
      { exercise: "레그프레스", note: "6개월 최종 평가", weight: 140, reps: 6, rpe: 8 },
      { exercise: "스쿼트", note: "6개월 최종 평가", weight: 62, reps: 6, rpe: 8 },
      { exercise: "힙쓰러스트", note: "6개월 최종 평가", weight: 80, reps: 6, rpe: 8 },
      { exercise: "레그컬", note: "6개월 최종 평가", weight: 35, reps: 6, rpe: 8 },
      { exercise: "헥스바 데드리프트", note: "6개월 최종 평가", weight: 50, reps: 6, rpe: 8 },
    ],
    koos12: koos({ swelling: 0, catching: 0, stair_pain: 0, night_pain: 0, stairs: 0, rising_bed: 0, standing: 0, rising_chair: 0, socks: 0, squatting: 0, awareness: 0, lifestyle: 0 }),
    nprs_rest: 0,
    nprs_activity: 0,
    functional_test_pain_free: { core: true, squat: true, overheadSquat: true, pushup: true, hipHinge: true },
    hop_test_lsi: 96,
    cmj_lsi: 97,
    hamstring_lsi: 98,
    asymptomatic_loading_weeks: 8,
  },
];

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("key") !== SEED_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const coachResult = await query<{ id: number }>(`SELECT id FROM coaches WHERE name = '신종수' ORDER BY id LIMIT 1`);
  if (coachResult.rows.length === 0) {
    return NextResponse.json({ error: "코치 '신종수'를 찾을 수 없습니다." }, { status: 400 });
  }
  const coachId = coachResult.rows[0].id;

  await query(`DELETE FROM members WHERE name = '홍길동' AND phone = '010-2222-9090'`);

  const token = randomBytes(9).toString("base64url");
  const memberResult = await query<{ id: number }>(
    `INSERT INTO members (name, phone, coach_id, notes, status, token, created_at)
     VALUES ($1, $2, $3, $4, 'active', $5, $6)
     RETURNING id`,
    [
      "홍길동",
      "010-2222-9090",
      coachId,
      "무릎 관절염(우측) 재활 목적 등록. 6개월 프로그램으로 통증 개선 + 근력 강화 진행. (데모용 회원)",
      token,
      "2026-03-02T09:00:00+09:00",
    ],
  );
  const memberId = memberResult.rows[0].id;

  // price=0: 실제 매출 통계(대시보드 카드결제 매출 등)를 오염시키지 않기 위해
  // 데모 회원 결제 금액은 0으로 둔다.
  await query(
    `INSERT INTO packages (member_id, total_sessions, price, purchased_at, note, payment_method)
     VALUES ($1, 60, 0, $2, '무릎 재활 6개월 프로그램 (데모)', 'card')`,
    [memberId, "2026-03-02T10:00:00+09:00"],
  );

  await query(
    `INSERT INTO intake_questionnaires (
      member_id, intake_name, age, phone,
      visit_channel, visit_channel_referrer_name, visit_channel_other,
      exercise_purposes, exercise_purpose_other,
      stance_leg, leg_cross, sleep_position, frequent_movement,
      sleep_hours, sleep_quality, stress_level, drinking, smoking, other_notes,
      pain_onset_period, pain_onset_type, pain_moi, pain_movements,
      pain_cycle_situation, pain_cycle_morning, pain_cycle_noon, pain_cycle_evening, pain_cycle_night,
      pain_characteristics, pain_characteristics_other,
      improve_factors, worsen_factors, perceived_cause, post_pain_action,
      past_same_pain_history, past_treatment, major_complaint, minor_complaint,
      created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,
      $5,$6,$7,
      $8,$9,
      $10,$11,$12,$13,
      $14,$15,$16,$17,$18,$19,
      $20,$21,$22,$23,
      $24,$25,$26,$27,$28,
      $29,$30,
      $31,$32,$33,$34,
      $35,$36,$37,$38,
      $39,$39
    )`,
    [
      memberId, "홍길동", 50, "010-2222-9090",
      "referral", "정미숙", "",
      ["rehab", "strength"], "",
      "right", "left", "supine", "사무직, 하루 대부분 좌식 근무",
      6.5, "normal", "normal", true, false, "무릎 외 특이 병력 없음. 혈압·혈당 정상.",
      "6개월 전", "chronic", "특별한 외상 없이 서서히 시작됨",
      JSON.stringify([
        { movement: "계단 내려갈 때", nrsBest: 3, nrsWorst: 8, nrsCurrent: 7 },
        { movement: "만보 이상 걸을 때", nrsBest: 2, nrsWorst: 6, nrsCurrent: 5 },
        { movement: "비 오는 날(기압 변화)", nrsBest: 2, nrsWorst: 5, nrsCurrent: 4 },
      ]),
      "활동량이 많은 날 악화, 아침엔 약간의 강직감 있음",
      "기상 시 약 5~10분 뻣뻣함, 통증 2/10",
      "활동 중 간헐적 통증 3~4/10",
      "계단·보행 많았던 날은 통증 6~7/10까지 상승",
      "심한 날은 욱신거림으로 뒤척임, 평소엔 특이사항 없음",
      JSON.stringify(["dull", "stiff", "throbbing"]), "",
      "휴식, 온찜질, 파스 부착", "계단 내려가기, 만보 이상 보행, 비 오는 날(기압 변화)",
      "노화 및 반복적인 계단 사용으로 인한 퇴행성 변화로 추정",
      "휴식 후 온찜질, 파스 부착",
      "5년 전 등산 후 일시적 무릎 통증 있었으나 자연 호전됨",
      "정형외과에서 관절염 진단, 도수치료 및 주사치료(히알루론산) 받음. 일시적 호전 후 재발.",
      "우측 무릎 통증 — 계단 내려갈 때 심함",
      "장시간 보행 후 무릎 뻐근함",
      "2026-03-02T09:10:00+09:00",
    ],
  );

  for (const a of ASSESSMENT_PLAN) {
    await query(
      `INSERT INTO assessments (
        member_id, evaluator_name, evaluated_at, movements,
        core_note, squat_note, overhead_squat_note, pushup_note, hip_hinge_note,
        pain_trigger_note, pain_scale, pain_triggers, exercise_performance,
        koos12_answers, nprs_rest, nprs_activity, functional_test_pain_free,
        hop_test_lsi, cmj_lsi, hamstring_lsi, asymptomatic_loading_weeks,
        created_at
      ) VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,$8,$9,
        $10,$11,$12,$13,
        $14,$15,$16,$17,
        $18,$19,$20,$21,
        $22
      )`,
      [
        memberId, "신종수", a.evaluated_at, JSON.stringify(a.movements),
        a.core_note, a.squat_note, a.overhead_squat_note, a.pushup_note, a.hip_hinge_note,
        a.pain_trigger_note, a.pain_scale, JSON.stringify(a.pain_triggers), JSON.stringify(a.exercise_performance),
        JSON.stringify(a.koos12), a.nprs_rest, a.nprs_activity, JSON.stringify(a.functional_test_pain_free),
        a.hop_test_lsi, a.cmj_lsi, a.hamstring_lsi, a.asymptomatic_loading_weeks,
        a.evaluated_at + "T18:00:00+09:00",
      ],
    );
  }

  const sessionDates = buildSessionDates();
  const totalWeeks = 26;
  let seed = 1;
  for (const date of sessionDates) {
    const weekIdx = Math.floor((new Date(date).getTime() - new Date("2026-03-02").getTime()) / (7 * 86400000));
    const phase = phaseFor(weekIdx, totalWeeks);
    const t = Math.min(1, weekIdx / totalWeeks);
    const painScale = Math.max(0, Math.round(lerp(6, 0, t) + (seed % 3 === 0 ? 1 : 0) - (seed % 5 === 0 ? 1 : 0)));
    const perfScale = Math.min(10, Math.round(lerp(4, 9, t)));
    const memo = pick(COACH_NOTES_POOL[phase], seed);
    const exercises = buildExercisesForSession(phase, weekIdx);

    await query(
      `INSERT INTO pt_logs (member_id, log_date, memo, pain_scale, performance_scale, exercises, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [memberId, date, memo, painScale, perfScale, JSON.stringify(exercises), date + "T19:30:00+09:00"],
    );
    seed++;
  }

  return NextResponse.json({
    ok: true,
    memberId,
    token,
    ptLogCount: sessionDates.length,
    assessmentCount: ASSESSMENT_PLAN.length,
    myPageUrl: `/my/${token}`,
  });
}
