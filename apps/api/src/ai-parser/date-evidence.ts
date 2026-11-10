import { zagrebDateKey } from "../common/zagreb-time";

const months: Record<string, number> = {
  sijecanj: 1, sijecnja: 1, veljaca: 2, veljace: 2, ozujak: 3, ozujka: 3,
  travanj: 4, travnja: 4, svibanj: 5, svibnja: 5, lipanj: 6, lipnja: 6,
  srpanj: 7, srpnja: 7, kolovoz: 8, kolovoza: 8, rujan: 9, rujna: 9,
  listopad: 10, listopada: 10, studeni: 11, studenog: 11, studenoga: 11,
  prosinac: 12, prosinca: 12,
};

/** Poster shorthand ("13. stu 2026."). Several of these are also ordinary
 *  words (`svi`, `tra`, `lis`), so a trailing dot or a year is required. */
const shortMonths: Record<string, number> = {
  sij: 1, velj: 2, ozu: 3, tra: 4, svi: 5, lip: 6,
  srp: 7, kol: 8, ruj: 9, lis: 10, stu: 11, pro: 12,
};

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const monthNames = Object.keys(months).join("|");
const shortNames = Object.keys(shortMonths).join("|");
const DASH = "[-–—]";

const written = new RegExp(`\\b(\\d{1,2})\\.?\\s+(${monthNames})\\b(?:\\s+(20\\d{2})\\.?)?`, "gi");
const writtenShort = new RegExp(`\\b(\\d{1,2})\\.?\\s*(${shortNames})(?:\\.(?:\\s*(20\\d{2})\\.?)?|\\s+(20\\d{2})\\.?)`, "gi");
const numeric = /\b(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(20\d{2})\.?)?/g;
const slashed = /\b(\d{1,2})[/](\d{1,2})(?:[/](20\d{2}))?\b/g;
const dashed = /\b(\d{1,2})-(\d{1,2})-(20\d{2})\b/g;
const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/g;

/** Ranges share one month: "13.–29. studenoga 2026.", "3.-4.7.2026." Without
 *  this the opening day carries no month of its own and looks unsupported. */
// The lookbehind keeps the day of an earlier full date ("12.10.-13.10.2026")
// from being read as the start of a range.
const writtenRange = new RegExp(`(?<![\\d.])(\\d{1,2})\\.?\\s*${DASH}\\s*(\\d{1,2})\\.?\\s+(${monthNames})\\b(?:\\s+(20\\d{2})\\.?)?`, "gi");
const numericRange = new RegExp(`(?<![\\d.])(\\d{1,2})\\.?\\s*${DASH}\\s*(\\d{1,2})\\.\\s*(\\d{1,2})\\.(?:\\s*(20\\d{2})\\.?)?`, "g");
/** "12.10.-13.10.2027." — the year at the end also dates the opening day. */
const numericSpan = new RegExp(`(?<![\\d.])(\\d{1,2})\\.\\s*(\\d{1,2})\\.\\s*${DASH}\\s*(\\d{1,2})\\.\\s*(\\d{1,2})\\.\\s*(20\\d{2})\\.?`, "g");

const datePatterns = [iso, numericSpan, numericRange, numeric, slashed, dashed, writtenRange, written, writtenShort];

export function sourceDates(text: string, now = new Date()): string[] {
  const normalized = fold(text);
  const year = zagrebDateKey(now).slice(0, 4);
  // A day written without a year is only assumed to fall in the current one;
  // the same day dated elsewhere in the text wins over that assumption.
  const dated = new Set<string>();
  const assumed = new Set<string>();
  const add = (y: string | undefined, m: number, d: number) => {
    if (!m || !d) return;
    const key = `${y || year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const date = new Date(`${key}T12:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== key) return;
    (y ? dated : assumed).add(key);
  };
  for (const match of normalized.matchAll(iso)) add(match[1], +match[2], +match[3]);
  for (const match of normalized.matchAll(numericSpan)) {
    add(match[5], +match[2], +match[1]);
    add(match[5], +match[4], +match[3]);
  }
  for (const match of normalized.matchAll(numericRange)) {
    add(match[4], +match[3], +match[1]);
    add(match[4], +match[3], +match[2]);
  }
  for (const match of normalized.matchAll(numeric)) add(match[3], +match[2], +match[1]);
  for (const match of normalized.matchAll(slashed)) add(match[3], +match[2], +match[1]);
  for (const match of normalized.matchAll(dashed)) add(match[3], +match[2], +match[1]);
  for (const match of normalized.matchAll(writtenRange)) {
    add(match[4], months[match[3]], +match[1]);
    add(match[4], months[match[3]], +match[2]);
  }
  for (const match of normalized.matchAll(written)) add(match[3], months[match[2]], +match[1]);
  for (const match of normalized.matchAll(writtenShort)) add(match[3] || match[4], shortMonths[match[2]], +match[1]);
  const dayMonths = new Set([...dated].map((key) => key.slice(5)));
  for (const key of assumed) if (!dayMonths.has(key.slice(5))) dated.add(key);
  return [...dated].sort();
}

/** Mask complete dates before considering clock tokens, including 12.10.2026
 * and yearless 12.10. Dotted values without a final dot need time context when
 * they could also mean day/month (12.10). */
export function sourceTimes(text: string): string[] {
  const masked = datePatterns.reduce((value, pattern) => value.replace(pattern, " "), fold(text));
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
