"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { PageHeader } from "@/components/admin/page-header"
import { EventsTable } from "@/components/admin/events-table"
import { EventCreatorReport } from "@/components/admin/event-creator-report"
import { eventFilterParams, parseEventFilters, type EventFilters } from "@/lib/admin/event-filters"
import { TableLoadingState, ErrorState } from "@/components/admin/states"
import { Button } from "@/components/ui/button"
import { authedFetch } from "@/lib/admin/api"
import { adaptEvent } from "@/lib/admin/adapters"
import type { AdminEvent } from "@/lib/admin/types"

type DateSortDirection = "asc" | "desc"
type EventSortBy = "startsAt" | "createdAt"
function parsePositiveInt(value: string | string[] | undefined, fallback: number) {
  const parsed = Number(str(value))
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

function navigationParams(filters: EventFilters, sortBy: EventSortBy, dateSort: DateSortDirection, page: number, pageSize: number) {
  const params = eventFilterParams(filters)
  params.set("sortBy", sortBy); params.set("sortDir", dateSort); params.set("page", String(page)); params.set("pageSize", String(pageSize))
  return params.toString()
}

export default function AdminEventsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const router = useRouter()
  const replace = router.replace
  const pathname = usePathname()
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(() => parsePositiveInt(searchParams?.page, 1))
  const [pageSize, setPageSize] = useState(() => parsePositiveInt(searchParams?.pageSize, 25))
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState("")
  const [dateSort, setDateSort] = useState<DateSortDirection>(str(searchParams?.sortDir) === "asc" ? "asc" : "desc")
  const [sortBy, setSortBy] = useState<EventSortBy>(str(searchParams?.sortBy) === "startsAt" ? "startsAt" : "createdAt")
  const [filters, setFilters] = useState<EventFilters>(() => parseEventFilters(searchParams))
  const requestId = useRef(0)
  const incomingUrl = navigationParams(parseEventFilters(searchParams), str(searchParams?.sortBy) === "startsAt" ? "startsAt" : "createdAt", str(searchParams?.sortDir) === "asc" ? "asc" : "desc", parsePositiveInt(searchParams?.page, 1), parsePositiveInt(searchParams?.pageSize, 25))
  const lastWrittenUrl = useRef(incomingUrl)

  // Internal filter changes already have matching state. Back/forward or an
  // external organizer link must also update this mounted client component.
  useEffect(() => {
    if (incomingUrl === lastWrittenUrl.current) return
    lastWrittenUrl.current = incomingUrl
    const params = Object.fromEntries(new URLSearchParams(incomingUrl))
    setFilters(parseEventFilters(params))
    setPage(Number(params.page)); setPageSize(Number(params.pageSize))
    setSortBy(params.sortBy as EventSortBy); setDateSort(params.sortDir as DateSortDirection)
  }, [incomingUrl])

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    try {
      const params = eventFilterParams(filters)
      params.set("sortBy", sortBy); params.set("sortDir", dateSort); params.set("page", String(page)); params.set("pageSize", String(pageSize))
      const res = await authedFetch(`/api/admin/events?${params.toString()}`)
      if (currentRequest !== requestId.current) return
      if (!res.ok) { setError("Greška pri učitavanju događaja."); return }
      const data = await res.json()
      if (currentRequest !== requestId.current) return
      const paginated = data as { items?: Record<string, unknown>[]; total?: number; page?: number; pageSize?: number; pageCount?: number }
      const items = Array.isArray(paginated.items) ? paginated.items : Array.isArray(data) ? data as Record<string, unknown>[] : []
      setEvents(items.map(adaptEvent))
      setTotal(typeof paginated.total === "number" ? paginated.total : items.length)
      setError("")
    } catch {
      if (currentRequest === requestId.current) setError("Greška pri dohvaćanju događaja.")
    } finally {
      if (currentRequest === requestId.current) { setLoading(false); setHasLoaded(true) }
    }
  }, [dateSort, filters, page, pageSize, sortBy])

  const setFiltersAndResetPage = useCallback((next: EventFilters) => {
    setPage(1)
    setFilters(next)
  }, [])

  const setSortByAndResetPage = useCallback((next: EventSortBy) => {
    setPage(1)
    setSortBy(next)
  }, [])

  const setDateSortAndResetPage = useCallback((next: DateSortDirection) => {
    setPage(1)
    setDateSort(next)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const params = navigationParams(filters, sortBy, dateSort, page, pageSize)
    lastWrittenUrl.current = params
    replace(`${pathname}?${params}`, { scroll: false })
  }, [dateSort, filters, page, pageSize, pathname, replace, sortBy])

  return (
    <>
      <PageHeader
        title="Događaji"
        description="Svi događaji u sustavu, neovisno o statusu."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Događaji" }]}
        actions={<Button nativeButton={false} render={<Link href="/admin/events/new" />}><Plus data-icon="inline-start" />Novi događaj</Button>}
      />
      <EventCreatorReport filters={filters} onChange={setFiltersAndResetPage} />
      {loading && !hasLoaded ? (
        <TableLoadingState />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <EventsTable
          events={events}
          loading={loading}
          onDelete={load}
          dateSort={dateSort}
          onDateSortChange={setDateSortAndResetPage}
          sortBy={sortBy}
          onSortByChange={setSortByAndResetPage}
          filters={filters}
          onFiltersChange={setFiltersAndResetPage}
          pagination={{ page, pageSize, total }}
          onPageChange={setPage}
          onPageSizeChange={(next) => { setPage(1); setPageSize(next) }}
        />
      )}
    </>
  )
}
