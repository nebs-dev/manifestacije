import { zagrebDateKey } from "../common/zagreb-time";

/**
 * Choosing which part of a long listing page the model actually reads.
 *
 * The extractor used to hand the model `text.slice(0, 24000)` and append
 * "[sadržaj skraćen]". On a page that fits, that is the whole page. On a long
 * one it is a blind prefix, and whether anything useful survived depended
 * entirely on how the site happened to order its own HTML. Measured on the two
 * sources named in the audit, read on 2026-11-13:
 *
 * - kulturni-centar.hr/dogadjanja/sva-dogadjanja — 91 796 chars of text, 67 796
 *   dropped. Harmless: the page is an archive sorted newest-first, and all 29
 *   upcoming dates sit in the first 3 237 chars. The dropped tail is last
 *   year's programme, which `dropPastCandidates` would discard anyway after
 *   paying a model call for it.
 * - osijek031.com/svi-dogadaji/ — 69 634 chars, 45 634 dropped, and *every one*
 *   of its 40 upcoming dates sat between chars 39 443 and 59 152. The page is a
 *   month calendar: filter chrome, then day 1 upward. On the 13th the 24 000
 *   char prefix holds nothing but the first third of a month that has already
 *   happened, so the source yielded no upcoming events at all.
 *
 * So the fix is not a bigger context window, it is reading the right part:
 * split the text on its own paragraph boundaries, score each window by the
 * dates in it, and spend the model calls on the windows that still have
 * something ahead of them.
 */

/** Characters of page text one model call is given. */
export const WINDOW_BUDGET = 24_000;

/** Model calls one listing page may cost. Three windows of the budget is
 *  72 000 chars — more than either page above needs — and bounds the worst
 *  case at three calls per check rather than one per window of an arbitrarily
 *  long page. */
export const MAX_WINDOWS = 3;

/** Page title and the like, repeated into later windows so a window that does
 *  not start at the top still says what site and city it came from. */
const HEADER_BUDGET = 300;

export type ListingWindow = {
  /** The text handed to one model call, header included. */
  text: string;
  /** Where this window's own content starts in the page text. */
  at: number;
  /** Distinct dates in it that have not passed. */
  upcoming: number;
  /** Distinct dates in it that have. */
  past: number;
};

export type WindowSelection = {
  /** The windows to parse, in page order. Never empty for non-empty text. */
  windows: ListingWindow[];
  /** How many windows the text came to in total. */
  total: number;
  /** Characters chosen that lie beyond the old prefix, i.e. what the previous
   *  single-slice read could not have seen. */
  recovered: number;
  reason:
    /** Short enough that the whole page is one window — the old behaviour. */
    | "fits"
    /** Long, and at least one window still has upcoming dates. */
    | "selected"
    /** Long, but no window has a date that can be read as upcoming; fall back
     *  to the prefix rather than guess, which is also the old behaviour. */
    | "no-dates";
};

const MONTHS: Record<string, number> = {
  sijecanj: 1, sijecnja: 1, veljaca: 2, veljace: 2, ozujak: 3, ozujka: 3,
  travanj: 4, travnja: 4, svibanj: 5, svibnja: 5, lipanj: 6, lipnja: 6,
  srpanj: 7, srpnja: 7, kolovoz: 8, kolovoza: 8, rujan: 9, rujna: 9,
  listopad: 10, listopada: 10, studeni: 11, studenog: 11, studenoga: 11,
  prosinac: 12, prosinca: 12,
};

const fold = (text: string) =>
  text.toLowerCase()
    .replace(/[čć]/g, "c").replace(/đ/g, "d").replace(/š/g, "s").replace(/ž/g, "z");

const ISO_DATE = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g;
const DOTTED = /\b(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{2,4})\b/g;
const SLASHED = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g;
const WRITTEN = new RegExp(`\\b(\\d{1,2})\\s*\\.?\\s*(${Object.keys(MONTHS).join("|")})\\s*,?\\s*(20\\d{2})\\b`, "g");

/**
 * Distinct calendar days a block of text states, counting only the ones that
 * name their year.
 *
 * `sourceDates` is the right reader for one candidate's own date evidence, and
 * the wrong one here: faced with a yearless "25.8." it assumes a year, and
 * assumes *next* year when this year's has already passed. That is correct for
 * a poster and ruinous for scoring an archive — it reported 101 "upcoming"
 * dates in a page of last season's programme, which would have bought three
 * model calls to re-read events `dropPastCandidates` then throws away. A date
 * with no year states nothing about whether it is ahead, so it is counted as
 * neither.
 */
export function statedDates(text: string): string[] {
  const folded = fold(text);
  const found = new Set<string>();
  const add = (y: number, m: number, d: number) => {
    const year = y < 100 ? (y < 70 ? 2000 + y : 1900 + y) : y;
    if (year < 2020 || year > 2035 || m < 1 || m > 12 || d < 1 || d > 31) return;
    const key = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    // Rejects 31 February and friends rather than counting a day that is not
    // a day.
    if (new Date(`${key}T12:00:00Z`).toISOString().slice(0, 10) !== key) return;
    found.add(key);
  };
  for (const m of folded.matchAll(ISO_DATE)) add(+m[1], +m[2], +m[3]);
  for (const m of folded.matchAll(DOTTED)) add(+m[3], +m[2], +m[1]);
  for (const m of folded.matchAll(SLASHED)) add(+m[3], +m[2], +m[1]);
  for (const m of folded.matchAll(WRITTEN)) add(+m[3], MONTHS[m[2]], +m[1]);
  return [...found].sort();
}

/** Paragraph blocks, with any single block too big for one window hard-split
 *  so packing can never be defeated by a page that emits no blank lines. */
function blocksOf(text: string, budget: number): { text: string; at: number }[] {
  const blocks: { text: string; at: number }[] = [];
  // Offsets come from walking the separators rather than from indexOf, which
  // on a page that repeats the same block hundreds of times (a long-running
  // exhibition listed under every day of the month) both costs more and can
  // land on the wrong copy.
  const separator = /\n{2,}/g;
  let cursor = 0;
  const push = (part: string, offset: number) => {
    if (!part.trim()) return;
    if (part.length <= budget) {
      blocks.push({ text: part, at: offset });
      return;
    }
    for (let i = 0; i < part.length; i += budget) {
      blocks.push({ text: part.slice(i, i + budget), at: offset + i });
    }
  };
  let match: RegExpExecArray | null;
  while ((match = separator.exec(text)) !== null) {
    push(text.slice(cursor, match.index), cursor);
    cursor = match.index + match[0].length;
  }
  push(text.slice(cursor), cursor);
  return blocks;
}

/** Consecutive blocks packed into windows of at most `budget` characters. */
function packed(blocks: { text: string; at: number }[], budget: number): { text: string; at: number }[] {
  const windows: { text: string; at: number }[] = [];
  let current = "";
  let at = 0;
  for (const block of blocks) {
    const addition = current ? `\n\n${block.text}` : block.text;
    if (current && current.length + addition.length > budget) {
      windows.push({ text: current, at });
      current = block.text;
      at = block.at;
      continue;
    }
    if (!current) at = block.at;
    current += addition;
  }
  if (current) windows.push({ text: current, at });
  return windows;
}

export function selectListingWindows(input: {
  text: string;
  budget?: number;
  maxWindows?: number;
  now?: Date;
}): WindowSelection {
  const budget = input.budget ?? WINDOW_BUDGET;
  const maxWindows = input.maxWindows ?? MAX_WINDOWS;
  const now = input.now ?? new Date();
  const today = zagrebDateKey(now);
  const text = input.text;

  if (!text.trim()) return { windows: [], total: 0, recovered: 0, reason: "fits" };

  // A page that fits is handed over whole, exactly as before. This is the
  // common case and it must cost nothing extra: one window, one model call,
  // no scoring, no header rewriting.
  if (text.length <= budget) {
    return {
      windows: [{ text, at: 0, upcoming: 0, past: 0 }],
      total: 1,
      recovered: 0,
      reason: "fits",
    };
  }

  const raw = packed(blocksOf(text, budget), budget);
  const scored = raw.map((window) => {
    const dates = statedDates(window.text);
    return {
      ...window,
      upcoming: dates.filter((date) => date >= today).length,
      past: dates.filter((date) => date < today).length,
    };
  });

  // A window that does not start at the top of the page opens with the page's
  // own first line, so the model still knows which site and city it is reading
  // — on a month calendar the only mention of either is in the page title.
  const header = text.slice(0, HEADER_BUDGET).split(/\n{2,}/)[0]?.trim() ?? "";
  const withHeader = (window: ListingWindow): ListingWindow =>
    window.at === 0 || !header ? window : { ...window, text: `${header}\n\n${window.text}` };

  const promising = scored.filter((window) => window.upcoming > 0);

  // Nothing datable anywhere: the scoring has no opinion, so do not let it
  // have one. Read the prefix, which is what the previous code did.
  if (promising.length === 0) {
    return {
      windows: [scored[0]],
      total: scored.length,
      recovered: 0,
      reason: "no-dates",
    };
  }

  // Most upcoming dates first, page order deciding ties, then back into page
  // order so the model reads the page the way the page is written.
  const chosen = [...promising]
    .sort((a, b) => b.upcoming - a.upcoming || a.at - b.at)
    .slice(0, maxWindows)
    .sort((a, b) => a.at - b.at)
    .map(withHeader);

  const recovered = chosen
    .filter((window) => window.at >= budget)
    .reduce((sum, window) => sum + window.text.length, 0);

  return { windows: chosen, total: scored.length, recovered, reason: "selected" };
}
