export const BUSINESS_START_HOUR = 9;
// exclusive — last bookable slot starts at BUSINESS_END_HOUR - 1
export const BUSINESS_END_HOUR = 22;
export const BOOKING_WINDOW_DAYS = 90;

export const PURPOSE_OPTIONS = [
  { value: "rehab", label: "재활" },
  { value: "posture", label: "체형교정" },
  { value: "diet", label: "다이어트" },
  { value: "strength", label: "근력 증진" },
  { value: "growth", label: "키성장" },
] as const;

export type PurposeValue = (typeof PURPOSE_OPTIONS)[number]["value"];

export const PURPOSE_LABELS: Record<string, string> = Object.fromEntries(
  PURPOSE_OPTIONS.map((option) => [option.value, option.label]),
);

export function businessHours(): number[] {
  const hours: number[] = [];
  for (let h = BUSINESS_START_HOUR; h < BUSINESS_END_HOUR; h++) hours.push(h);
  return hours;
}
