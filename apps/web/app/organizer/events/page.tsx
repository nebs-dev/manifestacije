"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useOrganizerAuth } from "@/hooks/use-organizer-auth"
import { orgFetch, type OrgEvent } from "@/lib/organizer/api"
import { Button } from "@/components/ui/button"
import { CalendarPlus } from "lucide-react"

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: "Na pregledu",
  PUBLISHED: "Objavljeno",
  REJECTED: "Odbijeno",
  ARCHIVED: "Arhivirano",
}

const STATUS_CLASS: Record<string, string> = {
  PENDING_REVIEW: "bg-warning/15 text-warning",
  PUBLISHED: "bg-success/15 text-success",
  REJECTED: "bg-destructive/15 text-destructive",
  ARCHIVED: "bg-muted text-muted-foreground",
}

export default function OrganizerEventsPage() {
  const { loading: authLoading } = useOrganizerAuth()
  const [events, setEvents] = useState<OrgEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    orgFetch("/api/organizer/events")
      .then((r) => r.ok ? r.json() : [])
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [authLoading])

  if (loading) return <p className="text-muted-foreground">Učitavanje…</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Moji eventi</h1>
        <Link href="/organizer/events/new">
          <Button className="gap-2"><CalendarPlus className="size-4" />Dodaj event</Button>
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
          <p className="mb-4">Još nema eventa. Dodajte prvi!</p>
          <Link href="/organizer/events/new">
            <Button variant="outline">Dodaj event</Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map((ev) => (
            <Link key={ev.id} href={`/organizer/events/${ev.id}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/30">
              <div className="min-w-0">
                <p className="truncate font-medium">{ev.title}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(ev.startsAt).toLocaleDateString("hr")} · {ev.city.name} · {ev.category.name}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[ev.status] ?? "bg-muted text-muted-foreground"}`}>
                {STATUS_LABEL[ev.status] ?? ev.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
