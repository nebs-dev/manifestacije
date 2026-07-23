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
import type { AdminEvent } from "@/lib/admin/types"

type DateSortDirection = "asc" | "desc"

export default function EventsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [dateSort, setDateSort] = useState<DateSortDirection>("asc")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sortBy: "startsAt", sortDir: dateSort })
      const res = await authedFetch(`/api/admin/events?${params.toString()}`)
      if (!res.ok) { setError("Greška pri učitavanju događaja."); return }
      const data = await res.json()
      setEvents((data as Record<string, unknown>[]).map(adaptEvent))
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
        title="Događaji"
        description="Svi događaji u sustavu, neovisno o statusu."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Događaji" }]}
        actions={<Button nativeButton={false} render={<Link href="/admin/events/new" />}><Plus data-icon="inline-start" />Novi događaj</Button>}
      />
      {loading ? (
        <TableLoadingState />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <EventsTable events={events} onDelete={load} dateSort={dateSort} onDateSortChange={setDateSort} />
      )}
    </>
  )
}
