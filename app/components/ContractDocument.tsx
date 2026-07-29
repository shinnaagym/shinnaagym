import type { ContractEntryType, PaymentMethod, PtType, VisitChannel } from "@/lib/db";
import { PURPOSE_LABELS } from "@/lib/constants";
import { VISIT_CHANNEL_OPTIONS } from "@/lib/intake-questionnaire";

const VISIT_CHANNEL_LABELS: Record<string, string> = {
  // 예전(방문 경로 선택지를 문진표와 통일하기 전) 계약서에 저장된 값 표시용 —
  // 신규 계약서는 더 이상 이 값들을 선택할 수 없지만, 과거 데이터는 계속 보여야 한다.
  naver: "네이버",
  danggeun: "당근",
  cafe: "카페",
  ...Object.fromEntries(VISIT_CHANNEL_OPTIONS.map((opt) => [opt.value, opt.label])),
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "카드결제",
  transfer: "계좌이체",
};

const ENTRY_TYPE_LABELS: Record<ContractEntryType, string> = {
  new: "신규",
  renewal: "재등록",
};

function formatWon(n: number): string {
  return `₩${n.toLocaleString("ko-KR")}`;
}

export interface ContractDocumentData {
  entry_type: ContractEntryType;
  pt_type: PtType;
  total_sessions: number;
  price: number;
  payment_method: PaymentMethod;
  rrn_front: string;
  address: string;
  visit_channel: VisitChannel;
  visit_channel_referrer_name: string;
  visit_channel_other: string;
  purposes: string[];
  purpose_other: string;
  option_note: string;
  start_date: string;
  privacy_consent: boolean;
}

// 회원 개인 계약서 페이지(/my/[token]/contract)와 관리자 계약서 보기 모달이
// 공유하는 계약서 본문. 서명 영역(children)만 호출부마다 다르게 채운다 —
// 회원 페이지는 서명 패드/서명 완료 표시를, 관리자 보기는 읽기 전용
// 서명 상태 표시를 넣는다.
export function ContractDocument({
  memberName,
  memberPhone,
  contract,
  children,
}: {
  memberName: string;
  memberPhone: string;
  contract: ContractDocumentData;
  children: React.ReactNode;
}) {
  const purposeLabels = [
    ...contract.purposes.map((p) => PURPOSE_LABELS[p] ?? p),
    ...(contract.purpose_other ? [`기타(${contract.purpose_other})`] : []),
  ];

  const visitChannelLabel = contract.visit_channel
    ? contract.visit_channel === "referral" && contract.visit_channel_referrer_name
      ? `소개 (${contract.visit_channel_referrer_name})`
      : contract.visit_channel === "other" && contract.visit_channel_other
        ? `기타 (${contract.visit_channel_other})`
        : VISIT_CHANNEL_LABELS[contract.visit_channel]
    : "-";

  return (
    <>
      <p className="text-sm tracking-[0.2em] text-coral uppercase mb-2">Contract</p>
      <h1 className="font-display text-3xl mb-1">신나아짐 회원가입 계약서</h1>
      <p className="text-xs text-ink/50 mb-8">
        운영시간 | 평일 09:00-22:00 · 토요일/공휴일 09:00-15:00 · 구분 [
        {ENTRY_TYPE_LABELS[contract.entry_type]}]
      </p>

      <section className="mb-10">
        <h2 className="font-display text-lg mb-3">1. 회원 정보 및 등록 세부사항</h2>
        <div className="rounded-2xl border border-line divide-y divide-line/60 text-sm">
          <div className="grid grid-cols-2 divide-x divide-line/60">
            <div className="px-4 py-3">
              <p className="text-xs text-ink/40 mb-0.5">성명</p>
              <p>{memberName}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-ink/40 mb-0.5">회원권 유형</p>
              <p>Premium {contract.pt_type} PT</p>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-line/60">
            <div className="px-4 py-3">
              <p className="text-xs text-ink/40 mb-0.5">주민등록번호(앞자리)</p>
              <p>{contract.rrn_front || "-"}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-ink/40 mb-0.5">기간 및 횟수</p>
              <p>{contract.total_sessions}회</p>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-line/60">
            <div className="px-4 py-3">
              <p className="text-xs text-ink/40 mb-0.5">주소</p>
              <p>{contract.address || "-"}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-ink/40 mb-0.5">옵션</p>
              <p>{contract.option_note || "-"}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-line/60">
            <div className="px-4 py-3">
              <p className="text-xs text-ink/40 mb-0.5">핸드폰</p>
              <p>{memberPhone || "-"}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-ink/40 mb-0.5">운동 시작일</p>
              <p>{contract.start_date || "-"}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-line/60">
            <div className="px-4 py-3">
              <p className="text-xs text-ink/40 mb-0.5">방문 경로</p>
              <p>{visitChannelLabel}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-ink/40 mb-0.5">회원비</p>
              <p>
                {formatWon(contract.price)} · {PAYMENT_METHOD_LABELS[contract.payment_method]}
              </p>
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs text-ink/40 mb-0.5">운동 목표</p>
            <p>{purposeLabels.length > 0 ? purposeLabels.join(", ") : "-"}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs text-ink/40 mb-0.5">
              개인정보(민감정보 포함) 수집·이용 동의 <span className="text-ink/30">(제3·4조 참고)</span>
            </p>
            <p>{contract.privacy_consent ? "동의함" : "동의하지 않음"}</p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-lg mb-3">2. 신나아짐 회원 약관</h2>
        <div className="text-sm text-ink/70 leading-relaxed space-y-4">
          <p>
            <span className="font-medium text-ink">제1조 (목적)</span> 이 약관은 신나아짐(이하
            &lsquo;당사&rsquo;라 합니다)과 당사가 제공하는 시설 및 서비스를 이용하는 자(이하
            &lsquo;회원&rsquo;이라 합니다) 사이에 체결된 계약에 따른 권리, 의무에 관한 사항을
            정함을 목적으로 합니다.
          </p>
          <div>
            <p className="font-medium text-ink mb-1">제2조 (이용 및 레슨 규정)</p>
            <ul className="list-disc list-inside space-y-1">
              <li>레슨은 세션 단위로 진행되며, 레슨 시간은 50분입니다. (개인운동 영업시간 내 이용 가능)</li>
              <li>레슨 변경 및 취소 시에는 레슨 12시간 이전에만 가능합니다.</li>
              <li>
                레슨 기간은 10회-40일, 20회-80일, 30회-120일을 초과할 수 없으며, 기간 만료 시
                자동 소멸됩니다.
              </li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink mb-1">제3조 (양도, 연기 사용, 환불)</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                양도: 원칙적으로 양도 및 명의 변경은 불가하나 사전 승인을 한 경우에는 예외로
                하며 1회에 한하여 가능합니다. (회원권 양도 시 양도비용 8만원 발생)
              </li>
              <li>
                연기: 연기 신청은 회원님이 센터에 방문하셨을 때만 가능합니다(전화 신청 불가).
                신청은 3개월 및 20회 기준(15일-1회), 6개월 및 30회 기준(15일-2회) 가능합니다.
              </li>
              <li>
                환불: 이벤트 상품 및 양도나 연기 사용 후에는 환불이 절대 불가합니다. 회원의
                부득이한 사정으로 환불을 요구할 경우 &lsquo;레슨비 + 위약금(10%) +
                수수료(5%)&rsquo;를 제하고 환불됩니다. (일반 회원권의 경우 시작일로부터 위약금
                10% + 경과된 날만큼 차감 후 환불)
              </li>
              <li>담당 코치가 강습을 할 수 없는 경우(퇴사 등), 동일한 자격을 갖춘 다른 코치로 대체될 수 있습니다.</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink mb-1">제4조 (손해배상)</p>
            <ul className="list-disc list-inside space-y-1">
              <li>회원은 센터 이용 중에 고의, 중대한 과실로 시설의 파손 등 센터에 손해가 발생한 경우에는 이를 배상해야 합니다.</li>
              <li>개인 운동 중에 회원님의 부주의함으로 다치신 경우 당사는 그 손해를 배상하지 않습니다.</li>
              <li>귀중품은 데스크에 맡겨주세요. 분실 시 책임지지 않습니다.</li>
            </ul>
          </div>
          <p>
            <span className="font-medium text-ink">제5조 (효력발생)</span> 귀하(회원)는 본
            계약서에 서명함으로써 회원권의 효력이 즉시 발생되고 귀하와 당사 간의 법적 구속력
            있는 계약 관계가 성립됨을 이해하며, 본인은 본 약관의 모든 내용을 숙지하고
            동의하였음을 인정하는 바입니다.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-lg mb-3">3. 개인정보 수집·이용 동의</h2>
        <div className="text-sm text-ink/70 leading-relaxed space-y-3">
          <div>
            <p className="font-medium text-ink mb-1">수집 목적</p>
            <p>
              회원 관리(본인 확인, 예약·출석·회차 관리), 운동 처방 및 PT 프로그램 설계·제공,
              계약의 체결 및 이행(회원권 등록·결제·양도·연기·환불 처리 등)을 위해 개인정보를
              수집·이용합니다.
            </p>
          </div>
          <div>
            <p className="font-medium text-ink mb-1">수집 항목</p>
            <p>성명, 연락처, 주민등록번호(앞자리), 주소, 방문경로, 운동목표 등 본 계약서에 기재된 정보</p>
          </div>
          <div>
            <p className="font-medium text-ink mb-1">보유 및 이용 기간</p>
            <p>
              회원 탈퇴일 또는 계약 종료일로부터 5년간 보관 후 파기합니다. 다만 관계 법령에 따라
              별도 보관이 필요한 경우 해당 법령에서 정한 기간 동안 보관합니다.
            </p>
          </div>
          <div>
            <p className="font-medium text-ink mb-1">동의 거부 권리 및 불이익 안내</p>
            <p>
              귀하는 위 개인정보 수집·이용에 동의를 거부할 권리가 있습니다. 다만 본 정보는 회원
              등록 및 계약 이행을 위해 필수적인 정보로, 동의하지 않을 경우 회원 등록 및 PT 서비스
              이용이 제한될 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-lg mb-3">4. 민감정보(건강정보) 수집·이용 동의</h2>
        <div className="rounded-2xl border border-coral/30 bg-coral/5 px-5 py-4 text-sm text-ink/70 leading-relaxed space-y-3">
          <p>
            신체 평가지 작성 과정에서 건강상태, 병력, 통증 부위·통증 척도 등{" "}
            <span className="font-medium text-ink">
              「개인정보 보호법」상 민감정보에 해당하는 정보
            </span>
            를 별도로 수집·이용합니다. 이는 위 제3조의 일반 개인정보 동의와 구분되는 별도 동의
            사항입니다.
          </p>
          <div>
            <p className="font-medium text-ink mb-1">이용 목적</p>
            <p>
              오직 회원 맞춤형 운동 프로그램 설계 및 부상 예방을 위한 트레이닝 지도 목적으로만
              사용하며, 그 외의 목적으로는 이용하지 않습니다.
            </p>
          </div>
          <div>
            <p className="font-medium text-ink mb-1">보유 및 이용 기간</p>
            <p>제3조와 동일하게 회원 탈퇴일 또는 계약 종료일로부터 5년간 보관 후 파기합니다.</p>
          </div>
          <div>
            <p className="font-medium text-ink mb-1">동의 거부 권리 및 불이익 안내</p>
            <p>
              귀하는 민감정보 수집·이용에 동의를 거부할 권리가 있습니다. 다만 동의하지 않을 경우
              신체 상태를 고려한 신체 평가 및 맞춤형 PT 프로그램 제공이 제한될 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-lg mb-3">5. 개인정보 보유 및 파기</h2>
        <div className="text-sm text-ink/70 leading-relaxed space-y-3">
          <p>
            당사는 회원의 개인정보(민감정보 포함)를 외부 제3자에게 제공하지 않습니다. 담당 코치
            변경·대체 등으로 소속 트레이너 간 정보가 공유되는 경우에도 이는 위 이용 목적 범위
            내에서 신나아짐 소속 직원만 열람하는 내부 이용에 한합니다.
          </p>
          <p>
            회원 탈퇴 시 또는 계약 종료 시, 관계 법령에 따른 별도 보관 의무가 없는 한 5년간
            보관한 뒤 지체 없이 파기합니다. 전자 파일 형태의 정보는 복구할 수 없는 방법으로
            영구 삭제하며, 서면 형태의 정보는 분쇄 또는 소각합니다.
          </p>
        </div>
      </section>

      <p className="text-sm text-ink/70 leading-relaxed mb-4">
        본 계약서에 서명함으로써 위 1~5의 회원 정보, 회원 약관, 개인정보 수집·이용 동의, 민감정보
        수집·이용 동의, 개인정보 보유·파기 안내를 모두 확인하고 동의하였음을 인정합니다.
      </p>

      <section className="mb-10">{children}</section>

      <div className="rounded-2xl bg-ink text-bone px-6 py-5 text-sm space-y-1">
        <p>신나아짐 본점 T. 010-6859-6114</p>
        <p className="text-bone/70">개인정보 보호책임자 · 신종수 (T. 010-6859-6114)</p>
      </div>
    </>
  );
}
