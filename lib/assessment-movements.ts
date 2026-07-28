// 신체 평가지(체형/움직임 평가) 구조 정의. 부위별 동작 목록은 종이 평가지의
// 순서·구성을 그대로 따른다. 좌/우가 구분되는 동작만 -r/-l 두 항목으로
// 나누고, 나머지는 원본 그대로 한 항목만 둔다.

export interface MovementDef {
  id: string;
  en: string;
  ko: string;
}

export interface RegionDef {
  key: string;
  label: string;
  movements: MovementDef[];
}

export const ASSESSMENT_REGIONS: RegionDef[] = [
  {
    key: "cervical",
    label: "경추 (Cervical)",
    movements: [
      { id: "cervical-flexion", en: "Flexion", ko: "굽힘" },
      { id: "cervical-extension", en: "Extension", ko: "폄" },
      { id: "cervical-protrusion", en: "Protraction", ko: "전인" },
      { id: "cervical-retraction", en: "Retraction", ko: "후인" },
      { id: "cervical-rotation-r", en: "Rotation (R)", ko: "회전(우측)" },
      { id: "cervical-rotation-l", en: "Rotation (L)", ko: "회전(좌측)" },
      { id: "cervical-side-flexion-r", en: "Side flexion (R)", ko: "가쪽굽힘(우측)" },
      { id: "cervical-side-flexion-l", en: "Side flexion (L)", ko: "가쪽굽힘(좌측)" },
    ],
  },
  {
    key: "shoulder",
    label: "어깨 (Shoulder)",
    movements: [
      { id: "shoulder-flexion", en: "Flexion", ko: "굽힘" },
      { id: "shoulder-extension", en: "Extension", ko: "폄" },
      { id: "shoulder-abduction", en: "Abduction", ko: "벌림" },
      { id: "shoulder-horizontal-adduction", en: "Horizontal / Adduction", ko: "수평 모음" },
      { id: "shoulder-external-rotation", en: "External rotation", ko: "외회전" },
      { id: "shoulder-internal-rotation", en: "Internal rotation", ko: "내회전" },
      { id: "shoulder-flex-ab-er", en: "Flex. & Ab. & ER.", ko: "굽힘 & 벌림 & 외회전(머리 뒤 손)" },
      { id: "shoulder-ext-ad-ir", en: "Ext. & Ad. & IR.", ko: "폄 & 모음 & 내회전(허리 뒤 손)" },
      { id: "shoulder-grip-strength", en: "Grip Strength", ko: "악력" },
    ],
  },
  {
    key: "lumbar",
    label: "요추 (Lumbar)",
    movements: [
      { id: "lumbar-flexion", en: "Flexion", ko: "굽힘" },
      { id: "lumbar-extension", en: "Extension", ko: "폄" },
      { id: "lumbar-side-glide-r", en: "Side glide (R)", ko: "측면 글라이딩(우측)" },
      { id: "lumbar-side-glide-l", en: "Side glide (L)", ko: "측면 글라이딩(좌측)" },
      { id: "lumbar-rotation-r", en: "Rotation (R)", ko: "회전(우측)" },
      { id: "lumbar-rotation-l", en: "Rotation (L)", ko: "회전(좌측)" },
      { id: "lumbar-single-leg-stance-r", en: "Single leg stance (R)", ko: "한 발 서기(우측)" },
      { id: "lumbar-single-leg-stance-l", en: "Single leg stance (L)", ko: "한 발 서기(좌측)" },
    ],
  },
  {
    key: "hip",
    label: "고관절 (Hip)",
    movements: [
      { id: "hip-flexion-slr", en: "Flexion [SLR]", ko: "굽힘(하지직거상)" },
      { id: "hip-extension", en: "Extension", ko: "폄" },
      { id: "hip-external-rotation", en: "External rotation", ko: "외회전" },
      { id: "hip-internal-rotation", en: "Internal rotation", ko: "내회전" },
      { id: "hip-abduction", en: "Abduction", ko: "벌림" },
      { id: "hip-adduction", en: "Adduction", ko: "모음" },
      { id: "hip-flex-ad-ir", en: "Flex. & Ad. & IR.", ko: "굽힘 & 모음 & 내회전(안짱다리)" },
      { id: "hip-ext-ab-er", en: "Ext. & Ab. & ER.", ko: "폄 & 벌림 & 외회전(아빠다리)" },
    ],
  },
  {
    key: "thoracic",
    label: "흉추 (Thoracic)",
    movements: [
      { id: "thoracic-flexion", en: "Flexion", ko: "굽힘" },
      { id: "thoracic-extension", en: "Extension", ko: "폄" },
      { id: "thoracic-rotation-r", en: "Rotation (R)", ko: "회전(우측)" },
      { id: "thoracic-rotation-l", en: "Rotation (L)", ko: "회전(좌측)" },
      { id: "thoracic-side-flexion-r", en: "Side flexion (R)", ko: "가쪽굽힘(우측)" },
      { id: "thoracic-side-flexion-l", en: "Side flexion (L)", ko: "가쪽굽힘(좌측)" },
    ],
  },
  {
    key: "elbowForearm",
    label: "팔꿈치·전완 (Elbow & Forearm)",
    movements: [
      { id: "elbow-flexion", en: "Flexion", ko: "굽힘" },
      { id: "elbow-extension", en: "Extension", ko: "폄" },
      { id: "elbow-pronation", en: "Pronation", ko: "엎침" },
      { id: "elbow-supination", en: "Supination", ko: "뒤침" },
    ],
  },
  {
    key: "wrist",
    label: "손목 (Wrist)",
    movements: [
      { id: "wrist-flexion", en: "Flexion", ko: "굽힘" },
      { id: "wrist-extension", en: "Extension", ko: "젖힘" },
      { id: "wrist-radial-deviation", en: "Radial deviation", ko: "노쪽 치우침" },
      { id: "wrist-ulnar-deviation", en: "Ulnar deviation", ko: "자쪽 치우침" },
    ],
  },
  {
    key: "knee",
    label: "무릎 (Knee)",
    movements: [
      { id: "knee-flexion", en: "Flexion", ko: "굽힘" },
      { id: "knee-extension", en: "Extension", ko: "폄" },
      { id: "knee-internal-rotation", en: "Internal rotation", ko: "내회전(무릎 굴곡 시)" },
      { id: "knee-external-rotation", en: "External rotation", ko: "외회전(무릎 굴곡 시)" },
    ],
  },
  {
    key: "ankleFoot",
    label: "발목·발 (Ankle & Foot)",
    movements: [
      { id: "ankle-dorsiflexion", en: "Dorsiflexion", ko: "발등 굽힘" },
      { id: "ankle-plantarflexion", en: "Plantarflexion", ko: "발바닥 굽힘" },
      { id: "ankle-inversion", en: "Inversion", ko: "내번" },
      { id: "ankle-eversion", en: "Eversion", ko: "외번" },
    ],
  },
];

export const FUNCTIONAL_TESTS = [
  { key: "core", label: "코어 (플랭크 / 사이드 플랭크)" },
  { key: "squat", label: "스쿼트" },
  { key: "overheadSquat", label: "오버헤드 스쿼트" },
  { key: "pushup", label: "푸쉬업" },
  { key: "hipHinge", label: "힙힌지" },
] as const;

export type FunctionalTestKey = (typeof FUNCTIONAL_TESTS)[number]["key"];

export const MMT_STRENGTH_OPTIONS = ["0", "1", "2", "3", "4", "5"] as const;

export const NRS_PAIN_OPTIONS = Array.from({ length: 11 }, (_, i) => String(i));

export const MMT_STRENGTH_LABELS: Record<string, string> = {
  "0": "0 (수축 없음)",
  "1": "1 (미세 수축만 촉진)",
  "2": "2 (중력 제거 시 전 가동)",
  "3": "3 (중력 저항 전 가동)",
  "4": "4 (약한 저항 극복)",
  "5": "5 (정상)",
};

export function findMovementLabel(movementId: string): { region: string; ko: string; en: string } | null {
  for (const region of ASSESSMENT_REGIONS) {
    const movement = region.movements.find((m) => m.id === movementId);
    if (movement) {
      return { region: region.label, ko: movement.ko, en: movement.en };
    }
  }
  return null;
}

// "폄", "굽힘"처럼 여러 부위에서 똑같이 쓰이는 동작명이 있어서, 부위를 함께
// 표기한다("폄 (경추)" vs "폄 (흉추)"). regionLabel은 "경추 (Cervical)" 형태이므로
// 괄호 앞 한글 부위명만 잘라 쓴다.
export function shortRegionLabel(regionLabel: string): string {
  return regionLabel.split(" (")[0];
}

/** "폄 (경추)"처럼 부위를 함께 표기한 동작 라벨을 반환한다. */
export function movementLabelWithRegion(movementId: string): string {
  const found = findMovementLabel(movementId);
  if (!found) return movementId;
  return `${found.ko} (${shortRegionLabel(found.region)})`;
}
