import { EventStatus } from "@prisma/client";
import { ParsedSourceResult } from "./ai-event-parser.service";
import { PrismaService } from "../prisma/prisma.service";
import { DuplicatesService } from "../duplicates/duplicates.service";

const DAY_MS = 24 * 60 * 60 * 1000;
// How alike two titles must read before a candidate is flagged as already
// imported. Set high on purpose: the flag is only a warning, but a wrong one
// invites the admin to skip a genuinely new event, while a missed one just
// means a duplicate the Duplicates screen already catches.
const ALREADY_IMPORTED_TITLE_SIMILARITY = 0.8;

/** Nobody reviewing parsed candidates wants events that already happened —
 *  drop anything clearly over. Uses endsAt when present so a still-running
 *  multi-day event (started in the past, not yet finished) is kept;
 *  candidates with no parseable date at all are kept too since there's
 *  nothing to judge them against. */
export function dropPastCandidates(parsed: ParsedSourceResult): ParsedSourceResult {
  const now = Date.now();
  const candidates = parsed.candidates.filter((c) => {
    const relevantDate = c.endsAt || c.startsAt;
    if (!relevantDate) return true;
    const t = new Date(relevantDate).getTime();
    return Number.isNaN(t) || t >= now;
  });
  return { ...parsed, candidates };
}

/**
 * Marks candidates that look like an event we already published.
 *
 * Advisory only — nothing downstream reads the flag, and `_status` is left
 * untouched so every candidate stays importable. The matching is
 * deliberately strict (same calendar day, near-identical title, same city
 * when both are known): the expensive mistake is claiming something is a
 * duplicate when it is not, because that invites the admin to skip a real
 * new event. Anything uncertain is left unflagged and simply looks new.
 */
export async function flagAlreadyImported(
  prisma: PrismaService,
  duplicates: DuplicatesService,
  parsed: ParsedSourceResult
): Promise<ParsedSourceResult> {
  const dated = parsed.candidates
    .map((candidate, index) => ({ index, at: new Date(candidate.startsAt) }))
    .filter((entry) => !Number.isNaN(entry.at.getTime()));
  if (dated.length === 0) return parsed;

  const times = dated.map((entry) => entry.at.getTime());
  const existing = await prisma.event.findMany({
    where: {
      startsAt: {
        gte: new Date(Math.min(...times) - DAY_MS),
        lte: new Date(Math.max(...times) + DAY_MS),
      },
      // A rejected or archived event is not a reason to wave the admin off
      // this candidate — they turned that one down, so the listing offering
      // it again is a decision to make afresh, not a duplicate to skip.
      status: { notIn: [EventStatus.REJECTED, EventStatus.ARCHIVED] },
    },
    select: { id: true, title: true, startsAt: true, cityName: true },
  });
  if (existing.length === 0) return parsed;

  const candidates = [...parsed.candidates];
  for (const { index, at } of dated) {
    const candidate = candidates[index];
    const match = existing.find((event) =>
      sameCalendarDay(event.startsAt, at)
      && sameCityWhenKnown(event.cityName, candidate.city)
      && duplicates.titleSimilarity(event.title, candidate.title) >= ALREADY_IMPORTED_TITLE_SIMILARITY);
    if (match) candidates[index] = { ...candidate, _existingEventId: match.id };
  }

  return { ...parsed, candidates };
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** An unknown city on either side is not evidence of a different event, so
 *  it must not veto an otherwise convincing match. */
function sameCityWhenKnown(a: string | null, b: string): boolean {
  const left = a?.trim().toLowerCase();
  const right = b?.trim().toLowerCase();
  if (!left || !right) return true;
  return left === right;
}
