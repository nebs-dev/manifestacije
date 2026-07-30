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
  | "published"
  | "rejected"
  | "archived"
  | "draft"

export type DuplicateStatus = "open" | "merged" | "dismissed"

export interface AdminOrganizer {
  id: number
  name: string
  slug: string
  status: string
}

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
  adminViewedAt: string | null
  rawText?: string
  sourceImageUrl?: string
  organizerName: string | null
  organizerEmail: string | null
  firstCandidateTitle?: string
}

export interface ParsedCandidate {
  id: string
  sourceId: string
  candidateIndex: number
  title: string
  description: string
  startsAt: string | null
  endsAt: string | null
  isAllDay?: boolean
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
  imageUrl: string | null
  confidence: number
  missingFields: string[]
  warnings: string[]
  sourceUrl: string
  _status?: "pending" | "created" | "ignored"
  _eventId?: number
  /** A published event that looks like this candidate. Advisory only — the
   *  candidate stays fully importable, since a wrong guess must not stop a
   *  genuinely new event from being added. */
  _existingEventId?: number
}

export interface AdminEvent {
  id: string
  title: string
  slug: string
  description: string
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  startsAt: string | null
  endsAt: string | null
  allDay: boolean
  city: string | null
  cityName: string | null
  county: string | null
  region: string | null
  venue: string | null
  address: string | null
  lat: number | null
  lng: number | null
  category: string | null
  categories: { id: number; name: string; slug: string }[]
  organizer: string | null
  isFree: boolean
  isFeatured: boolean
  priceText: string | null
  ticketUrl: string | null
  sourceUrl: string | null
  sourceType: string | null
  sources: { id: string; type: string; sourceUrl: string | null }[]
  imageUrl: string | null
  status: EventStatus
  confidence: number
  warnings: string[]
  _venueId?: number
  _cityId?: number
  _countyId?: number
  _regionId?: number
  _categoryId?: number
  _categoryIds?: number[]
  _organizerId?: number
}

export interface PaginatedAdminEvents {
  items: AdminEvent[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export type MonitoredSourceType = "LISTING_PAGE" | "EVENT_PAGE"
export type MonitoredSourceCheckStatus = "OK" | "UNCHANGED" | "ERROR" | null

export interface MonitoredSource {
  id: string
  name: string
  url: string
  sourceType: MonitoredSourceType
  organizerName: string | null
  isActive: boolean
  checkIntervalMinutes: number
  nextCheckAt: string
  lastCheckedAt: string | null
  lastStatus: MonitoredSourceCheckStatus
  consecutiveFailures: number
  lastError: string | null
}

export interface MonitoredSourceRun {
  id: string
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED"
  createdAt: string
  error: string | null
  result: { outcome?: string; itemsFound?: number; itemsNew?: number; candidatesCreated?: number; eventSourceId?: number } | null
}

export interface DuplicateCandidate {
  id: string
  eventA: { id: string; title: string; startsAt: string | null; city: string | null }
  eventB: { id: string; title: string; startsAt: string | null; city: string | null }
  score: number
  reason: string
  status: DuplicateStatus
}
