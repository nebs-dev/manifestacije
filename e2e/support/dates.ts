/**
 * Dates for fixtures, always in the future and always in Europe/Zagreb.
 *
 * Two reasons this is not just `new Date()` arithmetic:
 *
 * 1. The ingestion pipeline drops candidates whose start is already past
 *    (`dropPastCandidates`), so a hardcoded date would turn the whole suite
 *    red on some later morning rather than at the commit that broke it.
 * 2. The AI parser validates the model's ISO value against the literal date
 *    quoted from the source (`sourceDates` in date-evidence.ts). A stub reply
 *    and the source text it claims to have read therefore have to agree
 *    exactly, which means both have to come from here.
 */

/** Genitive forms, which is how a Croatian poster writes a date. */
const MONTHS_GENITIVE = [
  "siječnja", "veljače", "ožujka", "travnja", "svibnja", "lipnja",
  "srpnja", "kolovoza", "rujna", "listopada", "studenoga", "prosinca",
];

export type FixtureDate = {
  /** `2026-12-11` — what the API stores and what a date input expects. */
  iso: string;
  /** `11. prosinca 2026.` — what a poster says and what the parser must quote. */
  croatian: string;
  day: number;
  month: number;
  year: number;
};

/** Today in Europe/Zagreb as `YYYY-MM-DD`, independent of the machine's zone. */
export function zagrebToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zagreb",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function futureDate(offsetDays = 30, now = new Date()): FixtureDate {
  const [year, month, day] = zagrebToday(now).split("-").map(Number) as [number, number, number];
  // Midday UTC keeps the arithmetic clear of both DST edges.
  const shifted = new Date(Date.UTC(year, month - 1, day, 12) + offsetDays * 86_400_000);
  const iso = shifted.toISOString().slice(0, 10);
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return { iso, croatian: `${d}. ${MONTHS_GENITIVE[m - 1]} ${y}.`, day: d, month: m, year: y };
}

/** `2026-12-11T19:00:00` — the local, offset-free form the parser emits. */
export function localIso(date: FixtureDate, time: string): string {
  return `${date.iso}T${time}:00`;
}

/**
 * The Zagreb calendar day of an instant the API returned.
 *
 * The API stores UTC, so an all-day event on 14 December comes back as
 * `2026-12-13T23:00:00.000Z` — correct, and one day off if compared as a
 * string. Any assertion about "which day is this event on" has to go through
 * here, which is also the bug class it guards: an off-by-one moves the event
 * in every listing.
 */
export function zagrebDayOf(instant: string): string {
  return zagrebToday(new Date(instant));
}
