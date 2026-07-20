/** Formats a Date for email body text, e.g. "18. srpnja 2026. u 20:00". */
export function formatHrDate(date: Date): string {
  const datePart = new Intl.DateTimeFormat("hr-HR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zagreb" }).format(date);
  const timePart = new Intl.DateTimeFormat("hr-HR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zagreb" }).format(date);
  return `${datePart} u ${timePart}`;
}
