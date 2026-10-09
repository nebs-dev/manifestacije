import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { EventContentDto } from "../events/event.dto";

export const revisionEventInclude = {
  venue: true,
  category: true,
  categories: { orderBy: { categoryId: "asc" as const }, include: { category: true } },
  occurrences: { orderBy: [{ startsAt: "asc" as const }, { id: "asc" as const }] },
} satisfies Prisma.EventInclude;
export type RevisionEvent = Prisma.EventGetPayload<{ include: typeof revisionEventInclude }>;

export function eventContent(event: RevisionEvent): EventContentDto {
  return {
    title: event.title, description: event.description,
    cityId: event.cityId, cityName: event.cityName ?? "",
    categoryId: event.categoryId,
    categoryIds: [event.categoryId, ...event.categories.map(row => row.categoryId).filter(id => id !== event.categoryId)],
    startsAt: event.startsAt.toISOString(), endsAt: event.endsAt?.toISOString() ?? null,
    isAllDay: event.isAllDay, isFree: event.isFree as boolean,
    occurrences: event.occurrences.map(row => ({ id: row.id, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt?.toISOString() ?? null, isAllDay: row.isAllDay })),
    priceText: event.priceText, ticketUrl: event.ticketUrl, sourceUrl: event.sourceUrl, imageUrl: event.imageUrl,
    venueName: event.venue?.name ?? "", address: event.address as string,
    lat: event.lat as number, lng: event.lng as number,
  };
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

/** Includes protected fields and related rows too: an admin may change the
 * status, owner, venue or categories without an Event content edit. */
export function eventFingerprint(event: RevisionEvent): string {
  return createHash("sha256").update(stableJson(event)).digest("hex");
}

export function contentChanges(original: EventContentDto, proposed: EventContentDto) {
  return Object.keys(original).filter(field => stableJson(original[field as keyof EventContentDto]) !== stableJson(proposed[field as keyof EventContentDto]))
    .map(field => ({ field, original: original[field as keyof EventContentDto] ?? null, proposed: proposed[field as keyof EventContentDto] ?? null }));
}
