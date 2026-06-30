import type { EventStatus } from "./types"

export type ApiEventStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "REJECTED"
  | "ARCHIVED"

export const EVENT_STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: "pending", label: "Na čekanju" },
  { value: "published", label: "Objavljeno" },
  { value: "rejected", label: "Odbijeno" },
  { value: "archived", label: "Arhivirano" },
  { value: "draft", label: "Skica" },
]

export function toUiEventStatus(status: string): EventStatus {
  const map: Record<string, EventStatus> = {
    DRAFT: "draft",
    PENDING_REVIEW: "pending",
    PUBLISHED: "published",
    REJECTED: "rejected",
    ARCHIVED: "archived",
  }
  return map[status] ?? "draft"
}

export function toApiEventStatus(status: EventStatus): ApiEventStatus {
  const map: Record<EventStatus, ApiEventStatus> = {
    draft: "DRAFT",
    pending: "PENDING_REVIEW",
    published: "PUBLISHED",
    rejected: "REJECTED",
    archived: "ARCHIVED",
  }
  return map[status]
}

export function eventStatusLabel(status: EventStatus): string {
  return EVENT_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
}
