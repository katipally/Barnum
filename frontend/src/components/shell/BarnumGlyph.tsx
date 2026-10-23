// Barnum's mark: a "B" whose lower bowl outgrows the upper one, with a spark for the agent. Draws in currentColor.
export function BarnumGlyph({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        d="M5.5 3.8h5.6a3.6 3.6 0 0 1 0 7.2H5.5ZM5.5 11h6.9a4.6 4.6 0 0 1 0 9.2H5.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M19 2.2 19.75 4.25 21.8 5 19.75 5.75 19 7.8 18.25 5.75 16.2 5 18.25 4.25Z" fill="currentColor" />
    </svg>
  );
}
