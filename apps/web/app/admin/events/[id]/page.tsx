"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { PageHeader } from "@/components/admin/page-header"
import { EventEditForm } from "@/components/admin/event-edit-form"
import { TableLoadingState, ErrorState } from "@/components/admin/states"
import { Button } from "@/components/ui/button"
import { authedFetch } from "@/lib/admin/api"
import { adaptEvent } from "@/lib/admin/adapters"
import type { AdminEvent } from "@/lib/admin/types"

function safeReturnTo(value: string | undefined) {
  if (!value) return "/admin/events"
  if (!value.startsWith("/admin/events")) return "/admin/events"
  if (value.startsWith("//")) return "/admin/events"
  if (value.startsWith("/admin/events/")) return "/admin/events"
  return value
}

export default function EventDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const { id } = params
  const returnTo = safeReturnTo(Array.isArray(searchParams?.returnTo) ? searchParams?.returnTo[0] : searchParams?.returnTo)
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
          { label: "Događaji", href: returnTo },
          { label: event.title },
        ]}
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href={returnTo} />}>
            <ArrowLeft data-icon="inline-start" />
            Natrag na listu
          </Button>
        }
      />
      <EventEditForm event={event} onUpdate={load} />
    </>
  )
}
