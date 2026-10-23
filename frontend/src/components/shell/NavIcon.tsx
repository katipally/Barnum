// 16px line icons for the main nav, one per route.
const PATHS: Record<string, React.ReactNode> = {
  "/": (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="3" />
      <path d="M6 2.5v11" />
    </>
  ),
  "/breakdown": (
    <>
      <circle cx="8" cy="3.5" r="1.5" />
      <circle cx="3.5" cy="12.5" r="1.5" />
      <circle cx="12.5" cy="12.5" r="1.5" />
      <path d="M8 5v3M8 8H3.5v3M8 8h4.5v3" />
    </>
  ),
  "/strategy": (
    <>
      <path d="M2.5 13.5h11" />
      <rect x="3.5" y="8" width="2" height="4" rx=".5" />
      <rect x="7" y="5" width="2" height="7" rx=".5" />
      <rect x="10.5" y="2.5" width="2" height="9.5" rx=".5" />
    </>
  ),
  "/evaluation": <path d="M2 11.5 5.5 7l3 2.5L14 3.5M10.5 3.5H14V7" />,
  "/goals": (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="2.5" />
      <circle cx="8" cy="8" r=".6" fill="currentColor" />
    </>
  ),
  "/deep-dives": (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </>
  ),
  "/sources": (
    <>
      <ellipse cx="8" cy="4" rx="5" ry="1.8" />
      <path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8" />
    </>
  ),
};

export function NavIcon({ href, className }: { href: string; className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {PATHS[href] ?? <circle cx="8" cy="8" r="5" />}
    </svg>
  );
}
