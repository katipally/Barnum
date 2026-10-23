"use client";

import { usePathname, useRouter } from "next/navigation";
import { TourLauncher } from "@/components/demo/TourLauncher";
import { AskButton } from "@/components/chat/AskButton";
import { howItWorks, useHowItWorksVisible } from "@/components/memo/howItWorksStore";
import { useCaseId, withCase } from "@/lib/case";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-end gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <HowItWorksLink />
        <TourLauncher />
        <AskButton />
      </div>
    </header>
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
      className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm text-muted transition hover:bg-surface-3 hover:text-ink"
    >
      How this works
    </button>
  );
}
