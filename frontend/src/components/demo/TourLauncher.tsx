"use client";

// Guided spotlight tour, started only by ?tour=1. Invisible unless the tour is running.
import { Suspense, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCaseId } from "@/lib/case";
import { TOUR_STEPS } from "./steps";
import { TourOverlay } from "./TourOverlay";
import { tour, useTourState } from "./tourStore";

let autoStarted = false; // ?tour=1 fires once per page load, not again after Exit

function ExitChip({ index, total }: { index: number; total: number }) {
  return (
    <button
      type="button"
      onClick={() => tour.exit()}
      className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 px-2.5 py-1.5 text-sm text-gold transition hover:border-gold/70"
    >
      <span className="tabular whitespace-nowrap">
        Exit tour {index + 1}/{total}
      </span>
    </button>
  );
}

function TourRunner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const caseId = useCaseId();
  const { active, index } = useTourState();

  const step = TOUR_STEPS[Math.min(index, TOUR_STEPS.length - 1)];
  const targetCase = step.caseId ?? caseId;
  // Compare with the raw param so a URL without ?company is rewritten to an explicit one (and loses ?tour).
  const arrived = pathname === step.route && params.get("company") === targetCase;

  useEffect(() => {
    if (!autoStarted && params.get("tour") === "1") {
      autoStarted = true;
      tour.start(0);
    }
  }, [params]);

  // Navigate to the step's route and company, keeping other query params (minus ?tour).
  useEffect(() => {
    if (!active || arrived) return;
    const p = new URLSearchParams(params.toString());
    p.delete("tour");
    p.set("company", targetCase);
    router.push(`${step.route}?${p.toString()}`, { scroll: false });
  }, [active, arrived, params, router, step.route, targetCase]);

  const onNext = useCallback(() => {
    if (index >= TOUR_STEPS.length - 1) tour.exit();
    else tour.go(index + 1);
  }, [index]);
  const onBack = useCallback(() => {
    if (index > 0) tour.go(index - 1);
  }, [index]);
  const onExit = useCallback(() => tour.exit(), []);

  return (
    <>
      {active && <ExitChip index={index} total={TOUR_STEPS.length} />}
      {active &&
        createPortal(
          <TourOverlay
            step={step}
            index={index}
            total={TOUR_STEPS.length}
            arrived={arrived}
            onBack={onBack}
            onNext={onNext}
            onExit={onExit}
          />,
          document.body,
        )}
    </>
  );
}

export function TourLauncher() {
  return (
    <Suspense fallback={null}>
      <TourRunner />
    </Suspense>
  );
}
