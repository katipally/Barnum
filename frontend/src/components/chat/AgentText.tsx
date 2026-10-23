import { Fragment, type ReactNode } from "react";

// Minimal renderer for the agent's streamed text: paragraphs, "- " lists and **bold**.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-medium text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/;

export function AgentText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  return (
    <div className="space-y-2.5">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (lines.length > 0 && lines.every((l) => LIST_ITEM.test(l))) {
          return (
            <ul key={i} className="space-y-1 pl-4">
              {lines.map((l, j) => (
                <li key={j} className="list-disc marker:text-faint">
                  {inline(l.replace(LIST_ITEM, ""))}
                </li>
              ))}
            </ul>
          );
        }
        const assumption = /^assumption\b/i.test(block.trim());
        return (
          <p key={i} className={assumption ? "border-l border-line-strong pl-2.5 text-muted italic" : undefined}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
