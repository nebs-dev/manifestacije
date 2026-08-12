"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { PageHeader } from "@/components/admin/page-header"
import { EventsTable } from "@/components/admin/events-table"
import { TableLoadingState, ErrorState } from "@/components/admin/states"
import { Button } from "@/components/ui/button"
import { authedFetch } from "@/lib/admin/api"
import { adaptEvent } from "@/lib/admin/adapters"
import type { AdminEvent } from "@/lib/admin/types"

type DateSortDirection = "asc" | "desc"
type EventSortBy = "startsAt" | "createdAt"
type EventFilters = {
  search: string
  fieldFilters: FieldFilter[]
}
type FieldFilter = { id: string; field: string; op: string; value: string }

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

export default function EventsPage({
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
      const res = await authedFetch(`/api/admin/events?${params.toString()}`)
      if (!res.ok) { setError("Greška pri učitavanju događaja."); return }
      const data = await res.json()
      const paginated = data as { items?: Record<string, unknown>[]; total?: number; page?: number; pageSize?: number; pageCount?: number }
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
