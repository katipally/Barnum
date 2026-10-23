"use client";

import { usePathname, useRouter } from "next/navigation";
import { TourLauncher } from "@/components/demo/TourLauncher";
import { AskButton } from "@/components/chat/AskButton";
import { howItWorks, useHowItWorksVisible } from "@/components/memo/howItWorksStore";
import { useCaseId, withCase } from "@/lib/case";
import { DataStatusDot, DATA_STATUS_LABEL } from "./CompanyMarks";
import { NAV_ITEMS, isActive } from "./navItems";
import { useCases } from "./useCases";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1320px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
        <Crumb />
        <div className="ml-auto flex items-center gap-2">
          <HowItWorksLink />
          <TourLauncher />
          <AskButton />
        </div>
      </div>
    </header>
  );
}

// Where you are: page name and whether the company runs on live or example data.
function Crumb() {
  const pathname = usePathname();
  const caseId = useCaseId();
  const current = useCases()?.find((c) => c.id === caseId);
  const page = NAV_ITEMS.find((n) => isActive(pathname, n.href))?.label;
  return (
    <div className="hidden min-w-0 items-center gap-3 sm:flex">
      {page && <span className="truncate text-sm text-ink">{page}</span>}
      {current && (
        <span className="chip">
          <DataStatusDot status={current.dataStatus} className="h-1.5 w-1.5" />
          {DATA_STATUS_LABEL[current.dataStatus]}
        </span>
      )}
    </div>
  );
}

// Brings back the dismissed explainer card on the home page.
function HowItWorksLink() {
  const pathname = usePathname();
  const router = useRouter();
  const caseId = useCaseId();
  const visible = useHowItWorksVisible();
  if (visible && pathname === "/") return null;
  return (
    <button
      type="button"
      onClick={() => {
        howItWorks.show();
        if (pathname !== "/") router.push(withCase("/", caseId));
        else window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="whitespace-nowrap rounded-lg border border-line bg-surface-2/60 px-3 py-1.5 text-sm text-muted transition hover:border-line-strong hover:text-ink"
    >
      How this works
    </button>
  );
}
