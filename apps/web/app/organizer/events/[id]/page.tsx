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
          shortDescription: event.shortDescription as string | undefined,
          startsAt: event.startsAt as string,
          endsAt: event.endsAt as string | undefined,
          cityId: (event.city as { id: number })?.id,
          categoryId: (event.category as { id: number })?.id,
          categoryIds: ((event.categories as Array<{ categoryId?: number; category?: { id: number } }> | undefined) ?? [])
            .map((c) => c.category?.id ?? c.categoryId)
            .filter((id): id is number => typeof id === "number"),
          venueName: (event.venue as { name?: string } | null)?.name,
          address: event.address as string | null,
          lat: event.lat as number | null,
          lng: event.lng as number | null,
          isFree: event.isFree as boolean,
          priceText: event.priceText as string | undefined,
          ticketUrl: event.ticketUrl as string | undefined,
          sourceUrl: event.sourceUrl as string | undefined,
          imageUrl: event.imageUrl as string | undefined,
          imageAlt: event.imageAlt as string | undefined,
          imageCredit: event.imageCredit as string | undefined,
          imageSourceUrl: event.imageSourceUrl as string | undefined,
        }}
      />
    </div>
  )
}
