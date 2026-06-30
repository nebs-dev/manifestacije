export type SourceType = "url" | "manual" | "portal" | "organizer" | "tourist-board"

export type SourceStatus =
  | "queued"
  | "parsing"
  | "parsed"
  | "needs_review"
  | "error"
  | "done"

export type EventStatus =
  | "pending"
  | "approved"
  | "published"
  | "rejected"
  | "archived"
  | "draft"

export type DuplicateStatus = "open" | "merged" | "dismissed"

export interface EventSource {
  id: string
  sourceUrl: string
  subject: string
  from: string
  type: SourceType
  status: SourceStatus
  confidence: number
  candidateCount: number
  createdAt: string
  rawText?: string
}

export interface ParsedCandidate {
  id: string
  sourceId: string
  candidateIndex: number
  title: string
  description: string
  startsAt: string | null
  endsAt: string | null
  venueName: string | null
  address: string | null
  city: string | null
  county: string | null
  region: string | null
  category: string | null
  isFree: boolean
  priceText: string | null
  ticketUrl: string | null
  organizerName: string | null
  confidence: number
  missingFields: string[]
  warnings: string[]
  sourceUrl: string
  _status?: "pending" | "created" | "ignored"
  _eventId?: number
}

export interface AdminEvent {
  id: string
  title: string
  slug: string
  description: string
  shortDescription: string
  startsAt: string | null
  endsAt: string | null
  allDay: boolean
  city: string | null
  venue: string | null
  category: string | null
  organizer: string | null
  isFree: boolean
  priceText: string | null
  ticketUrl: string | null
  sourceUrl: string | null
  imageUrl: string | null
  status: EventStatus
  confidence: number
  warnings: string[]
  _cityId?: number
  _categoryId?: number
  _organizerId?: number
}

export interface DuplicateCandidate {
  id: string
  eventA: { id: string; title: string; startsAt: string | null; city: string | null }
  eventB: { id: string; title: string; startsAt: string | null; city: string | null }
  score: number
  reason: string
  status: DuplicateStatus
}
