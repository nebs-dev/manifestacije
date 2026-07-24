import type { EventSource, ParsedCandidate, AdminEvent, DuplicateCandidate } from "./types"
import { toUiEventStatus } from "./status"

type BE = Record<string, unknown>

export function adaptEventSource(src: BE): EventSource {
  const parsedJson = src.parsedJson as { candidates?: unknown[]; sourceImageUrl?: string } | null
  const organizer = src.organizer as BE | null
  return {
    id: String(src.id),
    sourceUrl: (src.sourceUrl as string) ?? "",
    subject: (src.rawEmailSubject as string) ?? (src.sourceUrl as string) ?? `Source #${src.id}`,
    from: (src.rawEmailFrom as string) ?? "",
    type: adaptSourceType(src.type as string),
    status: adaptSourceStatus(src.status as string),
    confidence: (src.confidence as number) ?? 0,
    candidateCount: parsedJson?.candidates?.length ?? 0,
    createdAt: src.createdAt as string,
    adminViewedAt: (src.adminViewedAt as string | null) ?? null,
    rawText: (src.rawText as string) ?? undefined,
    sourceImageUrl: parsedJson?.sourceImageUrl,
    organizerName: (organizer?.name as string) ?? null,
    organizerEmail: (organizer?.email as string) ?? null,
  }
}

export function adaptEventSourceCandidates(src: BE): ParsedCandidate[] {
  const parsedJson = src.parsedJson as { candidates?: BE[] } | null
  const candidates = parsedJson?.candidates ?? []
  return candidates.map((c, i) => ({
    id: `${src.id}-${i}`,
    sourceId: String(src.id),
    candidateIndex: i,
    title: (c.title as string) || "",
    description: (c.description as string) || "",
    startsAt: (c.startsAt as string) || null,
    endsAt: (c.endsAt as string) || null,
    venueName: (c.venueName as string) || null,
    address: (c.address as string) || null,
    city: (c.city as string) || null,
    county: (c.county as string) || null,
    region: (c.region as string) || null,
    category: (c.category as string) || null,
    isFree: (c.isFree as boolean) ?? false,
    priceText: (c.priceText as string) || null,
    ticketUrl: (c.ticketUrl as string) || null,
    organizerName: (c.organizerName as string) || null,
    imageUrl: (c.imageUrl as string) || null,
    confidence: (c.confidence as number) ?? 0,
    missingFields: (c.missingFields as string[]) ?? [],
    warnings: (c.warnings as string[]) ?? [],
    sourceUrl: (c.sourceUrl as string) || (src.sourceUrl as string) || "",
    _status: c._status as "pending" | "created" | "ignored" | undefined,
    _eventId: c._eventId as number | undefined,
  }))
}

export function adaptEvent(event: BE): AdminEvent {
  const city = event.city as BE | null
  const venue = event.venue as BE | null
  const category = event.category as BE | null
  const organizer = event.organizer as BE | null
  const rawCats = (event.categories as Array<{ categoryId: number; category: BE }> | null) ?? []
  const categories = rawCats.map((ec) => ({
    id: (ec.category?.id ?? ec.categoryId) as number,
    name: (ec.category?.name as string) || "",
    slug: (ec.category?.slug as string) || "",
  }))
  const primaryCategoryId = (category?.id ?? event.categoryId) as number | undefined
  return {
    id: String(event.id),
    title: (event.title as string) || "",
    slug: (event.slug as string) || "",
    description: (event.description as string) || "",
    createdAt: event.createdAt as string,
    startsAt: (event.startsAt as string) || null,
    endsAt: (event.endsAt as string) || null,
    allDay: (event.isAllDay as boolean) ?? false,
    city: (city?.name as string) ?? null,
    venue: (venue?.name as string) ?? null,
    address: (event.address as string) ?? null,
    lat: (event.lat as number) ?? null,
    lng: (event.lng as number) ?? null,
    category: (category?.name as string) ?? null,
    categories,
    organizer: (organizer?.name as string) ?? null,
    isFree: (event.isFree as boolean) ?? false,
    isFeatured: (event.isFeatured as boolean) ?? false,
    priceText: (event.priceText as string) ?? null,
    ticketUrl: (event.ticketUrl as string) ?? null,
    sourceUrl: (event.sourceUrl as string) ?? null,
    imageUrl: (event.imageUrl as string) ?? null,
    status: toUiEventStatus(event.status as string),
    confidence: (event.extractionConfidence as number) ?? 0.5,
    warnings: [],
    _cityId: event.cityId as number | undefined,
    _categoryId: event.categoryId as number | undefined,
    _categoryIds: categories.length ? categories.map((c) => c.id) : primaryCategoryId ? [primaryCategoryId] : [],
    _organizerId: event.organizerId as number | undefined,
  }
}

export function adaptDuplicate(dup: BE): DuplicateCandidate {
  const eventA = dup.eventA as BE
  const eventB = dup.eventB as BE
  return {
    id: String(dup.id),
    eventA: {
      id: String(eventA.id),
      title: (eventA.title as string) || "",
      startsAt: (eventA.startsAt as string) || null,
      city: ((eventA.city as BE)?.name as string) ?? null,
    },
    eventB: {
      id: String(eventB.id),
      title: (eventB.title as string) || "",
      startsAt: (eventB.startsAt as string) || null,
      city: ((eventB.city as BE)?.name as string) ?? null,
    },
    score: (dup.score as number) ?? 0,
    reason: (dup.reason as string) ?? "",
    status: adaptDuplicateStatus(dup.status as string),
  }
}

function adaptSourceType(type: string): EventSource["type"] {
  const map: Record<string, EventSource["type"]> = {
    EMAIL: "manual",
    URL: "url",
    URL_SUBMISSION: "url",
    MANUAL: "manual",
    SCRAPE_DISCOVERY: "portal",
  }
  return map[type] ?? "manual"
}

function adaptSourceStatus(status: string): EventSource["status"] {
  const map: Record<string, EventSource["status"]> = {
    NEW: "queued",
    PARSED: "parsed",
    NEEDS_REVIEW: "needs_review",
    LINKED: "done",
    REJECTED: "error",
  }
  return map[status] ?? "queued"
}

function adaptDuplicateStatus(status: string): DuplicateCandidate["status"] {
  const map: Record<string, DuplicateCandidate["status"]> = {
    OPEN: "open",
    MERGED: "merged",
    DISMISSED: "dismissed",
  }
  return map[status] ?? "open"
}
