"use client";

import { Suspense } from "react";
import { DeepDivesView } from "@/components/deepdives/DeepDivesView";

export default function DeepDivesPage() {
  return (
    <Suspense>
      <DeepDivesView />
    </Suspense>
  );
}
