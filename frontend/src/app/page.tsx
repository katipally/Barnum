"use client";

import { Suspense } from "react";
import { MemoView } from "@/components/memo/MemoView";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <MemoView />
    </Suspense>
  );
}
