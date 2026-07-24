"use client"

import { useEffect, useState, useCallback } from "react"

import { PageHeader } from "@/components/admin/page-header"
import { PendingEventsTable } from "@/components/admin/pending-events-table"
import { TableLoadingState, ErrorState } from "@/components/admin/states"
import { authedFetch } from "@/lib/admin/api"
import { adaptEvent } from "@/lib/admin/adapters"
import type { AdminEvent } from "@/lib/admin/types"

type DateSortDirection = "asc" | "desc"

export default function PendingEventsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [dateSort, setDateSort] = useState<DateSortDirection>("asc")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sortBy: "startsAt", sortDir: dateSort })
      const res = await authedFetch(`/api/admin/events/pending?${params.toString()}`)
      if (!res.ok) { setError("Greška pri učitavanju."); return }
      const data = await res.json()
      const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
      setEvents((items as Record<string, unknown>[]).map(adaptEvent))
    } catch {
      setError("Greška pri dohvaćanju događaja.")
    } finally {
      setLoading(false)
    }
  }, [dateSort])

  useEffect(() => { load() }, [load])

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
      {loading ? (
        <TableLoadingState />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <PendingEventsTable events={events} onAction={load} dateSort={dateSort} onDateSortChange={setDateSort} />
      )}
    </>
  )
}
