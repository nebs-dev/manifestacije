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

/** Candidate fields an editor can review field by field after a supplemental parse (EVT-08). */
export const PROPOSABLE_FIELDS = [
  "title", "description", "startsAt", "endsAt", "isAllDay", "occurrences", "venueName", "address",
  "city", "category", "isFree", "priceText", "ticketUrl", "organizerName",
] as const;

type Candidate = ParsedSourceResult["candidates"][number] & { _status?: string; _proposal?: Record<string, unknown>; _fromSupplement?: boolean };

function sameCandidate(a: Candidate, b: Candidate) {
  return normalizeDuplicateText(a.title) === normalizeDuplicateText(b.title)
    && ((a.startsAt === b.startsAt && normalizeDuplicateText(a.city) === normalizeDuplicateText(b.city)
      && normalizeDuplicateText(a.venueName) === normalizeDuplicateText(b.venueName))
      || !!matchDuplicate({ ...a, cityName: a.city }, { ...b, id: 0, slug: "", status: "PUBLISHED", city: undefined, cityName: b.city }));
}

const meaningful = (value: unknown) => value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0);

/**
 * Merge a fresh parse into an existing source without overwriting anything an
 * editor may have decided (EVT-08). Created and ignored candidates are kept
 * untouched (and consume their fresh match so they are not re-added); open
 * candidates keep their values and receive a `_proposal` with only the fields
 * the new parse would change; genuinely new events are appended as open
 * candidates marked `_fromSupplement`. With exactly one open candidate and one
 * unmatched fresh result they are treated as the same event, since a
 * supplement often supplies the very title or date that matching relies on.
 */
export function proposeFromFresh(previous: unknown, fresh: ParsedSourceResult): ParsedSourceResult {
  const old = previous as ParsedSourceResult | null;
  if (!Array.isArray(old?.candidates) || old.candidates.length === 0) return fresh;
  const remaining = [...fresh.candidates] as Candidate[];
  const paired = new Map<number, Candidate>();
  (old.candidates as Candidate[]).forEach((candidate, index) => {
    const at = remaining.findIndex((next) => sameCandidate(next, candidate));
    if (at >= 0) paired.set(index, remaining.splice(at, 1)[0]);
  });
  const openUnpaired = () => (old.candidates as Candidate[]).map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate, index }) => !paired.has(index) && candidate._status !== "created" && candidate._status !== "ignored");
  // Second pass: a supplement often adds the missing date or venue the strict
  // matcher needs, so a unique same-title result is the same event.
  for (const { candidate, index } of openUnpaired()) {
    const sameTitle = remaining.filter((next) => normalizeDuplicateText(next.title) === normalizeDuplicateText(candidate.title));
    if (sameTitle.length === 1) paired.set(index, remaining.splice(remaining.indexOf(sameTitle[0]), 1)[0]);
  }
  const unpaired = openUnpaired();
  if (unpaired.length === 1 && remaining.length === 1) paired.set(unpaired[0].index, remaining.splice(0, 1)[0]);

  const candidates = (old.candidates as Candidate[]).map((candidate, index) => {
    const next = paired.get(index);
    if (!next || candidate._status === "created" || candidate._status === "ignored") return candidate;
    const proposal: Record<string, unknown> = {};
    for (const field of PROPOSABLE_FIELDS) {
      const value = (next as Record<string, unknown>)[field];
      if (meaningful(value) && JSON.stringify(value) !== JSON.stringify((candidate as Record<string, unknown>)[field])) proposal[field] = value;
    }
    const { _proposal: _previous, ...kept } = candidate;
    return Object.keys(proposal).length ? { ...kept, _proposal: proposal } : kept;
  });
  return {
    ...old,
    ...fresh,
    candidates: [...candidates, ...remaining.map((candidate) => ({ ...candidate, _status: "pending", _fromSupplement: true }))] as ParsedSourceResult["candidates"],
  };
}
