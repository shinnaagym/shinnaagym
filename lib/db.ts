import { Pool, type QueryResultRow } from "pg";

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

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
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
          note TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS class_sessions (
          id SERIAL PRIMARY KEY,
          member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          coach_id INTEGER NOT NULL REFERENCES coaches(id),
          session_date TEXT NOT NULL,
          session_hour INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'reserved',
          memo TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (coach_id, session_date, session_hour)
        );

        INSERT INTO coaches (name) VALUES ('신종수')
        ON CONFLICT (name) DO NOTHING;
        `,
      )
      .then(() =>
        getPool().query(
          `INSERT INTO holidays (holiday_date, name) VALUES ${SEED_HOLIDAYS_2026.map(
            (_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`,
          ).join(", ")}
           ON CONFLICT (holiday_date) DO NOTHING;`,
          SEED_HOLIDAYS_2026.flat(),
        ),
      )
      .then(() => undefined)
      .catch((err) => {
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
}

export interface CoachRow {
  id: number;
  name: string;
  active: boolean;
  created_at: string;
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
  status: MemberStatus;
  token: string;
  created_at: string;
}

export interface PackageRow {
  id: number;
  member_id: number;
  total_sessions: number;
  price: number;
  purchased_at: string;
  note: string;
}

export type SessionStatus = "reserved" | "completed" | "no_show" | "cancelled";

export interface ClassSessionRow {
  id: number;
  member_id: number;
  coach_id: number;
  session_date: string;
  session_hour: number;
  status: SessionStatus;
  memo: string;
  created_at: string;
}
