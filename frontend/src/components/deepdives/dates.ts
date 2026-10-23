export function shortDate(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? `today, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
