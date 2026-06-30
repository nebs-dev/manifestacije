"use client"

import { useEffect, useState, useCallback } from "react"

import { PageHeader } from "@/components/admin/page-header"
import { EventsTable } from "@/components/admin/events-table"
import { TableLoadingState, ErrorState } from "@/components/admin/states"
import { authedFetch } from "@/lib/admin/api"
import { adaptEvent } from "@/lib/admin/adapters"
import type { AdminEvent } from "@/lib/admin/types"

export default function EventsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/events")
      if (!res.ok) { setError("Greška pri učitavanju događaja."); return }
      const data = await res.json()
      setEvents((data as Record<string, unknown>[]).map(adaptEvent))
    } catch {
      setError("Greška pri dohvaćanju događaja.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <>
      <PageHeader
        title="Događaji"
        description="Svi događaji u sustavu, neovisno o statusu."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Događaji" }]}
      />
      {loading ? (
        <TableLoadingState />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <EventsTable events={events} onDelete={load} />
      )}
    </>
  )
}
