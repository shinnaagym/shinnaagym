import { Pool, types, type QueryResultRow } from "pg";

// pg는 NUMERIC(OID 1700)을 정밀도 손실 방지를 위해 기본적으로 문자열로 반환한다.
// 이 앱의 NUMERIC 컬럼(sleep_hours, LSI, 부하 유지 기간 등)은 전부 소수 몇 자리
// 수준의 일반 숫자라 정밀도 손실 우려가 없으므로, number로 파싱해 TS 타입과
// 실제 런타임 값이 일치하도록 한다.
types.setTypeParser(1700, (value: string) => (value === null ? null : parseFloat(value)));

// Vercel Storage(Neon) 연동은 스토리지 이름이 접두사로 붙은 환경변수
// (예: `내프로젝트명_POSTGRES_URL`)를 만들기도 해서, 표준 이름이 없으면
// "*_POSTGRES_URL" / "*_DATABASE_URL" 패턴의 변수도 찾아본다.
function resolveConnectionString(): string | undefined {
  const direct =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING;
  if (direct) return direct;

  const prefixedKey = Object.keys(process.env).find((key) =>
    /(^|_)POSTGRES_URL$/.test(key) || /(^|_)DATABASE_URL$/.test(key),
  );
  return prefixedKey ? process.env[prefixedKey] : undefined;
}

const rawConnectionString = resolveConnectionString();

// 연결 문자열에 sslmode=require 등이 포함되어 있으면 최신 pg가 이를
// verify-full(인증서 완전 검증)로 취급해 아래의 명시적 ssl 옵션을 무시하고
// "self-signed certificate in certificate chain" 에러를 낸다. sslmode를
// 제거해서 아래 ssl 옵션만 적용되도록 한다.
function stripSslMode(raw: string): string {
  try {
    const url = new URL(raw);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return raw;
  }
}

const connectionString = rawConnectionString
  ? stripSslMode(rawConnectionString)
  : undefined;

let pool: Pool | undefined;

function getPool(): Pool {
  if (!connectionString) {
    throw new Error(
      "DB 연결 문자열이 없습니다. Vercel 프로젝트의 Storage에서 Postgres를 연결하면 " +
        "POSTGRES_URL 환경변수가 자동으로 설정됩니다. 로컬 개발 시에는 .env.local에 POSTGRES_URL을 넣어주세요.",
    );
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: /localhost|127\.0\.0\.1/.test(connectionString)
        ? false
        : { rejectUnauthorized: false },
    });
  }
  return pool;
}

let schemaReady: Promise<void> | null = null;

// 2026년 대한민국 공휴일 추정치(설날·부처님오신날·추석 등 음력 기반 날짜는 추정입니다).
// 정확한 날짜는 관리자 화면(공휴일 관리)에서 언제든 추가·삭제할 수 있습니다.
const SEED_HOLIDAYS_2026: Array<[string, string]> = [
  ["2026-01-01", "신정"],
  ["2026-02-16", "설날 연휴"],
  ["2026-02-17", "설날"],
  ["2026-02-18", "설날 연휴"],
  ["2026-03-01", "삼일절"],
  ["2026-05-05", "어린이날"],
  ["2026-05-24", "부처님오신날(추정)"],
  ["2026-06-06", "현충일"],
  ["2026-08-15", "광복절"],
  ["2026-09-24", "추석 연휴(추정)"],
  ["2026-09-25", "추석(추정)"],
  ["2026-09-26", "추석 연휴(추정)"],
  ["2026-10-03", "개천절"],
  ["2026-10-09", "한글날"],
  ["2026-12-25", "성탄절"],
];

// 스키마 마이그레이션(테이블 생성 + 60여 개 ALTER/INDEX 체크)을 매 콜드 스타트마다
// 다시 실행하면, 이미 다 적용되어 있어 사실상 아무 것도 안 바뀌는 경우에도 그
// 왕복 자체가 체감 로딩 지연에 더해진다. schema_migrations 테이블에 버전을
// 기록해두고, 이미 최신이면(대부분의 요청) 가벼운 SELECT 한 번으로 끝내고
// 무거운 CREATE/ALTER 블록 전체는 건너뛴다. 아래 마이그레이션 내용을 바꿀
// 때는(컬럼/인덱스 추가 등) 반드시 이 숫자를 올려야 다음 콜드 스타트에서
// 실제로 적용된다.
const SCHEMA_VERSION = 1;

function runFullMigration(): Promise<void> {
  return getPool()
    .query(
      `
        CREATE TABLE IF NOT EXISTS reservations (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          age INTEGER NOT NULL,
          phone TEXT NOT NULL,
          purposes TEXT[] NOT NULL,
          purpose_note TEXT NOT NULL DEFAULT '',
          reservation_date TEXT NOT NULL,
          reservation_hour INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (reservation_date, reservation_hour)
        );

        CREATE TABLE IF NOT EXISTS coaches (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          phone TEXT NOT NULL DEFAULT '',
          active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS holidays (
          holiday_date TEXT PRIMARY KEY,
          name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS members (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT NOT NULL DEFAULT '',
          coach_id INTEGER REFERENCES coaches(id),
          notes TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'active',
          token TEXT NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS packages (
          id SERIAL PRIMARY KEY,
          member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          total_sessions INTEGER NOT NULL,
          price INTEGER NOT NULL DEFAULT 0,
          purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          note TEXT NOT NULL DEFAULT '',
          payment_method TEXT NOT NULL DEFAULT 'card'
        );

        CREATE TABLE IF NOT EXISTS class_sessions (
          id SERIAL PRIMARY KEY,
          member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
          coach_id INTEGER NOT NULL REFERENCES coaches(id),
          session_date TEXT NOT NULL,
          session_hour INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'reserved',
          memo TEXT NOT NULL DEFAULT '',
          entry_type TEXT NOT NULL DEFAULT 'session',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (coach_id, session_date, session_hour)
        );

        CREATE TABLE IF NOT EXISTS fixed_slots (
          id SERIAL PRIMARY KEY,
          member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          weekday INTEGER NOT NULL, -- 0=월 ... 6=일
          hour INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (member_id, weekday, hour)
        );

        CREATE TABLE IF NOT EXISTS assessments (
          id SERIAL PRIMARY KEY,
          member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          evaluator_name TEXT NOT NULL DEFAULT '',
          evaluated_at TEXT NOT NULL DEFAULT '',
          movements JSONB NOT NULL DEFAULT '{}'::jsonb,
          core_note TEXT NOT NULL DEFAULT '',
          squat_note TEXT NOT NULL DEFAULT '',
          overhead_squat_note TEXT NOT NULL DEFAULT '',
          pushup_note TEXT NOT NULL DEFAULT '',
          hip_hinge_note TEXT NOT NULL DEFAULT '',
          pain_trigger_note TEXT NOT NULL DEFAULT '',
          pain_scale INTEGER,
          pain_triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
          exercise_performance JSONB NOT NULL DEFAULT '[]'::jsonb,
          odi_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
          ndi_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
          quickdash_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
          koos12_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
          faam_adl_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
          faam_sports_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
          nprs_rest INTEGER,
          nprs_activity INTEGER,
          functional_test_pain_free JSONB NOT NULL DEFAULT '{}'::jsonb,
          hop_test_lsi NUMERIC,
          cmj_lsi NUMERIC,
          hamstring_lsi NUMERIC,
          asymptomatic_loading_weeks NUMERIC,
          startback_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS contracts (
          id SERIAL PRIMARY KEY,
          member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          entry_type TEXT NOT NULL DEFAULT 'new', -- 'new' | 'renewal'
          pt_type TEXT NOT NULL DEFAULT '1:1',
          total_sessions INTEGER NOT NULL DEFAULT 0,
          price INTEGER NOT NULL DEFAULT 0,
          payment_method TEXT NOT NULL DEFAULT 'card',
          rrn_front_encrypted TEXT NOT NULL DEFAULT '',
          address TEXT NOT NULL DEFAULT '',
          visit_channel TEXT NOT NULL DEFAULT '',
          visit_channel_referrer_name TEXT NOT NULL DEFAULT '',
          purposes TEXT[] NOT NULL DEFAULT '{}',
          purpose_other TEXT NOT NULL DEFAULT '',
          option_note TEXT NOT NULL DEFAULT '',
          start_date TEXT NOT NULL DEFAULT '',
          privacy_consent BOOLEAN NOT NULL DEFAULT false,
          signature_data_url TEXT,
          signed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS intake_questionnaires (
          id SERIAL PRIMARY KEY,
          member_id INTEGER NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
          intake_name TEXT NOT NULL DEFAULT '',
          age INTEGER,
          phone TEXT NOT NULL DEFAULT '',
          visit_channel TEXT NOT NULL DEFAULT '',
          visit_channel_referrer_name TEXT NOT NULL DEFAULT '',
          visit_channel_other TEXT NOT NULL DEFAULT '',
          exercise_purposes TEXT[] NOT NULL DEFAULT '{}',
          exercise_purpose_other TEXT NOT NULL DEFAULT '',
          stance_leg TEXT NOT NULL DEFAULT '',
          leg_cross TEXT NOT NULL DEFAULT '',
          sleep_position TEXT NOT NULL DEFAULT '',
          frequent_movement TEXT NOT NULL DEFAULT '',
          sleep_hours NUMERIC,
          sleep_quality TEXT NOT NULL DEFAULT '',
          stress_level TEXT NOT NULL DEFAULT '',
          drinking BOOLEAN NOT NULL DEFAULT false,
          smoking BOOLEAN NOT NULL DEFAULT false,
          other_notes TEXT NOT NULL DEFAULT '',
          pain_onset_period TEXT NOT NULL DEFAULT '',
          pain_onset_type TEXT NOT NULL DEFAULT '',
          pain_moi TEXT NOT NULL DEFAULT '',
          pain_movements JSONB NOT NULL DEFAULT '[]'::jsonb,
          pain_cycle_situation TEXT NOT NULL DEFAULT '',
          pain_cycle_morning TEXT NOT NULL DEFAULT '',
          pain_cycle_noon TEXT NOT NULL DEFAULT '',
          pain_cycle_evening TEXT NOT NULL DEFAULT '',
          pain_cycle_night TEXT NOT NULL DEFAULT '',
          pain_characteristics JSONB NOT NULL DEFAULT '[]'::jsonb,
          pain_characteristics_other TEXT NOT NULL DEFAULT '',
          improve_factors TEXT NOT NULL DEFAULT '',
          worsen_factors TEXT NOT NULL DEFAULT '',
          perceived_cause TEXT NOT NULL DEFAULT '',
          post_pain_action TEXT NOT NULL DEFAULT '',
          past_same_pain_history TEXT NOT NULL DEFAULT '',
          past_treatment TEXT NOT NULL DEFAULT '',
          major_complaint TEXT NOT NULL DEFAULT '',
          minor_complaint TEXT NOT NULL DEFAULT '',
          startback_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
          odi_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
          ndi_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
          quickdash_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
          koos12_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
          faam_adl_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
          faam_sports_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
          body_diagram_front TEXT NOT NULL DEFAULT '',
          body_diagram_back TEXT NOT NULL DEFAULT '',
          body_diagram_left TEXT NOT NULL DEFAULT '',
          body_diagram_right TEXT NOT NULL DEFAULT '',
          body_diagram_feet TEXT NOT NULL DEFAULT '',
          body_diagram_hands TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS notices (
          id SERIAL PRIMARY KEY,
          category TEXT NOT NULL DEFAULT 'notice', -- 'notice' | 'event'
          title TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        -- 관리자 전용 가계부(지출 내역). year_month는 'YYYY-MM' 형식으로 저장해
        -- 월별 목록 조회를 간단한 등호 비교로 처리한다.
        CREATE TABLE IF NOT EXISTS expenses (
          id SERIAL PRIMARY KEY,
          year_month TEXT NOT NULL,
          item TEXT NOT NULL,
          amount INTEGER NOT NULL DEFAULT 0,
          quantity INTEGER NOT NULL DEFAULT 1,
          note TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_expenses_year_month ON expenses(year_month);

        CREATE TABLE IF NOT EXISTS schedule_memos (
          id SERIAL PRIMARY KEY,
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        -- 관리자 화면 상단 "뒤로가기" 버튼의 실행취소(undo) 기능이 쓰는 로그.
        -- 각 행은 사용자가 실행한 저장/등록/삭제 동작 하나를 되돌리는 데 필요한
        -- 역연산(ops)을 통째로 담아, 여러 테이블에 걸친 동작(예: 신규 회원 등록 시
        -- 회원+패키지+계약서 동시 생성)도 한 번의 "뒤로가기"로 함께 되돌릴 수 있게 한다.
        CREATE TABLE IF NOT EXISTS undo_log (
          id SERIAL PRIMARY KEY,
          description TEXT NOT NULL,
          ops JSONB NOT NULL,
          undone BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        -- 관리자 로그인 세션이 실제로 열려있는 기기 목록. 로그인/하트비트 시
        -- device_id(브라우저에 오래 저장되는 랜덤 쿠키)로 upsert되고, 설정
        -- 페이지의 "최근 접속 기기"에서 목록 조회 및 원격 로그아웃(revoked_at)에 쓰인다.
        CREATE TABLE IF NOT EXISTS admin_devices (
          device_id TEXT PRIMARY KEY,
          device_label TEXT NOT NULL DEFAULT '기타 기기',
          app_version TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          revoked_at TIMESTAMPTZ
        );

        INSERT INTO coaches (name) VALUES ('신종수')
        ON CONFLICT (name) DO NOTHING;
        `,
      )
      .then(() =>
        // 기존(프로덕션) 테이블에는 위 CREATE TABLE IF NOT EXISTS 가 적용되지 않으므로
        // 이미 배포된 스키마를 위해 컬럼 추가 마이그레이션을 별도로 실행한다.
        // 컬럼 추가(ALTER)와 공휴일 시드(INSERT)는 서로 의존하지 않으므로(둘 다 위
        // CREATE TABLE 블록에만 의존) 순차 대신 병렬로 실행해 콜드스타트 시
        // 왕복 횟수를 줄인다.
        Promise.all([
          getPool().query(
            `
            ALTER TABLE class_sessions ALTER COLUMN member_id DROP NOT NULL;
            ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'session';
            ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS pt_type TEXT NOT NULL DEFAULT '1:1';
            ALTER TABLE packages ADD COLUMN IF NOT EXISTS pt_type TEXT NOT NULL DEFAULT '1:1';
            ALTER TABLE reservations ADD COLUMN IF NOT EXISTS member_id INTEGER REFERENCES members(id);
            ALTER TABLE reservations ADD COLUMN IF NOT EXISTS class_session_id INTEGER REFERENCES class_sessions(id);
            ALTER TABLE members ADD COLUMN IF NOT EXISTS referrer TEXT NOT NULL DEFAULT '';
            ALTER TABLE members ADD COLUMN IF NOT EXISTS available_times TEXT NOT NULL DEFAULT '';
            ALTER TABLE members ADD COLUMN IF NOT EXISTS followup_status TEXT NOT NULL DEFAULT '대기';
            ALTER TABLE members ADD COLUMN IF NOT EXISTS followup_memo TEXT NOT NULL DEFAULT '';
            ALTER TABLE coaches ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
          ALTER TABLE packages ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'card';
            ALTER TABLE assessments ADD COLUMN IF NOT EXISTS pain_triggers JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE assessments ADD COLUMN IF NOT EXISTS exercise_performance JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE assessments ADD COLUMN IF NOT EXISTS odi_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE assessments ADD COLUMN IF NOT EXISTS ndi_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE assessments ADD COLUMN IF NOT EXISTS quickdash_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE assessments ADD COLUMN IF NOT EXISTS koos12_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE assessments ADD COLUMN IF NOT EXISTS faam_adl_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE assessments ADD COLUMN IF NOT EXISTS faam_sports_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE assessments ADD COLUMN IF NOT EXISTS nprs_rest INTEGER;
            ALTER TABLE assessments ADD COLUMN IF NOT EXISTS nprs_activity INTEGER;
            ALTER TABLE assessments ADD COLUMN IF NOT EXISTS functional_test_pain_free JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE assessments ADD COLUMN IF NOT EXISTS hop_test_lsi NUMERIC;
            ALTER TABLE assessments ADD COLUMN IF NOT EXISTS cmj_lsi NUMERIC;
            ALTER TABLE assessments ADD COLUMN IF NOT EXISTS hamstring_lsi NUMERIC;
            ALTER TABLE assessments ADD COLUMN IF NOT EXISTS asymptomatic_loading_weeks NUMERIC;
            ALTER TABLE assessments ADD COLUMN IF NOT EXISTS startback_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS sleep_hours NUMERIC;
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS pain_trigger_movements TEXT[] NOT NULL DEFAULT '{}';
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS intake_name TEXT NOT NULL DEFAULT '';
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS age INTEGER;
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS pain_movements JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS visit_channel TEXT NOT NULL DEFAULT '';
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS visit_channel_referrer_name TEXT NOT NULL DEFAULT '';
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS visit_channel_other TEXT NOT NULL DEFAULT '';
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS exercise_purposes TEXT[] NOT NULL DEFAULT '{}';
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS exercise_purpose_other TEXT NOT NULL DEFAULT '';
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS startback_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS odi_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS ndi_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS quickdash_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS koos12_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS faam_adl_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS faam_sports_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_member_id_fkey;
            ALTER TABLE reservations ADD CONSTRAINT reservations_member_id_fkey
              FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL;
            ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_class_session_id_fkey;
            ALTER TABLE reservations ADD CONSTRAINT reservations_class_session_id_fkey
              FOREIGN KEY (class_session_id) REFERENCES class_sessions(id) ON DELETE SET NULL;
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS body_diagram_front TEXT NOT NULL DEFAULT '';
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS body_diagram_back TEXT NOT NULL DEFAULT '';
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS body_diagram_left TEXT NOT NULL DEFAULT '';
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS body_diagram_right TEXT NOT NULL DEFAULT '';
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS body_diagram_feet TEXT NOT NULL DEFAULT '';
            ALTER TABLE intake_questionnaires ADD COLUMN IF NOT EXISTS body_diagram_hands TEXT NOT NULL DEFAULT '';
            ALTER TABLE members ADD COLUMN IF NOT EXISTS improvement_direction TEXT NOT NULL DEFAULT '';
            ALTER TABLE members ADD COLUMN IF NOT EXISTS followup_updated_at TIMESTAMPTZ;
            ALTER TABLE contracts ADD COLUMN IF NOT EXISTS visit_channel_other TEXT NOT NULL DEFAULT '';

            -- class_sessions/packages는 매일 계속 쌓이는 테이블인데 PK 외 인덱스가 전혀 없어서,
            -- 데이터가 늘어날수록 스케줄표·대시보드·재등록 관리의 거의 모든 조회가 매번 전체
            -- 테이블을 훑는 시퀀셜 스캔이 되어 갈수록 느려졌다(체감상 "버퍼링"). 실제 조회 조건
            -- (member_id 조인, 날짜 범위, LEFT(session_date,7)/to_char(purchased_at,'YYYY-MM')
            -- 월 집계)에 맞춰 인덱스를 추가한다.
            CREATE INDEX IF NOT EXISTS idx_class_sessions_member_id ON class_sessions(member_id);
            CREATE INDEX IF NOT EXISTS idx_class_sessions_session_date ON class_sessions(session_date);
            CREATE INDEX IF NOT EXISTS idx_class_sessions_month ON class_sessions((LEFT(session_date, 7)));
            CREATE INDEX IF NOT EXISTS idx_packages_member_id ON packages(member_id);
            CREATE INDEX IF NOT EXISTS idx_packages_purchased_at ON packages(purchased_at);
            CREATE INDEX IF NOT EXISTS idx_assessments_member_id ON assessments(member_id);
            CREATE INDEX IF NOT EXISTS idx_contracts_member_id ON contracts(member_id);
            CREATE INDEX IF NOT EXISTS idx_undo_log_pending ON undo_log(created_at DESC) WHERE undone = false;
            `,
          ),
          getPool().query(
            `INSERT INTO holidays (holiday_date, name) VALUES ${SEED_HOLIDAYS_2026.map(
              (_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`,
            ).join(", ")}
             ON CONFLICT (holiday_date) DO NOTHING;`,
            SEED_HOLIDAYS_2026.flat(),
          ),
        ]),
      )
      .then(() => undefined);
}

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      // pg는 세미콜론으로 여러 문장을 이어붙인 쿼리를 실행하면 문장별 결과를
      // 담은 배열을 반환한다(마지막 문장의 .rows가 바로 나오지 않는다), 그래서
      // 결과값(rows)이 필요한 SELECT는 별도 호출로 분리한다.
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER NOT NULL DEFAULT 0);
        INSERT INTO schema_migrations (version)
          SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM schema_migrations);
      `);
      const { rows } = await getPool().query<{ version: number }>(
        `SELECT version FROM schema_migrations LIMIT 1`,
      );
      const currentVersion = rows[0]?.version ?? 0;
      if (currentVersion >= SCHEMA_VERSION) return;

      await runFullMigration();
      await getPool().query(`UPDATE schema_migrations SET version = $1`, [SCHEMA_VERSION]);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

export const UNIQUE_VIOLATION = "23505";

export async function query<
  T extends QueryResultRow = QueryResultRow,
>(text: string, params?: unknown[]) {
  await ensureSchema();
  return getPool().query<T>(text, params);
}

export interface ReservationRow {
  id: number;
  name: string;
  age: number;
  phone: string;
  purposes: string[];
  purpose_note: string;
  reservation_date: string;
  reservation_hour: number;
  created_at: string;
  member_id: number | null;
  class_session_id: number | null;
}

export interface CoachRow {
  id: number;
  name: string;
  phone: string;
  active: boolean;
  created_at: string;
}

export interface AdminDeviceRow {
  device_id: string;
  device_label: string;
  app_version: string;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
}

export interface HolidayRow {
  holiday_date: string;
  name: string;
}

export type MemberStatus = "active" | "inactive";

export interface MemberRow {
  id: number;
  name: string;
  phone: string;
  coach_id: number | null;
  notes: string;
  referrer: string;
  available_times: string;
  followup_status: string;
  followup_memo: string;
  followup_updated_at: string | null;
  improvement_direction: string;
  status: MemberStatus;
  token: string;
  created_at: string;
}

export type PtType = "1:1" | "2:1";

export type PaymentMethod = "card" | "transfer";

export interface PackageRow {
  id: number;
  member_id: number;
  total_sessions: number;
  price: number;
  purchased_at: string;
  note: string;
  pt_type: PtType;
  payment_method: PaymentMethod;
}

export interface FixedSlotRow {
  id: number;
  member_id: number;
  weekday: number;
  hour: number;
  created_at: string;
}

export type ContractEntryType = "new" | "renewal";
// 초진 문진표·계약서·대시보드 통계가 공유하는 방문 경로 값 — 실제 선택지 목록은
// lib/intake-questionnaire.ts의 VISIT_CHANNEL_OPTIONS를 참고(단일 출처).
export type VisitChannel =
  | "blog"
  | "naver_cafe"
  | "instagram"
  | "signboard"
  | "banner"
  | "flyer"
  | "referral"
  | "other"
  | "";

export interface ContractRow {
  id: number;
  member_id: number;
  entry_type: ContractEntryType;
  pt_type: PtType;
  total_sessions: number;
  price: number;
  payment_method: PaymentMethod;
  rrn_front_encrypted: string;
  address: string;
  visit_channel: VisitChannel;
  visit_channel_referrer_name: string;
  visit_channel_other: string;
  purposes: string[];
  purpose_other: string;
  option_note: string;
  start_date: string;
  privacy_consent: boolean;
  signature_data_url: string | null;
  signed_at: string | null;
  created_at: string;
}

export interface AssessmentMovementEntry {
  romPassive: string;
  romActive: string;
  strength: string;
  painScale: string;
  compensation: string;
}

export type AssessmentMovements = Record<string, AssessmentMovementEntry>;

export interface PainTriggerEntry {
  note: string;
  painScale: number | null;
}

export interface ExercisePerformanceEntry {
  exercise: string;
  note: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
}

export interface AssessmentRow {
  id: number;
  member_id: number;
  evaluator_name: string;
  evaluated_at: string;
  movements: AssessmentMovements;
  core_note: string;
  squat_note: string;
  overhead_squat_note: string;
  pushup_note: string;
  hip_hinge_note: string;
  // 레거시 단일 필드 — pain_triggers 도입 전에 저장된 평가에서만 값이 있다.
  pain_trigger_note: string;
  pain_scale: number | null;
  pain_triggers: PainTriggerEntry[];
  exercise_performance: ExercisePerformanceEntry[];
  odi_answers: Record<string, number>;
  ndi_answers: Record<string, number>;
  quickdash_answers: Record<string, number>;
  koos12_answers: Record<string, number>;
  faam_adl_answers: Record<string, number>;
  faam_sports_answers: Record<string, number>;
  nprs_rest: number | null;
  nprs_activity: number | null;
  functional_test_pain_free: Record<string, boolean>;
  hop_test_lsi: number | null;
  cmj_lsi: number | null;
  hamstring_lsi: number | null;
  asymptomatic_loading_weeks: number | null;
  startback_answers: Record<string, number>;
  created_at: string;
}

export interface PainMovementEntry {
  movement: string;
  nrsBest: number | null;
  nrsWorst: number | null;
  nrsCurrent: number | null;
}

export interface IntakeQuestionnaireRow {
  id: number;
  member_id: number;
  intake_name: string;
  age: number | null;
  phone: string;
  visit_channel: string;
  visit_channel_referrer_name: string;
  visit_channel_other: string;
  exercise_purposes: string[];
  exercise_purpose_other: string;
  stance_leg: string;
  leg_cross: string;
  sleep_position: string;
  frequent_movement: string;
  sleep_hours: number | null;
  sleep_quality: string;
  stress_level: string;
  drinking: boolean;
  smoking: boolean;
  other_notes: string;
  pain_onset_period: string;
  pain_onset_type: string;
  pain_moi: string;
  pain_movements: PainMovementEntry[];
  pain_cycle_situation: string;
  pain_cycle_morning: string;
  pain_cycle_noon: string;
  pain_cycle_evening: string;
  pain_cycle_night: string;
  pain_characteristics: string[];
  pain_characteristics_other: string;
  improve_factors: string;
  worsen_factors: string;
  perceived_cause: string;
  post_pain_action: string;
  past_same_pain_history: string;
  past_treatment: string;
  major_complaint: string;
  minor_complaint: string;
  startback_answers: Record<string, number>;
  odi_answers: Record<string, number>;
  ndi_answers: Record<string, number>;
  quickdash_answers: Record<string, number>;
  koos12_answers: Record<string, number>;
  faam_adl_answers: Record<string, number>;
  faam_sports_answers: Record<string, number>;
  body_diagram_front: string;
  body_diagram_back: string;
  body_diagram_left: string;
  body_diagram_right: string;
  body_diagram_feet: string;
  body_diagram_hands: string;
  created_at: string;
  updated_at: string;
}

export type SessionStatus = "reserved" | "completed" | "no_show" | "cancelled";
export type SessionEntryType = "session" | "consultation" | "memo" | "blocked";

export interface ClassSessionRow {
  id: number;
  member_id: number | null;
  coach_id: number;
  session_date: string;
  session_hour: number;
  status: SessionStatus;
  memo: string;
  entry_type: SessionEntryType;
  pt_type: PtType;
  created_at: string;
}

export type NoticeCategory = "notice" | "event";

export interface NoticeRow {
  id: number;
  category: NoticeCategory;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseRow {
  id: number;
  year_month: string;
  item: string;
  amount: number;
  quantity: number;
  note: string;
  created_at: string;
}

export interface ScheduleMemoRow {
  id: number;
  content: string;
  created_at: string;
}
