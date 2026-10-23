import { Fragment, type ReactNode } from "react";

// Minimal markdown for the agent's streamed text: headings, bullet and numbered lists, tables, paragraphs, **bold** and `code`.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**"))
      return (
        <strong key={i} className="font-medium text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.length > 2 && part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={i} className="break-words rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.85em] text-ink">
          {part.slice(1, -1)}
        </code>
      );
    return <Fragment key={i}>{part}</Fragment>;
  });
}

const HEADING = /^\s{0,3}#{1,6}\s+/;
const BULLET = /^\s*[-*•]\s+/;
const NUMBER = /^\s*(\d+)[.)]\s+/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^[\s|:-]+$/;
const cells = (row: string) => row.trim().slice(1, -1).split("|").map((c) => c.trim());

type Block =
  | { kind: "h"; text: string }
  | { kind: "ul" | "ol"; start: number; items: string[] }
  | { kind: "table"; rows: string[][] }
  | { kind: "p"; lines: string[] };

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  let open: Block | undefined; // the block the next line may extend
  for (const line of text.split("\n")) {
    const num = NUMBER.exec(line);
    if (!line.trim()) open = undefined;
    else if (HEADING.test(line)) {
      blocks.push({ kind: "h", text: line.replace(HEADING, "") });
      open = undefined;
    } else if (TABLE_ROW.test(line)) {
      if (TABLE_RULE.test(line)) continue;
      if (open && open.kind === "table") open.rows.push(cells(line));
      else blocks.push((open = { kind: "table", rows: [cells(line)] }));
    } else if (num || BULLET.test(line)) {
      const kind = num ? "ol" : "ul";
      const item = line.replace(num ? NUMBER : BULLET, "");
      if (open && open.kind === kind) open.items.push(item);
      else blocks.push((open = { kind, start: num ? Number(num[1]) : 1, items: [item] }));
    } else if (open && open.kind === "p") open.lines.push(line);
    else blocks.push((open = { kind: "p", lines: [line] }));
  }
  return blocks;
}

export function AgentText({ text }: { text: string }) {
  return (
    <div className="space-y-2.5 break-words">
      {parse(text).map((b, i) => {
        if (b.kind === "h")
          return (
            <h4 key={i} className="pt-1 font-medium text-ink">
              {inline(b.text)}
            </h4>
          );
        if (b.kind === "table") {
          const [head, ...body] = b.rows;
          return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {head.map((c, j) => (
                      <th key={j} className="border-b border-line px-2 py-1 text-left font-medium text-ink">
                        {inline(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((r, j) => (
                    <tr key={j}>
                      {r.map((c, k) => (
                        <td key={k} className="border-b border-line px-2 py-1 align-top">
                          {inline(c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (b.kind === "p") {
          const assumption = /^assumption\b/i.test(b.lines[0].trim());
          return (
            <p key={i} className={assumption ? "border-l border-line-strong pl-2.5 text-muted italic" : undefined}>
              {b.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {inline(l)}
                </Fragment>
              ))}
            </p>
          );
        }
        const List = b.kind;
        return (
          <List key={i} start={b.kind === "ol" ? b.start : undefined} className={b.kind === "ol" ? "space-y-1 pl-5" : "space-y-1 pl-4"}>
            {b.items.map((l, j) => (
              <li key={j} className={b.kind === "ol" ? "list-decimal marker:text-faint" : "list-disc marker:text-faint"}>
                {inline(l)}
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
