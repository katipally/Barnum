"use client";

import { Suspense } from "react";
import { SourcesView } from "@/components/sources/SourcesView";

export default function SourcesPage() {
  return (
    <Suspense>
      <SourcesView />
    </Suspense>
  );
}
