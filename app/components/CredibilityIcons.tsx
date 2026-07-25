type IconProps = { className?: string };

const shared = {
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconCredential({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true">
      <circle cx="12" cy="9" r="6" />
      <path d="M9 9.5l2 2 4-4" />
      <path d="M8.5 14.5L7 21l5-2.5L17 21l-1.5-6.5" />
    </svg>
  );
}

export function IconPrescription({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1z" />
      <path d="M7.5 14h2l1.5-3 2 5 1.5-2h2" />
    </svg>
  );
}

export function IconProgress({ className }: IconProps) {
  return (
    <svg {...shared} className={className} aria-hidden="true">
      <path d="M4 19h16" />
      <path d="M4 15l4-4 3.5 3L18 6" />
      <path d="M13.5 6H18v4.5" />
    </svg>
  );
}
