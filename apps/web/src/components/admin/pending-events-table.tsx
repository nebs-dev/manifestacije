"use client"

import Link from "next/link"
import { Check, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { authedFetch } from "@/lib/admin/api"
import { EventsTable } from "@/components/admin/events-table"
import type { DateSortDirection, EventSortBy, EventFilters, EventColumnKey } from "@/components/admin/events-table"
import type { AdminEvent } from "@/lib/admin/types"

const PENDING_DEFAULT_COLUMNS: EventColumnKey[] = ["title", "startsAt", "createdAt", "city", "confidence", "warnings"]

export function PendingEventsTable({
  events,
  loading,
  onAction,
  dateSort,
  onDateSortChange,
  sortBy,
  onSortByChange,
  filters,
  onFiltersChange,
  pagination,
  onPageChange,
  onPageSizeChange,
}: {
  events: AdminEvent[]
  loading?: boolean
  onAction?: () => void
  dateSort: DateSortDirection
  onDateSortChange: (direction: DateSortDirection) => void
  sortBy: EventSortBy
  onSortByChange: (sortBy: EventSortBy) => void
  filters: EventFilters
  onFiltersChange: (filters: EventFilters) => void
  pagination: { page: number; pageSize: number; total: number }
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  async function approve(id: string, title: string) {
    const res = await authedFetch(`/api/admin/events/${id}/approve`, { method: "POST" })
    if (res.ok) { toast.success(`Odobreno: ${title}`); onAction?.() }
    else toast.error("Greška pri odobravanju")
  }

  async function reject(id: string, title: string) {
    const res = await authedFetch(`/api/admin/events/${id}/reject`, { method: "POST" })
    if (res.ok) { toast.success(`Odbijeno: ${title}`); onAction?.() }
    else toast.error("Greška pri odbijanju")
  }

  return (
    <EventsTable
      events={events}
      loading={loading}
      onDelete={onAction}
      dateSort={dateSort}
      onDateSortChange={onDateSortChange}
      sortBy={sortBy}
      onSortByChange={onSortByChange}
      filters={filters}
      onFiltersChange={onFiltersChange}
      pagination={pagination}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      basePath="/admin/events/pending"
      storageKey="admin-pending-events-visible-columns"
      defaultVisibleColumns={PENDING_DEFAULT_COLUMNS}
      emptyTitle="Nema događaja na čekanju"
      emptyDescription="Svi prikupljeni događaji su pregledani. Dobar posao!"
      renderRowActions={(event) => (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Odobri"
            className="text-success"
            onClick={() => approve(event.id, event.title)}
          >
            <Check />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Odbij"
            className="text-destructive"
            onClick={() => reject(event.id, event.title)}
          >
            <X />
          </Button>
        </>
      )}
    />
  )
}
