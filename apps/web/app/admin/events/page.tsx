"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"

import { PageHeader } from "@/components/admin/page-header"
import { EventsTable } from "@/components/admin/events-table"
import { TableLoadingState, ErrorState } from "@/components/admin/states"
import { Button } from "@/components/ui/button"
import { authedFetch } from "@/lib/admin/api"
import { adaptEvent } from "@/lib/admin/adapters"
import { toApiEventStatus } from "@/lib/admin/status"
import type { AdminEvent, EventStatus } from "@/lib/admin/types"

type DateSortDirection = "asc" | "desc"
type EventSortBy = "startsAt" | "createdAt"
type EventFilters = {
  search: string
  status: string
  organizerId: string
  startsFrom: string
  startsTo: string
  createdFrom: string
  createdTo: string
}

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

export default function EventsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState("")
  const [dateSort, setDateSort] = useState<DateSortDirection>(str(searchParams?.sortDir) === "desc" ? "desc" : "asc")
  const [sortBy, setSortBy] = useState<EventSortBy>(str(searchParams?.sortBy) === "createdAt" ? "createdAt" : "startsAt")
  const [filters, setFilters] = useState<EventFilters>({
    search: str(searchParams?.search) ?? "",
    status: str(searchParams?.status) ?? "all",
    organizerId: str(searchParams?.organizerId) ?? "all",
    startsFrom: str(searchParams?.startsFrom) ?? "",
    startsTo: str(searchParams?.startsTo) ?? "",
    createdFrom: str(searchParams?.createdFrom) ?? "",
    createdTo: str(searchParams?.createdTo) ?? "",
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sortBy, sortDir: dateSort })
      if (filters.search.trim()) params.set("search", filters.search.trim())
      if (filters.status !== "all") params.set("status", toApiEventStatus(filters.status as EventStatus))
      if (filters.organizerId !== "all") params.set("organizerId", filters.organizerId)
      if (filters.startsFrom) params.set("startsFrom", filters.startsFrom)
      if (filters.startsTo) params.set("startsTo", filters.startsTo)
      if (filters.createdFrom) params.set("createdFrom", filters.createdFrom)
      if (filters.createdTo) params.set("createdTo", filters.createdTo)
      const res = await authedFetch(`/api/admin/events?${params.toString()}`)
      if (!res.ok) { setError("Greška pri učitavanju događaja."); return }
      const data = await res.json()
      setEvents((data as Record<string, unknown>[]).map(adaptEvent))
      setError("")
    } catch {
      setError("Greška pri dohvaćanju događaja.")
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }, [dateSort, filters, sortBy])

  useEffect(() => { load() }, [load])

  return (
    <>
      <PageHeader
        title="Događaji"
        description="Svi događaji u sustavu, neovisno o statusu."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Događaji" }]}
        actions={<Button nativeButton={false} render={<Link href="/admin/events/new" />}><Plus data-icon="inline-start" />Novi događaj</Button>}
      />
      {loading && !hasLoaded ? (
        <TableLoadingState />
      ) : error && !hasLoaded ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <EventsTable
          events={events}
          loading={loading}
          onDelete={load}
          dateSort={dateSort}
          onDateSortChange={setDateSort}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          filters={filters}
          onFiltersChange={setFilters}
        />
      )}
    </>
  )
}
