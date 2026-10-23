"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { rememberCase } from "@/components/shell/useCases";
import { Button, ErrorNote } from "@/components/ui";
import { api } from "@/lib/api";
import { LAST_COMPANY_KEY, useCaseId, withCase } from "@/lib/case";
import { BudgetSection, CompanySection, GoalSection } from "./CompanySections";
import { apiErrorMessage, toInput } from "./formModel";
import { useCompanyForm } from "./useCompanyForm";

// Onboarding: one calm column in three sections; on success opens the new company's week.
export function CompanyForm() {
  const f = useCompanyForm();
  const router = useRouter();
  const caseId = useCaseId();
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !f.attempt()) return;
    setBusy(true);
    setServerError(null);
    try {
      const created = await api.createCompany(toInput(f.values));
      rememberCase(created);
      try {
        localStorage.setItem(LAST_COMPANY_KEY, created.id);
      } catch {}
      router.push(`/?company=${encodeURIComponent(created.id)}`);
    } catch (err) {
      setServerError(apiErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-8">
      <CompanySection f={f} />
      <GoalSection f={f} />
      <BudgetSection f={f} />
      <div className="space-y-3 border-t border-line pt-6 sm:pl-9">
        {serverError && <ErrorNote message={serverError} />}
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Creating…" : "Create company"}
          </Button>
          <Link href={withCase("/companies", caseId)} className="rounded-md px-3 py-1.5 text-sm text-muted transition hover:bg-surface-3 hover:text-ink">
            Cancel
          </Link>
        </div>
        <p className="text-xs text-faint">You can change the goal, budget and limits any time under Goals and limits.</p>
      </div>
    </form>
  );
}
