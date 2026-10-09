import { zagrebDateKey } from "../common/zagreb-time";

const months: Record<string, number> = {
  sijecanj: 1, sijecnja: 1, veljaca: 2, veljace: 2, ozujak: 3, ozujka: 3,
  travanj: 4, travnja: 4, svibanj: 5, svibnja: 5, lipanj: 6, lipnja: 6,
  srpanj: 7, srpnja: 7, kolovoz: 8, kolovoza: 8, rujan: 9, rujna: 9,
  listopad: 10, listopada: 10, studeni: 11, studenog: 11, studenoga: 11,
  prosinac: 12, prosinca: 12,
};
const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const written = new RegExp(`\\b(\\d{1,2})\\.?\\s+(${Object.keys(months).join("|")})\\b(?:\\s+(20\\d{2})\\.?)?`, "gi");
const numeric = /\b(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(20\d{2})\.?)?/g;
const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/g;

export function sourceDates(text: string, now = new Date()): string[] {
  const normalized = fold(text);
  const year = zagrebDateKey(now).slice(0, 4);
  const dates: string[] = [];
  const add = (y: string, m: number, d: number) => {
    const key = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const date = new Date(`${key}T12:00:00Z`);
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key) dates.push(key);
  };
  for (const match of normalized.matchAll(iso)) add(match[1], +match[2], +match[3]);
  for (const match of normalized.matchAll(numeric)) add(match[3] || year, +match[2], +match[1]);
  for (const match of normalized.matchAll(written)) add(match[3] || year, months[match[2]], +match[1]);
  return [...new Set(dates)];
}

/** Mask complete dates before considering clock tokens, including 12.10.2026
 * and yearless 12.10. Dotted values without a final dot need time context when
 * they could also mean day/month (12.10). */
export function sourceTimes(text: string): string[] {
  const masked = fold(text).replace(iso, " ").replace(numeric, " ").replace(written, " ");
  const times: string[] = [];
  const pattern = /\b([01]?\d|2[0-3])(?:(:|\.)([0-5]\d)(\s*(?:h|sati|sat))?|\s*(h|sati|sat))\b/gi;
  for (const match of masked.matchAll(pattern)) {
    if (match[2] === "." && !match[4] && +match[1] <= 31 && +match[3] >= 1 && +match[3] <= 12) {
      const before = masked.slice(Math.max(0, match.index! - 15), match.index);
      const after = masked.slice(match.index! + match[0].length);
      if (!/(?:u|od|do|vrijeme\s*:)\s*$/.test(before) && !/^\s*(?:h|sat)/.test(after)) continue;
    }
    times.push(`${match[1].padStart(2, "0")}:${match[3] || "00"}`);
  }
  return [...new Set(times)];
}

/** Date-only listings and assumed years need attention even when required
 * fields are structurally present in the legacy candidate contract. */
export function candidateNeedsReview(candidate: { missingFields: string[]; warnings: string[] }): boolean {
  return candidate.missingFields.length > 0 || candidate.warnings.some((warning) => /vrijeme|datum|godin|raspored|termin|promjen.*sata/i.test(warning));
}
