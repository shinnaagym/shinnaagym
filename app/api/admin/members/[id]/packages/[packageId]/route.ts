import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { deletePackage, updatePackage } from "@/lib/schedule";
import { query } from "@/lib/db";
import { recordUndo } from "@/lib/undo";
import type { PackageRow, PaymentMethod, PtType } from "@/lib/db";

const VALID_PT_TYPES: PtType[] = ["1:1", "2:1"];
const VALID_PAYMENT_METHODS: PaymentMethod[] = ["card", "transfer"];

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
    | {
        totalSessions?: unknown;
        price?: unknown;
        note?: unknown;
        ptType?: unknown;
        paymentMethod?: unknown;
      }
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
  const paymentMethod =
    typeof body?.paymentMethod === "string" &&
    VALID_PAYMENT_METHODS.includes(body.paymentMethod as PaymentMethod)
      ? (body.paymentMethod as PaymentMethod)
      : undefined;

  const before = (await query<PackageRow>(`SELECT * FROM packages WHERE id = $1`, [idNum])).rows[0];
  if (!before) {
    return NextResponse.json({ error: "패키지를 찾을 수 없습니다." }, { status: 404 });
  }

  const pkg = await updatePackage(idNum, { totalSessions, price, note, ptType, paymentMethod });

  const prevValues: Record<string, unknown> = {};
  if (totalSessions !== undefined) prevValues.total_sessions = before.total_sessions;
  if (price !== undefined) prevValues.price = before.price;
  if (note !== undefined) prevValues.note = before.note;
  if (ptType !== undefined) prevValues.pt_type = before.pt_type;
  if (paymentMethod !== undefined) prevValues.payment_method = before.payment_method;
  if (Object.keys(prevValues).length > 0) {
    await recordUndo("패키지 수정", [{ op: "update", table: "packages", id: idNum, data: prevValues }]);
  }

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
  const before = (await query<PackageRow>(`SELECT * FROM packages WHERE id = $1`, [idNum])).rows[0];
  await deletePackage(idNum);
  if (before) {
    await recordUndo("패키지 삭제", [{ op: "insert", table: "packages", data: before }]);
  }
  return NextResponse.json({ ok: true });
}
