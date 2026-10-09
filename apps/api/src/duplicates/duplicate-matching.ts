import { zagrebDateKey } from "../common/zagreb-time";

export type DuplicateInput = {
  title?: string; startsAt?: string | Date | null; endsAt?: string | Date | null; isAllDay?: boolean;
  occurrences?: { startsAt: string | Date; endsAt?: string | Date | null; isAllDay?: boolean }[];
  cityId?: number | null; cityName?: string | null; venueName?: string | null; address?: string | null;
  sourceUrl?: string | null; organizerId?: number | null; repeatWeeklyUntil?: string;
};
export type DuplicateRecord = DuplicateInput & {
  id: number; title: string; slug: string; status: string; publishedAt?: Date | null;
  venue?: { name: string; address?: string | null } | null; city?: { name: string } | null;
};
export function normalizeDuplicateText(value?: string | null) {
  return (value || "").toLocaleLowerCase("hr-HR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
const tokens = (value: string) => new Set(normalizeDuplicateText(value).split(/\s+/).filter(Boolean));
export function titleSimilarity(a: string, b: string) {
  const left = tokens(a), right = tokens(b);
  return [...left].filter(token => right.has(token)).length / Math.max(left.size, right.size, 1);
}
const generic = new Set("koncert koncerti vecer festival predstava radionica radionice kviz party live dj jazz rock glazba glazbeni glazbena nastup program sajam izlozba kino film ulaz besplatno u i na za od do the a an presents powered by".split(" "));
const instant = (value?: string | Date | null) => {
  if (!value || (typeof value === "string" && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value))) return null;
  const date = new Date(value); return Number.isFinite(date.getTime()) ? date : null;
};
export function duplicateSlots(input: DuplicateInput) {
  const slots = (input.occurrences?.length ? input.occurrences : [input]).flatMap(row => {
    const start = instant(row.startsAt), end = instant(row.endsAt);
    if (!start || (end && end < start)) return [];
    return [{ start, end: end ?? start, allDay: !!row.isAllDay }];
  });
  // Mirrors the existing admin weekly creation rule (up to 52 real Events).
  if (!input.occurrences?.length && slots.length === 1 && input.repeatWeeklyUntil) {
    const until = new Date(input.repeatWeeklyUntil).getTime(), first = slots[0];
    for (let week = 1; week < 52 && first.start.getTime() + week * 604800000 <= until; week++) {
      slots.push({ ...first, start: new Date(first.start.getTime() + week * 604800000), end: new Date(first.end.getTime() + week * 604800000) });
    }
  }
  return slots;
}
export function publicDuplicate(event: Pick<DuplicateRecord, "status" | "publishedAt">) {
  return event.status === "PUBLISHED" || (event.status === "ARCHIVED" && !!event.publishedAt);
}

/** Explicit location/time conflicts veto a match even when a source URL is shared.
 * Occurrence envelopes are never compared: only actual performances count. */
export function matchDuplicate(input: DuplicateInput, event: DuplicateRecord) {
  if (event.status === "REJECTED" || (event.status === "ARCHIVED" && !event.publishedAt)) return null;
  const similarity = titleSimilarity(input.title || "", event.title);
  if (similarity < 0.7) return null;
  const cityA = normalizeDuplicateText(input.cityName || ""), cityB = normalizeDuplicateText(event.city?.name || event.cityName || "");
  if (input.cityId && event.cityId && input.cityId !== event.cityId) return null;
  if (cityA && cityB && cityA !== cityB) return null;
  const sameCity = !!((input.cityId && input.cityId === event.cityId) || (cityA && cityA === cityB));
  const venueA = normalizeDuplicateText(input.venueName || ""), venueB = normalizeDuplicateText(event.venue?.name || event.venueName || "");
  const addressA = normalizeDuplicateText(input.address || ""), addressB = normalizeDuplicateText(event.venue?.address || event.address || "");
  const sameAddress = !!(addressA && addressA === addressB);
  const sameVenue = venueA && venueB
    ? venueA === venueB || titleSimilarity(venueA, venueB) >= 0.8
    : sameAddress;
  if (venueA && venueB && !sameVenue) return null;
  if (!venueA && !venueB && addressA && addressB && !sameAddress) return null;
  const shared = [...tokens(input.title || "")].filter(token => tokens(event.title).has(token) && token.length > 2 && !generic.has(token) && !tokens(cityA).has(token));
  const sameSource = !!(input.sourceUrl && input.sourceUrl === event.sourceUrl);
  let temporal: { reason: string; exact: boolean; start: Date; end: Date; allDay: boolean } | null = null;
  for (const a of duplicateSlots(input)) for (const b of duplicateSlots(event)) {
    const close = Math.abs(a.start.getTime() - b.start.getTime()) <= 30 * 60000;
    const overlap = a.start <= b.end && b.start <= a.end;
    const datesOverlap = zagrebDateKey(a.start) <= zagrebDateKey(b.end) && zagrebDateKey(b.start) <= zagrebDateKey(a.end);
    const multiDay = a.end.getTime() - a.start.getTime() >= 86400000 || b.end.getTime() - b.start.getTime() >= 86400000;
    const sameDay = zagrebDateKey(a.start) === zagrebDateKey(b.start);
    if ((a.allDay || b.allDay) ? datesOverlap : ((close && (sameDay || overlap)) || (multiDay && overlap && similarity >= 0.9))) {
      temporal = { reason: a.allDay || b.allDay ? "Preklapanje datuma (cjelodnevni ili nepotpun sat)" : close ? "Isti ili bliski početak (do 30 minuta)" : "Preklapanje višednevnog rasporeda", exact: close && !a.allDay && !b.allDay, start: b.start, end: b.end, allDay: b.allDay };
      break;
    }
  }
  if (!temporal) return null;
  // Generic labels need a precise venue and time, not merely the same city/day.
  if (!shared.length && !(similarity === 1 && sameVenue && temporal.exact)) return null;
  if (!sameCity && !sameVenue && !sameSource && (similarity < 0.9 || shared.length < 2)) return null;
  const score = Math.min(1, similarity * 0.6 + (temporal.exact ? 0.2 : 0.15) + (sameVenue ? 0.15 : sameCity ? 0.05 : 0) + (sameSource ? 0.05 : 0));
  return { score, startsAt: temporal.start, endsAt: temporal.end, isAllDay: temporal.allDay,
    reasons: [similarity === 1 ? "Podudaranje naslova" : "Sličan naslov", temporal.reason, ...(sameVenue ? ["Podudaranje mjesta"] : sameCity ? ["Isti grad"] : []), ...(sameSource ? ["Ista poveznica izvora"] : [])] };
}
