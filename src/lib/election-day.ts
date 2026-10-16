export type ElectionDayState = { kind: "before"; days: number } | { kind: "day" } | { kind: "after" };

export const RESULTS_URL = "https://www.sos.ca.gov/elections";

const pacificDay = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" });

export function pacificDate(now: Date): string {
  const part = Object.fromEntries(pacificDay.formatToParts(now).map((p) => [p.type, p.value]));
  return `${part.year}-${part.month}-${part.day}`;
}

export function electionDayState(electionDate: string, today: string): ElectionDayState {
  const days = Math.round((Date.parse(electionDate) - Date.parse(today)) / 86_400_000);
  if (days > 0) return { kind: "before", days };
  return days === 0 ? { kind: "day" } : { kind: "after" };
}

export const daysLeft = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;

export function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
