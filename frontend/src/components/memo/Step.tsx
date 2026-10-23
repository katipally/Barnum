import type { ReactNode } from "react";

export function Step({
  n,
  title,
  subtitle,
  tour,
  children,
}: {
  n: number;
  title: string;
  subtitle?: string;
  tour: string;
  children: ReactNode;
}) {
  return (
    <section data-tour={tour} className="mt-12">
      <h2 className="flex items-baseline gap-3 text-lg font-medium text-ink">
        <span className="tabular text-sm text-faint">{n}</span>
        {title}
      </h2>
      {subtitle && <p className="mt-1 pl-6 text-sm text-muted">{subtitle}</p>}
      <div className="mt-4 pl-6">{children}</div>
    </section>
  );
}
