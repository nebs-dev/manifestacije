"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { orgFetch } from "@/lib/organizer/api"
import { OrganizerEventForm } from "@/components/organizer/event-form"
import { useOrganizerAuth } from "@/hooks/use-organizer-auth"

export default function EditEventPage() {
  useOrganizerAuth()
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    orgFetch("/api/organizer/events")
      .then((r) => r.ok ? r.json() : [])
      .then((events: Record<string, unknown>[]) => {
        const ev = events.find((e) => String(e.id) === id)
        if (!ev) setError("Event nije pronađen")
        else setEvent(ev)
      })
      .catch(() => setError("Greška pri učitavanju"))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="text-muted-foreground">Učitavanje…</p>
  if (error) return <p className="text-destructive">{error}</p>
  if (!event) return null

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold">Uredi event</h1>
      <OrganizerEventForm
        eventId={Number(id)}
        initial={{
          title: event.title as string,
          description: event.description as string,
          startsAt: event.startsAt as string,
          endsAt: event.endsAt as string | undefined,
          cityId: (event.city as { id: number })?.id,
          categoryId: (event.category as { id: number })?.id,
          venueName: event.venueName as string | undefined,
          isFree: event.isFree as boolean,
          priceText: event.priceText as string | undefined,
          ticketUrl: event.ticketUrl as string | undefined,
          imageUrl: event.imageUrl as string | undefined,
        }}
      />
    </div>
  )
}
