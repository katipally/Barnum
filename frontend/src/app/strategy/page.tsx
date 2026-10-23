"use client";

import { Suspense } from "react";
import { StrategyView } from "@/components/strategy/StrategyView";

export default function StrategyPage() {
  return (
    <Suspense>
      <StrategyView />
    </Suspense>
  );
}
