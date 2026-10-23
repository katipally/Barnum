import type { ReactNode } from "react";
import type { CompanyCase } from "@/lib/types";
import { Skeleton } from "@/components/ui";

// The page's one question, then the agent's one-sentence answer.
export function PageHeader({
  page,
  company,
  question,
  answer,
  note,
}: {
  page: string;
  company?: CompanyCase;
  question: string;
  answer?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <p className="text-xs tracking-wide text-gold">
        {page}
        {company && (
          <span>
            {" "}
            · {company.name} · {company.periodLabel}, week {company.week} of {company.weeksInPeriod}
          </span>
        )}
      </p>
      <h1 className="mt-3 text-[26px] font-medium leading-tight tracking-tight text-ink sm:text-[30px]">{question}</h1>
      {answer === undefined ? (
        <Skeleton className="mt-4 h-6 max-w-[560px]" />
      ) : (
        answer && <p className="mt-3 max-w-[760px] text-[17px] leading-relaxed text-ink/90">{answer}</p>
      )}
      {note && <p className="mt-1.5 text-sm text-muted">{note}</p>}
    </header>
  );
}

export function PageFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1180px] py-2">{children}</div>;
}
