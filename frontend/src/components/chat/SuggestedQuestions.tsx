import { cx } from "@/components/ui";

export function SuggestedQuestions({
  questions,
  onPick,
  disabled,
  className,
}: {
  questions: string[];
  onPick: (q: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (questions.length === 0) return null;
  return (
    <div className={cx("flex flex-wrap gap-1.5", className)}>
      {questions.map((q) => (
        <button
          key={q}
          type="button"
          disabled={disabled}
          onClick={() => onPick(q)}
          className="rounded-full border border-line-strong px-2.5 py-1 text-left text-xs text-muted transition hover:border-ink/40 hover:text-ink disabled:opacity-50"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
