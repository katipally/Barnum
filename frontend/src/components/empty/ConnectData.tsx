import type { CompanyCase } from "@/lib/types";
import { cx } from "@/components/ui";

interface Source {
  id: string;
  name: string;
  provides: string;
  connect: string;
}

const VIA_WAREHOUSE =
  "Your data team lands this source in Snowflake, usually with a managed connector, and adds it to the tables the agent reads. Nothing is connected from this screen.";

function sources(stage: CompanyCase["stage"]): Source[] {
  const behaviour: Source =
    stage === "enterprise"
      ? {
          id: "retail",
          name: "Retail scan data",
          provides: "What sells in stores, how many shops stock us, and our share of the shelf.",
          connect: VIA_WAREHOUSE,
        }
      : {
          id: "product",
          name: "Product analytics",
          provides:
            stage === "pre_pmf"
              ? "Who signs up, who starts using the product, and who keeps using it."
              : "Who signs up, who starts using the product, and who buys more.",
          connect: VIA_WAREHOUSE,
        };
  return [
    {
      id: "snowflake",
      name: "Snowflake",
      provides: "Your company's data store: what we spend, the deals in progress and the revenue they bring.",
      connect:
        "Your data team creates a read-only role and a semantic view over spend, pipeline and revenue, then sets the Snowflake account details for the agent. Every other source arrives through here.",
    },
    {
      id: "google-ads",
      name: "Google Ads",
      provides: "What we spend on Google ads, and the sign-ups and sales they bring.",
      connect: VIA_WAREHOUSE,
    },
    {
      id: "search-console",
      name: "Google Search Console",
      provides: "What people search for, and how often they find us.",
      connect: VIA_WAREHOUSE,
    },
    {
      id: "crm",
      name: "CRM (HubSpot or Salesforce)",
      provides: "Your sales team's leads, deals in progress and deals won.",
      connect: VIA_WAREHOUSE,
    },
    behaviour,
  ];
}

// The data sources the agent works from, all honestly "not connected" until the data team wires them up.
export function ConnectData({ stage, className }: { stage: CompanyCase["stage"]; className?: string }) {
  return (
    <section className={cx("rounded-xl border border-line bg-surface", className)}>
      <header className="border-b border-line px-4 py-3">
        <h3 className="text-sm font-medium text-ink">Connect your data</h3>
        <p className="mt-1 text-sm text-muted">
          I start measuring as soon as one source is connected. Snowflake comes first, because everything else flows into it.
        </p>
      </header>
      <ul className="divide-y divide-line">
        {sources(stage).map((s) => (
          <SourceRow key={s.id} source={s} />
        ))}
      </ul>
      <p className="border-t border-line px-4 py-3 text-xs text-faint">
        Your data team sets these up in Snowflake; nothing is connected from this screen. The steps are in INTEGRATION.md.
      </p>
    </section>
  );
}

function SourceRow({ source: s }: { source: Source }) {
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm text-ink">{s.name}</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-faint">
          <span className="h-2 w-2 rounded-full border border-line-strong" aria-hidden />
          Not connected
        </span>
      </div>
      <p className="mt-0.5 text-sm text-muted">{s.provides}</p>
      <details className="group mt-1.5">
        <summary className="cursor-pointer list-none text-xs text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
          <span className="inline-block transition group-open:rotate-90">›</span> How to connect
        </summary>
        <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-faint">{s.connect}</p>
      </details>
    </li>
  );
}
