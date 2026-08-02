import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { deletePtLog, getPtLogById, updatePtLog } from "@/lib/pt-logs";
import { parseExercises } from "@/lib/pt-log-validation";
import { recordUndo } from "@/lib/undo";
import { koreaTodayKey } from "@/lib/date";
import type { PtLogRow } from "@/lib/db";

// exercises는 JSONB 배열 컬럼이라, undo insert/update에서 그대로 넘기면 pg가 이를
// Postgres 네이티브 배열 리터럴로 취급해버린다. assessments의 pain_triggers/
// exercise_performance 되돌리기와 같은 이유로 JSON.stringify해서 넘긴다.
function ptLogRowForSql(row: PtLogRow): Record<string, unknown> {
  return { ...row, exercises: JSON.stringify(row.exercises) };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const existing = await getPtLogById(idNum);
  if (!existing) {
    return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const logDate =
    typeof body?.logDate === "string" && body.logDate ? body.logDate : koreaTodayKey();
  const memo = typeof body?.memo === "string" ? body.memo.trim() : "";
  const exercises = parseExercises(body?.exercises);

  const ptLog = await updatePtLog(idNum, { logDate, memo, exercises });

  const { id: _prevId, ...prevRest } = ptLogRowForSql(existing);
  await recordUndo("PT 일지 수정", [
    { op: "update", table: "pt_logs", id: idNum, data: prevRest },
  ]);

  return NextResponse.json({ ptLog });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const ptLog = await getPtLogById(idNum);
  if (!ptLog) {
    return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
  }
  await deletePtLog(idNum);
  await recordUndo("PT 일지 삭제", [
    { op: "insert", table: "pt_logs", data: ptLogRowForSql(ptLog) },
  ]);
  return NextResponse.json({ ok: true });
}
