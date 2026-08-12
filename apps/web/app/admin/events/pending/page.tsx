"use client"

import { useEffect, useState, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"

import { PageHeader } from "@/components/admin/page-header"
import { PendingEventsTable } from "@/components/admin/pending-events-table"
import { TableLoadingState, ErrorState } from "@/components/admin/states"
import { authedFetch } from "@/lib/admin/api"
import { adaptEvent } from "@/lib/admin/adapters"
import type { AdminEvent } from "@/lib/admin/types"
import type { DateSortDirection, EventSortBy, EventFilters, FieldFilter } from "@/components/admin/events-table"

function parsePositiveInt(value: string | string[] | undefined, fallback: number) {
  const parsed = Number(str(value))
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseFieldFilters(value: string | string[] | undefined): FieldFilter[] {
  const raw = str(value)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item, index) => {
      if (!item || typeof item !== "object") return []
      const record = item as Record<string, unknown>
      const field = typeof record.field === "string" ? record.field : ""
      if (!field) return []
      return [{
        id: typeof record.id === "string" ? record.id : `filter-${index}`,
        field,
        op: typeof record.op === "string" ? record.op : "contains",
        value: typeof record.value === "string" ? record.value : "",
      }]
    })
  } catch {
    return []
  }
}

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

export default function PendingEventsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const router = useRouter()
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
  const [filters, setFilters] = useState<EventFilters>({
    search: str(searchParams?.search) ?? "",
    fieldFilters: parseFieldFilters(searchParams?.fieldFilters),
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sortBy, sortDir: dateSort, page: String(page), pageSize: String(pageSize) })
      if (filters.search.trim()) params.set("search", filters.search.trim())
      if (filters.fieldFilters.length) params.set("fieldFilters", JSON.stringify(filters.fieldFilters.map(({ field, op, value }) => ({ field, op, value }))))
      const res = await authedFetch(`/api/admin/events/pending?${params.toString()}`)
      if (!res.ok) { setError("Greška pri učitavanju."); return }
      const data = await res.json()
      const paginated = data as { items?: Record<string, unknown>[]; total?: number }
      const items = Array.isArray(paginated.items) ? paginated.items : Array.isArray(data) ? data as Record<string, unknown>[] : []
      setEvents(items.map(adaptEvent))
      setTotal(typeof paginated.total === "number" ? paginated.total : items.length)
      setError("")
    } catch {
      setError("Greška pri dohvaćanju događaja.")
    } finally {
      setLoading(false)
      setHasLoaded(true)
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
    const params = new URLSearchParams({ sortBy, sortDir: dateSort, page: String(page), pageSize: String(pageSize) })
    if (filters.search.trim()) params.set("search", filters.search.trim())
    if (filters.fieldFilters.length) params.set("fieldFilters", JSON.stringify(filters.fieldFilters))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [dateSort, filters, page, pageSize, pathname, router, sortBy])

  return (
    <>
      <PageHeader
        title="Događaji na čekanju"
        description="Pregledajte i obradite događaje prije objave."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Događaji na čekanju" },
        ]}
      />
      {loading && !hasLoaded ? (
        <TableLoadingState />
      ) : error && !hasLoaded ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <PendingEventsTable
          events={events}
          loading={loading}
          onAction={load}
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
