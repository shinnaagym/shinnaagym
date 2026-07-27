import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { addPackage } from "@/lib/schedule";
import type { PaymentMethod, PtType } from "@/lib/db";

const VALID_PT_TYPES: PtType[] = ["1:1", "2:1"];
const VALID_PAYMENT_METHODS: PaymentMethod[] = ["card", "transfer"];

export async function POST(
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
    | {
        totalSessions?: unknown;
        price?: unknown;
        note?: unknown;
        ptType?: unknown;
        paymentMethod?: unknown;
      }
    | null;
  const totalSessions = Number(body?.totalSessions ?? 0);
  const price = Number(body?.price ?? 0);
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!Number.isInteger(totalSessions) || totalSessions < 1) {
    return NextResponse.json({ error: "등록 횟수를 올바르게 입력해주세요." }, { status: 400 });
  }
  const ptType: PtType =
    typeof body?.ptType === "string" && VALID_PT_TYPES.includes(body.ptType as PtType)
      ? (body.ptType as PtType)
      : "1:1";
  const paymentMethod: PaymentMethod =
    typeof body?.paymentMethod === "string" &&
    VALID_PAYMENT_METHODS.includes(body.paymentMethod as PaymentMethod)
      ? (body.paymentMethod as PaymentMethod)
      : "card";
  const pkg = await addPackage(idNum, totalSessions, price, note || "재등록", ptType, paymentMethod);
  return NextResponse.json({ package: pkg }, { status: 201 });
}
