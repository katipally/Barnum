"use client";

import { Suspense } from "react";
import { BreakdownView } from "@/components/brief/BreakdownView";

// "How we reach the goal": the goal as a plain equation, which part is behind, and what marketing works on.
export default function BreakdownPage() {
  return (
    <Suspense fallback={null}>
      <BreakdownView />
    </Suspense>
  );
}
