import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { deleteSession, updateSession } from "@/lib/schedule";
import type { PtType, SessionStatus } from "@/lib/db";

const VALID_STATUSES: SessionStatus[] = ["reserved", "completed", "no_show", "cancelled"];
const VALID_PT_TYPES: PtType[] = ["1:1", "2:1"];

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
    | { status?: unknown; memo?: unknown; coachId?: unknown; ptType?: unknown }
    | null;

  const status =
    typeof body?.status === "string" && VALID_STATUSES.includes(body.status as SessionStatus)
      ? (body.status as SessionStatus)
      : undefined;
  const memo = typeof body?.memo === "string" ? body.memo : undefined;
  const coachId =
    typeof body?.coachId === "number" && Number.isInteger(body.coachId)
      ? body.coachId
      : undefined;
  const ptType =
    typeof body?.ptType === "string" && VALID_PT_TYPES.includes(body.ptType as PtType)
      ? (body.ptType as PtType)
      : undefined;

  await updateSession(idNum, { status, memo, coachId, ptType });
  return NextResponse.json({ ok: true });
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
  await deleteSession(idNum);
  return NextResponse.json({ ok: true });
}
