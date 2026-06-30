"use client"

import { useEffect, useState, useCallback } from "react"
import { use } from "react"

import { PageHeader } from "@/components/admin/page-header"
import { EventEditForm } from "@/components/admin/event-edit-form"
import { TableLoadingState, ErrorState } from "@/components/admin/states"
import { authedFetch } from "@/lib/admin/api"
import { adaptEvent } from "@/lib/admin/adapters"
import type { AdminEvent } from "@/lib/admin/types"

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [event, setEvent] = useState<AdminEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch(`/api/admin/events/${id}`)
      if (!res.ok) { setError("Događaj nije pronađen."); return }
      const data = await res.json() as Record<string, unknown>
      setEvent(adaptEvent(data))
    } catch {
      setError("Greška pri dohvaćanju događaja.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <TableLoadingState />
  if (error || !event) return <ErrorState description={error} onRetry={load} />

  return (
    <>
      <PageHeader
        title={event.title}
        description="Uredi detalje događaja, promijeni status i objavi."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Događaji", href: "/admin/events" },
          { label: event.title },
        ]}
      />
      <EventEditForm event={event} onUpdate={load} />
    </>
  )
}
