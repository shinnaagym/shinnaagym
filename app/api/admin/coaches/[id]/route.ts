import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { setCoachActive, setCoachPhone } from "@/lib/schedule";
import { query } from "@/lib/db";
import { recordUndo } from "@/lib/undo";
import type { CoachRow } from "@/lib/db";

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
  const body = (await req.json().catch(() => null)) as
    | { active?: unknown; phone?: unknown }
    | null;
  if (body?.active === undefined && body?.phone === undefined) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const before = (await query<CoachRow>(`SELECT * FROM coaches WHERE id = $1`, [idNum])).rows[0];
  if (!before) {
    return NextResponse.json({ error: "코치를 찾을 수 없습니다." }, { status: 404 });
  }

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    await setCoachActive(idNum, body.active);
  }
  if (body.phone !== undefined) {
    if (typeof body.phone !== "string") {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    await setCoachPhone(idNum, body.phone.trim());
  }

  const prevValues: Record<string, unknown> = {};
  if (body.active !== undefined) prevValues.active = before.active;
  if (body.phone !== undefined) prevValues.phone = before.phone;
  await recordUndo(`${before.name} 코치 정보 수정`, [
    { op: "update", table: "coaches", id: idNum, data: prevValues },
  ]);

  return NextResponse.json({ ok: true });
}
