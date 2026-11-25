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

/** Club and festival posters in Osijek are often typeset in English
 *  ("THURSDAY | 12/NOV/2026"). The model reads them fine; it was this gate,
 *  knowing only Croatian months, that threw the date away. */
const englishMonths: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sept: 9, sep: 9, october: 10, oct: 10,
  november: 11, nov: 11, december: 12, dec: 12,
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

/** Longest first, so "sept" is not consumed as "sep" and "march" as "mar". */
const englishNames = Object.keys(englishMonths).sort((a, b) => b.length - a.length).join("|");
/** An alphabetic month makes the order unambiguous, so both are accepted:
 *  "12/NOV/2026" and "NOV/12/2026" mean the same day. A bare month word with
 *  no day next to it stays unread — "march of the penguins" is not a date. */
const englishDayFirst = new RegExp(`\\b(\\d{1,2})\\s*[/\\s-]\\s*(${englishNames})\\b(?:\\s*[/\\s,-]\\s*(20\\d{2}))?`, "gi");
const englishMonthFirst = new RegExp(`\\b(${englishNames})\\s*[/\\s-]\\s*(\\d{1,2})\\b(?:\\s*[/\\s,-]\\s*(20\\d{2}))?`, "gi");

/** "start 5 pm", "doors 5PM", "11.30pm", "8 a.m." — the 24-hour pattern below
 *  reads none of these, and would misread "11.30pm" as 11:30. */
const meridiem = /\b(1[0-2]|0?[1-9])(?:[:.]([0-5]\d))?\s*([ap])\.?\s?m\.?(?![a-z])/gi;

const datePatterns = [iso, numericSpan, numericRange, numeric, slashed, dashed, writtenRange, written, writtenShort, englishDayFirst, englishMonthFirst];

/** How far back a yearless date may fall before it is read as next year's.
 *  A poster printed in December announcing "5. siječnja" means the January
 *  a few weeks ahead, not the one eleven months gone — that one would be
 *  dropped as a past event and the listing would disappear silently. Six
 *  months keeps every ordinary "last month" reading in the current year. */
const ROLLOVER_MONTHS = 6;

function assumedYear(currentYear: string, month: number, day: number, now: Date): string {
  const candidate = `${currentYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const today = zagrebDateKey(now);
  if (candidate >= today) return currentYear;
  const cutoff = new Date(`${today}T12:00:00Z`);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - ROLLOVER_MONTHS);
  return candidate >= cutoff.toISOString().slice(0, 10) ? currentYear : String(+currentYear + 1);
}

export function sourceDates(text: string, now = new Date()): string[] {
  const normalized = fold(text);
  const year = zagrebDateKey(now).slice(0, 4);
  // A day written without a year is only assumed to fall in the current one;
  // the same day dated elsewhere in the text wins over that assumption.
  const dated = new Set<string>();
  const assumed = new Set<string>();
  const add = (y: string | undefined, m: number, d: number) => {
    if (!m || !d) return;
    const key = `${y || assumedYear(year, m, d, now)}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
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
  for (const match of normalized.matchAll(englishDayFirst)) add(match[3], englishMonths[match[2]], +match[1]);
  for (const match of normalized.matchAll(englishMonthFirst)) add(match[3], englishMonths[match[1]], +match[2]);
  const dayMonths = new Set([...dated].map((key) => key.slice(5)));
  for (const key of assumed) if (!dayMonths.has(key.slice(5))) dated.add(key);
  return [...dated].sort();
}

/** Mask complete dates before considering clock tokens, including 12.10.2026
 * and yearless 12.10. Dotted values without a final dot need time context when
 * they could also mean day/month (12.10). */
export function sourceTimes(text: string): string[] {
  const dateless = datePatterns.reduce((value, pattern) => value.replace(pattern, " "), fold(text));
  const times: string[] = [];
  // 12-hour clocks resolve first, then drop out of the text: left in place,
  // "11.30pm" would also match the 24-hour pattern and add a wrong 11:30.
  for (const match of dateless.matchAll(meridiem)) {
    const hour = +match[1] % 12 + (match[3].toLowerCase() === "p" ? 12 : 0);
    times.push(`${String(hour).padStart(2, "0")}:${match[2] || "00"}`);
  }
  const masked = dateless.replace(meridiem, " ");
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

/** "17:30 – 19:00" states a start and an end; "20:00 ili 21:00" states two
 *  candidate starts. Only the first kind lets the opening time be taken
 *  without asking the model which one it meant. */
export function isTimeRange(text: string): boolean {
  return new RegExp(`\\d\\s*(?::|\\.)?\\s*\\d*\\s*${DASH}\\s*\\d`).test(fold(text));
}

/** Date-only listings and assumed years need attention even when required
 * fields are structurally present in the legacy candidate contract. */
export function candidateNeedsReview(candidate: { missingFields: string[]; warnings: string[] }): boolean {
  return candidate.missingFields.length > 0 || candidate.warnings.some((warning) => /vrijeme|datum|godin|raspored|termin|promjen.*sata/i.test(warning));
}
