import { NextRequest, NextResponse } from "next/server";
import { query, UNIQUE_VIOLATION, type ReservationRow } from "@/lib/db";
import {
  BUSINESS_START_HOUR,
  BUSINESS_END_HOUR,
  PURPOSE_OPTIONS,
} from "@/lib/constants";
import { isWithinBookingWindow } from "@/lib/date";
import { getTakenSlots } from "@/lib/reservations";

const PURPOSE_VALUES = new Set(PURPOSE_OPTIONS.map((option) => option.value));
const PHONE_PATTERN = /^[0-9-+ ]{9,20}$/;

// Public: returns which (date, hour) slots are already taken, no personal info.
export async function GET() {
  const taken = await getTakenSlots();
  return NextResponse.json({ taken });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { name, age, phone, purposes, purposeNote, date, hour } = body as Record<
    string,
    unknown
  >;

  if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 30) {
    return NextResponse.json({ error: "성함을 올바르게 입력해주세요." }, { status: 400 });
  }

  const ageNum = Number(age);
  if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) {
    return NextResponse.json({ error: "나이를 올바르게 입력해주세요." }, { status: 400 });
  }

  if (typeof phone !== "string" || !PHONE_PATTERN.test(phone.trim())) {
    return NextResponse.json({ error: "연락처를 올바르게 입력해주세요." }, { status: 400 });
  }

  if (
    !Array.isArray(purposes) ||
    purposes.length === 0 ||
    !purposes.every((p) => typeof p === "string" && PURPOSE_VALUES.has(p as never))
  ) {
    return NextResponse.json(
      { error: "운동 목적을 하나 이상 선택해주세요." },
      { status: 400 },
    );
  }

  if (typeof purposeNote !== "string" || purposeNote.length > 200) {
    return NextResponse.json(
      { error: "설명은 200자 이내로 입력해주세요." },
      { status: 400 },
    );
  }

  if (typeof date !== "string" || !isWithinBookingWindow(date)) {
    return NextResponse.json(
      { error: "예약 가능한 날짜 범위를 벗어났습니다." },
      { status: 400 },
    );
  }

  const hourNum = Number(hour);
  if (
    !Number.isInteger(hourNum) ||
    hourNum < BUSINESS_START_HOUR ||
    hourNum >= BUSINESS_END_HOUR
  ) {
    return NextResponse.json({ error: "예약 시간을 올바르게 선택해주세요." }, { status: 400 });
  }

  try {
    const result = await query<ReservationRow>(
      `INSERT INTO reservations
         (name, age, phone, purposes, purpose_note, reservation_date, reservation_hour)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, reservation_date, reservation_hour`,
      [name.trim(), ageNum, phone.trim(), purposes, purposeNote.trim(), date, hourNum],
    );
    const row = result.rows[0];
    return NextResponse.json(
      { ok: true, id: row.id, date: row.reservation_date, hour: row.reservation_hour },
      { status: 201 },
    );
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === UNIQUE_VIOLATION
    ) {
      return NextResponse.json(
        { error: "이미 예약된 시간이에요. 다른 시간을 선택해주세요." },
        { status: 409 },
      );
    }
    console.error(err);
    return NextResponse.json({ error: "예약 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
