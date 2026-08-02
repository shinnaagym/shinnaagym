import { query } from "./db";
import type { ContractEntryType, ContractRow, PaymentMethod, PtType, VisitChannel } from "./db";
import { decryptText, encryptText } from "./crypto";

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
  return result.rows[0];
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
