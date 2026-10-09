import { EventStatus } from "@prisma/client";
import { ParsedSourceResult } from "./ai-event-parser.service";
import { PrismaService } from "../prisma/prisma.service";
import { DuplicatesService } from "../duplicates/duplicates.service";

import { duplicateSlots, matchDuplicate, normalizeDuplicateText } from "../duplicates/duplicate-matching";
import { zagrebDateKey } from "../common/zagreb-time";

/** Nobody reviewing parsed candidates wants events that already happened —
 *  drop anything clearly over. Uses endsAt when present so a still-running
 *  multi-day event (started in the past, not yet finished) is kept;
 *  candidates with no parseable date at all are kept too since there's
 *  nothing to judge them against. */
export function dropPastCandidates(parsed: ParsedSourceResult): ParsedSourceResult {
  const now = Date.now();
  const candidates = parsed.candidates.filter((c) => {
    const relevantDate = c.occurrences?.reduce<string | undefined>((latest, occurrence) => {
      const endpoint = occurrence.endsAt || occurrence.startsAt;
      return !latest || new Date(endpoint) > new Date(latest) ? endpoint : latest;
    }, undefined) || c.endsAt || c.startsAt;
    if (!relevantDate) return true;
    const t = new Date(relevantDate).getTime();
    if (c.isAllDay && Number.isFinite(t)) return zagrebDateKey(new Date(t)) >= zagrebDateKey(new Date(now));
    return Number.isNaN(t) || t >= now;
  });
  return { ...parsed, candidates };
}

/** Shared deterministic matching for public already-imported hints. Existing
 * manual decisions/metadata are retained; only pending computed hints refresh. */
export async function flagAlreadyImported(prisma: PrismaService, _duplicates: DuplicatesService, parsed: ParsedSourceResult): Promise<ParsedSourceResult> {
  const inputs = parsed.candidates.map(candidate => ({ ...candidate, cityName: candidate.city }));
  const slots = inputs.flatMap(duplicateSlots);
  if (!slots.length) return parsed;
  const existing = await prisma.event.findMany({ where: {
    OR: [{ status: EventStatus.PUBLISHED }, { status: EventStatus.ARCHIVED, publishedAt: { not: null } }],
    AND: [{ OR: [
      { startsAt: { lte: new Date(Math.max(...slots.map(row => row.end.getTime())) + 86400000) },
        OR: [{ endsAt: { gte: new Date(Math.min(...slots.map(row => row.start.getTime())) - 86400000) } }, { startsAt: { gte: new Date(Math.min(...slots.map(row => row.start.getTime())) - 86400000) } }] },
      { occurrences: { some: { startsAt: { gte: new Date(Math.min(...slots.map(row => row.start.getTime())) - 86400000), lte: new Date(Math.max(...slots.map(row => row.end.getTime())) + 86400000) } } } },
    ] }],
  }, include: { venue: true, city: true, occurrences: true } });
  return { ...parsed, candidates: parsed.candidates.map((candidate, index) => {
    if (candidate._status === "created" || candidate._status === "ignored") return candidate;
    const { _existingEventId: _oldHint, ...rest } = candidate;
    const match = existing.map(event => ({ event, match: matchDuplicate(inputs[index], event) }))
      .filter(row => row.match).sort((a, b) => b.match!.score - a.match!.score || a.event.id - b.event.id)[0];
    return match ? { ...rest, _existingEventId: match.event.id } : rest;
  }) };
}

/** Retain reviewed candidates and their indexes so reparsing cannot reopen a
 * created/ignored item or make an open review card import a different item. */
export function retainCandidateDecisions(previous: unknown, fresh: ParsedSourceResult): ParsedSourceResult {
  const old = previous as ParsedSourceResult | null;
  if (!Array.isArray(old?.candidates)) return fresh;
  const remaining = [...fresh.candidates];
  const candidates = old.candidates.map(candidate => {
    const index = remaining.findIndex(next => normalizeDuplicateText(next.title) === normalizeDuplicateText(candidate.title)
      && ((next.startsAt === candidate.startsAt
        && normalizeDuplicateText(next.city) === normalizeDuplicateText(candidate.city)
        && normalizeDuplicateText(next.venueName) === normalizeDuplicateText(candidate.venueName)) || !!matchDuplicate({ ...next, cityName: next.city }, {
        ...candidate, id: 0, slug: "", status: "PUBLISHED", city: undefined, cityName: candidate.city,
      })));
    const replacement = index >= 0 ? remaining.splice(index, 1)[0] : null;
    if (candidate._status === "created" || candidate._status === "ignored" || !replacement) return candidate;
    return { ...candidate, ...replacement, _status: candidate._status };
  });
  return { ...old, ...fresh, candidates: [...candidates, ...remaining] };
}
