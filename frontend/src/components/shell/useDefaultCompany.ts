"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_COMPANY, LAST_COMPANY_KEY } from "@/lib/case";
import type { CaseSummary } from "@/lib/types";
import { splitCases, useCasesState } from "./useCases";

function pickDefault(cases: CaseSummary[]): string {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(LAST_COMPANY_KEY);
  } catch {}
  if (stored && cases.some((c) => c.id === stored)) return stored;
  return splitCases(cases).own[0]?.id ?? DEFAULT_COMPANY;
}

/**
 * Fills in ?company when it is missing (last opened, else first own company, else the default sample) and
 * replaces an id that no longer exists. Returns false while the URL is about to change, so pages don't
 * load the wrong company first. The guided tour (?tour=1) picks its own companies.
 */
export function useDefaultCompany(): boolean {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { cases, error } = useCasesState();
  const [gaveUp, setGaveUp] = useState(false);

  const company = params.get("company");
  const touring = params.get("tour") === "1";
  const unknown = !!company && !!cases && !cases.some((c) => c.id === company);
  const needsRedirect = !touring && (!company || unknown);

  useEffect(() => {
    if (!needsRedirect) return;
    if (!cases) {
      if (error) setGaveUp(true); // list unavailable: fall back to the default company without redirecting
      return;
    }
    const p = new URLSearchParams(params.toString());
    p.set("company", pickDefault(cases));
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }, [needsRedirect, cases, error, params, pathname, router]);

  return !needsRedirect || gaveUp;
}
