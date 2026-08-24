import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { isValidDateKey } from "@/lib/date";
import { addPromoPost, removePromoPost } from "@/lib/schedule";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { coachId?: unknown; date?: unknown } | null;
  const coachId = typeof body?.coachId === "number" && Number.isInteger(body.coachId) ? body.coachId : null;
  const date = typeof body?.date === "string" && isValidDateKey(body.date) ? body.date : null;
  if (!coachId || !date) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const entry = await addPromoPost(coachId, date);
  return NextResponse.json({ entry });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  await removePromoPost(id);
  return NextResponse.json({ ok: true });
}
