// 설정 화면(관리자용)과 실제 발송 코드(session-reminders.ts,
// consultation-confirmation.ts) 양쪽에서 같이 쓰는 "순수" 정의 — DB를 건드리지
// 않아 클라이언트 컴포넌트(설정 화면의 미리보기)에서도 그대로 import할 수
// 있다. DB 읽기·쓰기는 lib/sms-templates-store.ts에 따로 둔다(그 파일은
// ./db를 import해서 서버 전용이라, 클라이언트 컴포넌트가 가져다 쓰면 빌드가
// 깨진다 — lib/assessment-movements.ts·past-exercise-names.ts와 같은 이유).

export type SmsTemplateKey = "session_reminder" | "consultation_reminder" | "consultation_confirmation";

export interface SmsTemplatePlaceholder {
  token: string;
  description: string;
}

export interface SmsTemplateDef {
  key: SmsTemplateKey;
  label: string;
  description: string;
  placeholders: SmsTemplatePlaceholder[];
  defaultBody: string;
  /** 미리보기에 쓸 예시 값. */
  sampleVars: Record<string, string>;
}

export const SMS_TEMPLATE_DEFS: SmsTemplateDef[] = [
  {
    key: "session_reminder",
    label: "PT 전 문자",
    description: "내일 PT 수업이 있는 회원에게 전날 보내는 리마인드 문자예요.",
    placeholders: [
      { token: "{이름}", description: "회원 이름" },
      { token: "{월}", description: "수업 월 (예: 11)" },
      { token: "{일}", description: "수업 일 (예: 3)" },
      { token: "{요일}", description: "수업 요일 (예: 화)" },
      { token: "{시간}", description: "수업 시각 (예: 14:00)" },
      { token: "{코치}", description: "담당 코치 이름" },
      { token: "{코치전화}", description: "담당 코치 전화번호 (없으면 스튜디오 번호)" },
    ],
    defaultBody: "[신나아짐] {이름}님 내일 {월}/{일}({요일}) {시간} PT {코치} {코치전화}/밴드",
    sampleVars: {
      이름: "홍길동",
      월: "11",
      일: "3",
      요일: "화",
      시간: "14:00",
      코치: "김코치",
      코치전화: "010-1234-5678",
    },
  },
  {
    key: "consultation_reminder",
    label: "상담 전 문자",
    description: "내일 상담이 있는 분에게 전날 보내는 안내 문자예요.",
    placeholders: [
      { token: "{이름}", description: "이름" },
      { token: "{월}", description: "상담 월" },
      { token: "{일}", description: "상담 일" },
      { token: "{요일}", description: "상담 요일" },
      { token: "{시간}", description: "상담 시각 (예: 오후 2시)" },
    ],
    defaultBody: `[신나아짐] 안녕하세요, {이름}님 😊
내일 상담 일정 안내드립니다.

📅 일시: {월}월 {일}일({요일}) {시간}
📍 장소: 청주시 흥덕구 서현로 32 가경자이프라자 2층 신나아짐
🚗 주차: 상가 내 지하주차장, 상가 옆 무료 공영주차장
⏱ 소요 시간: 약 30분~50분

편한 운동복 준비해 주시면 간단한 움직임·자세 평가까지 함께 진행해 드려요.

일정 변경이 필요하시면 편하게 연락 주세요.
내일 뵙겠습니다!`,
    sampleVars: { 이름: "홍길동", 월: "11", 일: "3", 요일: "화", 시간: "오후 2시" },
  },
  {
    key: "consultation_confirmation",
    label: "상담 등록 문자",
    description: "상담을 막 예약한 직후, 등록 확인 겸 바로 보내는 문자예요.",
    placeholders: [
      { token: "{이름}", description: "이름" },
      { token: "{월}", description: "상담 월" },
      { token: "{일}", description: "상담 일" },
      { token: "{요일}", description: "상담 요일" },
      { token: "{시간}", description: "상담 시각 (예: 오후 2시)" },
    ],
    defaultBody: `[신나아짐] {이름}님, 상담 신청해 주셔서 감사합니다 😊
예약 내용 확인 부탁드려요.

📅 일시: {월}월 {일}일({요일}) {시간}
📍 장소: 청주시 흥덕구 서현로 32 가경자이프라자 2층 신나아짐
🚗 주차: 상가 내 지하주차장, 상가 옆 무료 공영주차장


상담은 약 30분~50분 동안 현재 몸 상태와 움직임을 확인하고, {이름}님께 맞는 운동 방향을 함께 정하는 시간이에요. 편한 운동복 준비해 주세요.

상담 전날 안내 문자 다시 보내겠습니다.
일정 변경이 필요하시면 이 번호로 편하게 연락 주세요!`,
    sampleVars: { 이름: "홍길동", 월: "11", 일: "3", 요일: "화", 시간: "오후 2시" },
  },
];

export function smsTemplateDef(key: SmsTemplateKey): SmsTemplateDef {
  const def = SMS_TEMPLATE_DEFS.find((d) => d.key === key);
  if (!def) throw new Error(`알 수 없는 문자 템플릿 key: ${key}`);
  return def;
}

/** "{토큰}" 형태의 자리표시자를 vars 값으로 바꾼다. vars에 없는 토큰은 오타를
    바로 알아챌 수 있도록 그대로(예: "{오타}") 남겨둔다. */
export function renderSmsTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{([^{}]+)\}/g, (match, token: string) =>
    Object.prototype.hasOwnProperty.call(vars, token) ? vars[token] : match,
  );
}
