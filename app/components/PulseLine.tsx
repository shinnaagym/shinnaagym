export function PulseLine({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 620 100"
      fill="none"
      className={className}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        className="pulse-path"
        d="M0 60
           L60 60
           L75 30 L90 82 L105 44 L120 60
           L170 60
           L185 42 L200 70 L215 50 L230 60
           L300 60
           Q 360 60 400 46
           Q 460 28 520 20
           Q 570 14 620 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
