import type { MetricPoint } from "@/lib/types";

/** Weekly series starting at week 1. */
export const weeks = (...values: number[]): MetricPoint[] => values.map((value, i) => ({ week: i + 1, value }));
