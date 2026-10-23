"use client";

// The active company lives in the URL (?company=tessellate) so every view shares it and links are shareable.
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { CaseId } from "./types";

export const DEFAULT_COMPANY: CaseId = "tessellate";
export const LAST_COMPANY_KEY = "cmo.company"; // localStorage: last company the user opened

// Components using this must render inside a <Suspense> boundary (the root layout provides one).
export function useCaseId(): CaseId {
  return useSearchParams().get("company") || DEFAULT_COMPANY;
}

export function useSetCase() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (c: CaseId, href?: string) => {
    const p = new URLSearchParams(params.toString());
    p.set("company", c);
    try {
      localStorage.setItem(LAST_COMPANY_KEY, c);
    } catch {}
    router.push(`${href ?? pathname}?${p.toString()}`);
  };
}

// Build an in-app href that keeps the active company.
export function withCase(href: string, c: CaseId) {
  return `${href}${href.includes("?") ? "&" : "?"}company=${encodeURIComponent(c)}`;
}
