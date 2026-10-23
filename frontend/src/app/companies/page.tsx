"use client";

import Link from "next/link";
import { CompanyList } from "@/components/companies/CompanyList";
import { useCaseId, withCase } from "@/lib/case";

export default function CompaniesPage() {
  const caseId = useCaseId();
  return (
    <div className="mx-auto max-w-4xl pb-16">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Companies</h1>
          <p className="mt-1.5 text-sm text-muted">
            Each company has its own goal, budget and plan. Open one to see its week, or add your own.
          </p>
        </div>
        <Link
          href={withCase("/companies/new", caseId)}
          className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-sm font-medium text-bg transition hover:bg-gold/90"
        >
          Add company
        </Link>
      </header>
      <CompanyList />
    </div>
  );
}
