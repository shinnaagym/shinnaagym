import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import {
  computeMemberProgress,
  deleteFixedSlotsByMember,
  deleteMember,
  deleteUpcomingSessionsForMember,
  getMemberById,
  listFixedSlotsByMember,
  listPackages,
  listMemberSessions,
  listPastSessionIdsForMember,
  updateMember,
  updatePackage,
} from "@/lib/schedule";
import {
  deleteContractsByMember,
  getLatestContractByMember,
  listContractsByMember,
} from "@/lib/contracts";
import { deleteAssessmentsByMember, listAssessmentsByMember } from "@/lib/assessments";
import { deletePtLogsByMember, listPtLogsByMember } from "@/lib/pt-logs";
import { deletePersonalExercisesByMember, listPersonalExercisesByMember } from "@/lib/personal-exercises";
import { deleteIntakeQuestionnaire, getIntakeQuestionnaireByMember } from "@/lib/intake";
import { koreaTodayKey } from "@/lib/date";
import { recordUndo, type UndoOp } from "@/lib/undo";
import type {
  AssessmentRow,
  IntakeQuestionnaireRow,
  MemberStatus,
  PersonalExerciseRow,
  PtLogRow,
} from "@/lib/db";

// JSONB 배열 컬럼(pain_triggers/exercise_performance, exercises, pain_movements/
// pain_characteristics)은 pg가 JS 배열을 Postgres 네이티브 배열 리터럴로 오인하지
// 않도록 직접 JSON.stringify해서 넘겨야 한다 — 다른 라우트의 실행취소 스냅샷과
// 같은 이유(app/api/admin/pt-logs/[id]/route.ts 등 참고).
function assessmentRowForSql(a: AssessmentRow): Record<string, unknown> {
  return {
    ...a,
    pain_triggers: JSON.stringify(a.pain_triggers),
    exercise_performance: JSON.stringify(a.exercise_performance),
  };
}
function ptLogRowForSql(row: PtLogRow): Record<string, unknown> {
  return { ...row, exercises: JSON.stringify(row.exercises) };
}
function personalExerciseRowForSql(row: PersonalExerciseRow): Record<string, unknown> {
  return { ...row, exercises: JSON.stringify(row.exercises) };
}
function intakeRowForSql(row: IntakeQuestionnaireRow): Record<string, unknown> {
  return {
    ...row,
    pain_movements: JSON.stringify(row.pain_movements),
    pain_characteristics: JSON.stringify(row.pain_characteristics),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  const idNum = Number(id);
  const member = await getMemberById(idNum);
  if (!member) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }
  const [progress, packages, sessions, fullContract, assessments] = await Promise.all([
    computeMemberProgress(idNum),
    listPackages(idNum),
    listMemberSessions(idNum),
    getLatestContractByMember(idNum),
    listAssessmentsByMember(idNum),
  ]);
  // 민감한 필드(주민등록번호 앞자리, 서명 이미지)는 이 요약 응답에는 담지 않는다.
  const contract = fullContract
    ? { id: fullContract.id, entryType: fullContract.entry_type, signedAt: fullContract.signed_at }
    : null;
  const assessmentSummary = {
    count: assessments.length,
    latestAt: assessments[0]?.evaluated_at || assessments[0]?.created_at || null,
  };
  return NextResponse.json({
    member,
    progress,
    packages,
    sessions,
    contract,
    assessmentSummary,
  });
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
  const body = (await req.json().catch(() => null)) as
    | {
        name?: unknown;
        phone?: unknown;
        coachId?: unknown;
        notes?: unknown;
        referrer?: unknown;
        availableTimes?: unknown;
        followupStatus?: unknown;
        followupMemo?: unknown;
        improvementDirection?: unknown;
        status?: unknown;
      }
    | null;
  if (!body) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const VALID_FOLLOWUP_STATUSES = ["대기", "연락함", "재등록 확정", "보류", "이탈"];

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  const coachId =
    body.coachId === null ? null : typeof body.coachId === "number" ? body.coachId : undefined;
  const notes = typeof body.notes === "string" ? body.notes.trim() : undefined;
  const referrer = typeof body.referrer === "string" ? body.referrer.trim() : undefined;
  const availableTimes =
    typeof body.availableTimes === "string" ? body.availableTimes.trim() : undefined;
  const followupStatus =
    typeof body.followupStatus === "string" &&
    VALID_FOLLOWUP_STATUSES.includes(body.followupStatus)
      ? body.followupStatus
      : undefined;
  const followupMemo =
    typeof body.followupMemo === "string" ? body.followupMemo.trim() : undefined;
  const improvementDirection =
    typeof body.improvementDirection === "string" ? body.improvementDirection.trim() : undefined;
  const status =
    body.status === "active" || body.status === "inactive"
      ? (body.status as MemberStatus)
      : undefined;

  const before = await getMemberById(idNum);
  if (!before) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  await updateMember(idNum, {
    name,
    phone,
    coachId,
    notes,
    referrer,
    availableTimes,
    followupStatus,
    followupMemo,
    improvementDirection,
    status,
  });

  const prevValues: Record<string, unknown> = {};
  if (name !== undefined) prevValues.name = before.name;
  if (phone !== undefined) prevValues.phone = before.phone;
  if (coachId !== undefined) prevValues.coach_id = before.coach_id;
  if (notes !== undefined) prevValues.notes = before.notes;
  if (referrer !== undefined) prevValues.referrer = before.referrer;
  if (availableTimes !== undefined) prevValues.available_times = before.available_times;
  if (followupStatus !== undefined) {
    prevValues.followup_status = before.followup_status;
    prevValues.followup_updated_at = before.followup_updated_at;
  }
  if (followupMemo !== undefined) prevValues.followup_memo = before.followup_memo;
  if (improvementDirection !== undefined) prevValues.improvement_direction = before.improvement_direction;
  if (status !== undefined) prevValues.status = before.status;

  if (Object.keys(prevValues).length > 0) {
    await recordUndo(`${before.name} 회원 정보 수정`, [
      { op: "update", table: "members", id: idNum, data: prevValues },
    ]);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
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
  const member = await getMemberById(idNum);
  if (!member) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }

  // 환불 처리를 겸한 삭제면(회원 상세의 "환불" 버튼), 가장 최근 패키지 결제금액에서
  // 환불액만큼 뺀 금액으로 정산 기록을 남긴다.
  const body = (await req.json().catch(() => null)) as { refundAmount?: unknown } | null;
  const refundAmount =
    typeof body?.refundAmount === "number" && Number.isFinite(body.refundAmount) && body.refundAmount > 0
      ? Math.round(body.refundAmount)
      : 0;

  // 회원을 지워도 PT 예약 내역·결제 내역·신규/재등록 월별 통계는 그대로 남겨야
  // 하므로, members 행 자체는 지우지 않고 소프트 삭제(deleted_at)로 처리하고
  // followup_status를 "이탈"로 넘긴다(deleteMember 내부에서 처리). 회원 행이
  // 남아있으니 packages/class_sessions의 member_id도 계속 유효하게 남는다.
  // 계약서·평가지·PT 일지·초진 문진표·고정 시간대 같은 개인정보/기록은 회원 행이
  // 살아있어 CASCADE가 더 이상 발동하지 않으므로 여기서 직접 지운다. 앞으로
  // 예정된 예약은 회원이 이탈했으니 지워서 그 시간대를 다른 회원이 쓸 수 있게 한다.
  const today = koreaTodayKey();
  const [contracts, assessments, ptLogs, personalExercises, intake, fixedSlots, packages, pastSessionIds] =
    await Promise.all([
      listContractsByMember(idNum),
      listAssessmentsByMember(idNum),
      listPtLogsByMember(idNum),
      listPersonalExercisesByMember(idNum),
      getIntakeQuestionnaireByMember(idNum),
      listFixedSlotsByMember(idNum),
      listPackages(idNum),
      listPastSessionIdsForMember(idNum, today),
    ]);

  const latestPackage = packages[packages.length - 1];
  if (refundAmount > 0 && latestPackage) {
    await updatePackage(latestPackage.id, {
      price: Math.max(0, latestPackage.price - refundAmount),
    });
  }

  const deletedUpcomingSessions = await deleteUpcomingSessionsForMember(idNum, today);
  await Promise.all([
    deleteContractsByMember(idNum),
    deleteAssessmentsByMember(idNum),
    deletePtLogsByMember(idNum),
    deletePersonalExercisesByMember(idNum),
    deleteIntakeQuestionnaire(idNum),
    deleteFixedSlotsByMember(idNum),
  ]);
  await deleteMember(idNum);

  const ops: UndoOp[] = [
    {
      op: "update",
      table: "members",
      id: idNum,
      data: {
        deleted_at: null,
        status: member.status,
        followup_status: member.followup_status,
        followup_updated_at: member.followup_updated_at,
      },
    },
    ...contracts.map((c): UndoOp => ({ op: "insert", table: "contracts", data: c })),
    ...assessments.map((a): UndoOp => ({ op: "insert", table: "assessments", data: assessmentRowForSql(a) })),
    ...ptLogs.map((p): UndoOp => ({ op: "insert", table: "pt_logs", data: ptLogRowForSql(p) })),
    ...personalExercises.map((p): UndoOp => ({
      op: "insert",
      table: "personal_exercises",
      data: personalExerciseRowForSql(p),
    })),
    ...(intake ? [{ op: "insert", table: "intake_questionnaires", data: intakeRowForSql(intake) } as UndoOp] : []),
    ...fixedSlots.map((f): UndoOp => ({ op: "insert", table: "fixed_slots", data: f })),
    ...deletedUpcomingSessions.map((s): UndoOp => ({ op: "insert", table: "class_sessions", data: s })),
    // 환불로 깎은 결제금액(price)을 실행취소로 되돌릴 수 있게 한다(member_id는
    // 회원 행이 그대로 남아있어 바뀌지 않으므로 되돌릴 필요가 없다).
    ...(refundAmount > 0 && latestPackage
      ? [{ op: "update", table: "packages", id: latestPackage.id, data: { price: latestPackage.price } } as UndoOp]
      : []),
  ];
  await recordUndo(
    refundAmount > 0 ? `${member.name} 회원 환불 후 삭제 (${refundAmount.toLocaleString()}원)` : `${member.name} 회원 완전 삭제`,
    ops,
  );

  return NextResponse.json({
    ok: true,
    keptPastSessions: pastSessionIds.length,
    keptPackages: packages.length,
    deletedUpcomingSessions: deletedUpcomingSessions.length,
    refundAmount,
  });
}
