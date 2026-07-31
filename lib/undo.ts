import { query } from "./db";

/**
 * 하나의 사용자 동작(예: 예약 생성, 회원 정보 수정)을 되돌리기 위한 역연산 한 단계.
 * "delete"는 방금 생성된 행을 지워서 되돌리고, "insert"는 방금 삭제된 행을 스냅샷
 * 그대로 복원하며, "update"는 수정 전 값으로 되돌린다. table/컬럼명은 항상 서버
 * 코드에서 직접 지정하며 요청 바디에서 그대로 가져오지 않으므로 SQL 인젝션 위험이
 * 없다.
 */
export type UndoOp =
  | { op: "delete"; table: string; id: number | string; idColumn?: string }
  | { op: "insert"; table: string; data: object }
  | { op: "update"; table: string; id: number | string; data: object; idColumn?: string };

/**
 * 방금 실행한 동작을 undo_log에 기록한다. ops는 "되돌릴 때 실행할 순서"대로
 * 넘긴다(여러 테이블에 걸친 동작이면 생성의 역순, 즉 나중에 만든 것부터 지운다).
 */
export async function recordUndo(description: string, ops: UndoOp[]): Promise<void> {
  if (ops.length === 0) return;
  await query(`INSERT INTO undo_log (description, ops) VALUES ($1, $2::jsonb)`, [
    description,
    JSON.stringify(ops),
  ]);
}

async function applyOp(op: UndoOp): Promise<void> {
  if (op.op === "delete") {
    const idColumn = op.idColumn ?? "id";
    await query(`DELETE FROM ${op.table} WHERE ${idColumn} = $1`, [op.id]);
    return;
  }
  if (op.op === "insert") {
    const data = op.data as Record<string, unknown>;
    const cols = Object.keys(data);
    if (cols.length === 0) return;
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    await query(
      `INSERT INTO ${op.table} (${cols.join(", ")}) VALUES (${placeholders})`,
      cols.map((c) => data[c]),
    );
    return;
  }
  // update
  const idColumn = op.idColumn ?? "id";
  const data = op.data as Record<string, unknown>;
  const cols = Object.keys(data);
  if (cols.length === 0) return;
  const setClause = cols.map((c, i) => `${c} = $${i + 2}`).join(", ");
  await query(`UPDATE ${op.table} SET ${setClause} WHERE ${idColumn} = $1`, [
    op.id,
    ...cols.map((c) => data[c]),
  ]);
}

/** 가장 최근에 기록된(아직 되돌리지 않은) 동작 하나를 찾아 되돌린다. */
export async function undoLastAction(): Promise<{ description: string } | null> {
  const result = await query<{ id: number; description: string; ops: UndoOp[] }>(
    `SELECT id, description, ops FROM undo_log WHERE undone = false ORDER BY created_at DESC, id DESC LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) return null;

  for (const op of row.ops) {
    await applyOp(op);
  }
  await query(`UPDATE undo_log SET undone = true WHERE id = $1`, [row.id]);
  return { description: row.description };
}

/** 되돌릴 동작이 남아있는지(그리고 그 설명)만 가볍게 확인한다 — 버튼 상태 표시용. */
export async function peekLastAction(): Promise<{ description: string } | null> {
  const result = await query<{ description: string }>(
    `SELECT description FROM undo_log WHERE undone = false ORDER BY created_at DESC, id DESC LIMIT 1`,
  );
  return result.rows[0] ?? null;
}
