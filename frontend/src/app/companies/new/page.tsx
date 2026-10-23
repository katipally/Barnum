import type { Metadata } from "next";
import { CompanyForm } from "@/components/companies/CompanyForm";

export const metadata: Metadata = { title: "Add company · Agentic CMO" };

export default function NewCompanyPage() {
  return (
    <div className="mx-auto max-w-2xl pb-16">
      <header className="mb-10">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Add a company</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Tell me what you sell, what you want to achieve and how much I may spend. It takes about two minutes. Once your data is
          connected, I start planning.
        </p>
      </header>
      <CompanyForm />
    </div>
  );
}
