"use client";

import { Suspense } from "react";
import { EvaluationView } from "@/components/evaluation/EvaluationView";

export default function EvaluationPage() {
  return (
    <Suspense>
      <EvaluationView />
    </Suspense>
  );
}
