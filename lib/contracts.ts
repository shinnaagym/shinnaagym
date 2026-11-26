import { query } from "./db";
import type { ContractEntryType, ContractRow, PaymentMethod, PtType, VisitChannel } from "./db";
import { decryptText, encryptText } from "./crypto";
import { getMemberById, updateMember } from "./schedule";

export interface CreateContractInput {
  memberId: number;
  entryType?: ContractEntryType;
  ptType: PtType;
  totalSessions: number;
  price: number;
  paymentMethod: PaymentMethod;
  rrnFront?: string;
  address?: string;
  visitChannel?: VisitChannel;
  visitChannelReferrerName?: string;
  visitChannelOther?: string;
  purposes?: string[];
  purposeOther?: string;
  optionNote?: string;
  startDate?: string;
  privacyConsent?: boolean;
  /** 2:1 계약일 때 함께 등록하는 분의 정보(별도 회원으로는 등록되지 않음). */
  companionName?: string;
  companionPhone?: string;
  companionRrnFront?: string;
  companionAddress?: string;
  companionPrivacyConsent?: boolean;
}

export async function createContract(input: CreateContractInput): Promise<ContractRow> {
  const result = await query<ContractRow>(
    `INSERT INTO contracts (
       member_id, entry_type, pt_type, total_sessions, price, payment_method,
       rrn_front_encrypted, address, visit_channel, visit_channel_referrer_name,
       visit_channel_other, purposes, purpose_other, option_note, start_date, privacy_consent,
       companion_name, companion_phone, companion_rrn_front_encrypted, companion_address,
       companion_privacy_consent
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
     RETURNING *`,
    [
      input.memberId,
      input.entryType ?? "new",
      input.ptType,
      input.totalSessions,
      input.price,
      input.paymentMethod,
      encryptText(input.rrnFront ?? ""),
      input.address ?? "",
      input.visitChannel ?? "",
      input.visitChannelReferrerName ?? "",
      input.visitChannelOther ?? "",
      input.purposes ?? [],
      input.purposeOther ?? "",
      input.optionNote ?? "",
      input.startDate ?? "",
      input.privacyConsent ?? false,
      input.companionName ?? "",
      input.companionPhone ?? "",
      encryptText(input.companionRrnFront ?? ""),
      input.companionAddress ?? "",
      input.companionPrivacyConsent ?? false,
    ],
  );
  const contract = result.rows[0];

  // 계약서의 "방문 경로: 소개"에 이름을 적었는데 회원의 "소개해주신 분"이 아직
  // 비어있으면 그 이름을 그대로 채워준다 — 회원 관리 목록의 "소개: OOO" 배지가
  // 계약서에 적은 것과 별개로 다시 입력해야만 뜨던 문제를 없앤다. 이미 다른
  // 값이 적혀 있으면 덮어쓰지 않는다.
  const referrerName = input.visitChannelReferrerName?.trim();
  if (input.visitChannel === "referral" && referrerName) {
    const member = await getMemberById(input.memberId);
    if (member && !member.referrer) {
      await updateMember(input.memberId, { referrer: referrerName });
    }
  }

  return contract;
}

export interface UpdateContractInput {
  ptType: PtType;
  totalSessions: number;
  price: number;
  paymentMethod: PaymentMethod;
  rrnFront: string;
  address: string;
  visitChannel: VisitChannel;
  visitChannelReferrerName: string;
  visitChannelOther: string;
  purposes: string[];
  purposeOther: string;
  optionNote: string;
  startDate: string;
  privacyConsent: boolean;
  companionName: string;
  companionPhone: string;
  companionRrnFront: string;
  companionAddress: string;
  companionPrivacyConsent: boolean;
}

/** 관리자가 작성 후 오타·변경사항을 바로잡을 때 쓴다 — 서명 여부와 무관하게
    전체 항목을 한 번에 덮어쓴다(폼이 항상 전체 값을 다시 제출하므로). */
export async function updateContract(id: number, input: UpdateContractInput): Promise<ContractRow> {
  const result = await query<ContractRow>(
    `UPDATE contracts SET
       pt_type = $2, total_sessions = $3, price = $4, payment_method = $5,
       rrn_front_encrypted = $6, address = $7, visit_channel = $8,
       visit_channel_referrer_name = $9, visit_channel_other = $10, purposes = $11,
       purpose_other = $12, option_note = $13, start_date = $14, privacy_consent = $15,
       companion_name = $16, companion_phone = $17, companion_rrn_front_encrypted = $18,
       companion_address = $19, companion_privacy_consent = $20
     WHERE id = $1
     RETURNING *`,
    [
      id,
      input.ptType,
      input.totalSessions,
      input.price,
      input.paymentMethod,
      encryptText(input.rrnFront),
      input.address,
      input.visitChannel,
      input.visitChannelReferrerName,
      input.visitChannelOther,
      input.purposes,
      input.purposeOther,
      input.optionNote,
      input.startDate,
      input.privacyConsent,
      input.companionName,
      input.companionPhone,
      encryptText(input.companionRrnFront),
      input.companionAddress,
      input.companionPrivacyConsent,
    ],
  );
  return result.rows[0];
}

/** 회원의 계약서 전체(암호화된 그대로) — 회원 삭제 시 실행취소용 스냅샷 등에 쓴다. */
export async function listContractsByMember(memberId: number): Promise<ContractRow[]> {
  const result = await query<ContractRow>(
    `SELECT * FROM contracts WHERE member_id = $1 ORDER BY created_at ASC`,
    [memberId],
  );
  return result.rows;
}

/** 회원 삭제(소프트 삭제) 시 이 회원의 계약서를 모두 지운다. */
export async function deleteContractsByMember(memberId: number): Promise<void> {
  await query(`DELETE FROM contracts WHERE member_id = $1`, [memberId]);
}

/** 회원의 가장 최근 계약서 한 건(복호화된 주민등록번호 앞자리 포함). */
export async function getLatestContractByMember(
  memberId: number,
): Promise<(ContractRow & { rrn_front: string; companion_rrn_front: string }) | null> {
  const result = await query<ContractRow>(
    `SELECT * FROM contracts WHERE member_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [memberId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...row,
    rrn_front: decryptText(row.rrn_front_encrypted),
    companion_rrn_front: decryptText(row.companion_rrn_front_encrypted),
  };
}

export async function signContract(id: number, signatureDataUrl: string): Promise<ContractRow> {
  const result = await query<ContractRow>(
    `UPDATE contracts SET signature_data_url = $2, signed_at = now() WHERE id = $1 RETURNING *`,
    [id, signatureDataUrl],
  );
  return result.rows[0];
}
