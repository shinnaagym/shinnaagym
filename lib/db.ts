import { Pool, type QueryResultRow } from "pg";

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

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
        `,
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
