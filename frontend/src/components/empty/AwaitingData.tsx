import type { ReactNode } from "react";
import type { CompanyCase } from "@/lib/types";
import { ConnectData } from "./ConnectData";

// Compact empty state for views that need data: one sentence, optional context, then the sources to connect.
export function AwaitingData({
  stage,
  sentence,
  children,
}: {
  stage: CompanyCase["stage"];
  sentence: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <p className="max-w-[760px] text-[15px] text-ink/90">{sentence}</p>
      {children}
      <ConnectData stage={stage} className="max-w-[760px]" />
    </div>
  );
}
