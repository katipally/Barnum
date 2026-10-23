import type { DeepDiveArtifact } from "@/lib/types";
import { cx } from "@/components/ui";
import { shortDate } from "./dates";

const CONFIDENCE = { low: "Low confidence", medium: "Medium confidence", high: "High confidence" } as const;

// The write-up of a deep dive: what was challenged, what we concluded, and what the agent will build on.
export function ArtifactCard({ artifact, stale }: { artifact: DeepDiveArtifact; stale: boolean }) {
  return (
    <article className="rounded-xl border border-gold/30 bg-surface">
      <header className="border-b border-line px-5 py-4">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-medium tracking-wide text-gold">
          <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-gold" />
          Write-up
        </div>
        <p className="text-sm text-muted">{artifact.question}</p>
        <p className="mt-2 text-[17px] leading-relaxed text-ink">{artifact.answer}</p>
      </header>
      <div className="grid gap-6 px-5 py-4 md:grid-cols-2">
        {artifact.findings.length > 0 && (
          <section>
            <h3 className="mb-2 text-[13px] font-medium text-muted">What we found</h3>
            <ul className="space-y-1.5 pl-4 text-sm text-ink/90">
              {artifact.findings.map((f, i) => (
                <li key={i} className="list-disc marker:text-faint">
                  {f}
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="space-y-4">
          <div>
            <h3 className="mb-1.5 text-[13px] font-medium text-muted">What I recommend</h3>
            <p className="text-sm text-ink/90">{artifact.recommendation}</p>
          </div>
          {artifact.openQuestions.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[13px] font-medium text-muted">Still open</h3>
              <ul className="space-y-1 pl-4 text-sm text-ink/90">
                {artifact.openQuestions.map((q, i) => (
                  <li key={i} className="list-disc marker:text-faint">
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-5 py-3 text-xs text-faint">
        <span>{CONFIDENCE[artifact.confidence]}</span>
        <span>Written {shortDate(artifact.writtenAt)}</span>
        <span className={cx(stale && "text-warn")}>
          {stale ? "The conversation has moved on since this was written" : "I read this before answering, so later answers build on it"}
        </span>
      </footer>
    </article>
  );
}
