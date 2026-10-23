"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { forgetCase, refreshCases, splitCases, useCasesState } from "@/components/shell/useCases";
import { Button, Card, ErrorNote, SectionTitle, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { useCaseId, useSetCase, withCase } from "@/lib/case";
import type { CaseSummary } from "@/lib/types";
import { CompanyRow } from "./CompanyRow";
import { ConfirmDelete } from "./ConfirmDelete";
import { apiErrorMessage } from "./formModel";

// Manage companies: own companies (deletable) and the shipped samples.
export function CompanyList() {
  const { cases, error } = useCasesState();
  const caseId = useCaseId();
  const setCase = useSetCase();
  const [pending, setPending] = useState<CaseSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!pending) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await api.deleteCompany(pending.id);
      forgetCase(pending.id);
      setPending(null);
    } catch (e) {
      setDeleteError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!cases) {
    if (error)
      return (
        <div className="space-y-3">
          <ErrorNote message="Companies could not be loaded." />
          <Button type="button" onClick={() => refreshCases().catch(() => {})}>
            Try again
          </Button>
        </div>
      );
    return (
      <div className="space-y-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  const { own, samples } = splitCases(cases);
  const row = (c: CaseSummary) => (
    <CompanyRow
      key={c.id}
      company={c}
      current={c.id === caseId}
      onOpen={() => setCase(c.id, "/")}
      onDelete={
        c.sample
          ? undefined
          : () => {
              setDeleteError(null);
              setPending(c);
            }
      }
    />
  );

  return (
    <div className="space-y-8">
      <Group title="Your companies" hint={own.length ? `${own.length}` : undefined}>
        {own.length ? (
          <ul className="divide-y divide-line">{own.map(row)}</ul>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5">
            <p className="text-sm text-muted">No companies yet. Add yours and I&apos;ll plan against your own goal.</p>
            <Link href={withCase("/companies/new", caseId)} className="text-sm text-gold hover:underline">
              Add company
            </Link>
          </div>
        )}
      </Group>
      {samples.length > 0 && (
        <Group title="Sample companies" hint="Made-up examples to explore">
          <ul className="divide-y divide-line">{samples.map(row)}</ul>
        </Group>
      )}
      {pending && (
        <ConfirmDelete
          name={pending.name}
          busy={busy}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <SectionTitle hint={hint}>{title}</SectionTitle>
      <Card className="p-0">{children}</Card>
    </section>
  );
}
