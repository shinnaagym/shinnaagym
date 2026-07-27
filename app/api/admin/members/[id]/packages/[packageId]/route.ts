import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { deletePackage, updatePackage } from "@/lib/schedule";
import type { PtType } from "@/lib/db";

const VALID_PT_TYPES: PtType[] = ["1:1", "2:1"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ packageId: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { packageId } = await params;
  const idNum = Number(packageId);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as
    | { totalSessions?: unknown; price?: unknown; note?: unknown; ptType?: unknown }
    | null;

  const totalSessions =
    typeof body?.totalSessions === "number" ? body.totalSessions : undefined;
  if (totalSessions !== undefined && (!Number.isInteger(totalSessions) || totalSessions < 1)) {
    return NextResponse.json({ error: "횟수를 올바르게 입력해주세요." }, { status: 400 });
  }
  const price = typeof body?.price === "number" ? body.price : undefined;
  const note = typeof body?.note === "string" ? body.note.trim() : undefined;
  const ptType =
    typeof body?.ptType === "string" && VALID_PT_TYPES.includes(body.ptType as PtType)
      ? (body.ptType as PtType)
      : undefined;

  const pkg = await updatePackage(idNum, { totalSessions, price, note, ptType });
  return NextResponse.json({ package: pkg });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ packageId: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { packageId } = await params;
  const idNum = Number(packageId);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  await deletePackage(idNum);
  return NextResponse.json({ ok: true });
}
