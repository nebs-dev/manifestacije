"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { useOrganizerAuth } from "@/hooks/use-organizer-auth"
import { orgFetch, type OrgEvent, type OrgSource } from "@/lib/organizer/api"
import { Button } from "@/components/ui/button"
import { DeleteButton } from "@/components/admin/states"
import { CalendarPlus, Link2, Clock, CheckCircle2, AlertCircle } from "lucide-react"

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

const SOURCE_STATUS_LABEL: Record<string, string> = {
  NEW: "Zaprimljeno",
  PARSED: "Parsirano",
  NEEDS_REVIEW: "Čeka pregled",
  PROCESSED: "Obrađeno",
}

const DELETABLE = new Set(["PENDING_REVIEW", "DRAFT"])

function sourceLabel(s: OrgSource): string {
  if (s.sourceUrl) {
    try { return new URL(s.sourceUrl).hostname.replace(/^www\./, "") } catch { return s.sourceUrl }
  }
  if (s.rawText) return s.rawText.slice(0, 60) + (s.rawText.length > 60 ? "…" : "")
  return "Zahtjev"
}

function candidateCount(s: OrgSource): number {
  return s.parsedJson?.candidates?.length ?? 0
}

export default function OrganizerEventsPage() {
  const { loading: authLoading } = useOrganizerAuth()
  const [events, setEvents] = useState<OrgEvent[]>([])
  const [sources, setSources] = useState<OrgSource[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    Promise.all([
      orgFetch("/api/organizer/events").then((r) => r.ok ? r.json() : []),
      orgFetch("/api/organizer/sources").then((r) => r.ok ? r.json() : []),
    ])
      .then(([evs, srcs]) => { setEvents(evs); setSources(srcs) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [authLoading])

  async function deleteEvent(id: number) {
    try {
      const res = await orgFetch(`/api/organizer/events/${id}`, { method: "DELETE" })
      if (!res.ok) { toast.error(await res.text()); return }
      setEvents((prev) => prev.filter((ev) => ev.id !== id))
      toast.success("Event obrisan")
    } catch {
      toast.error("Greška pri brisanju")
    }
  }

  if (loading) return <p className="text-muted-foreground">Učitavanje…</p>

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">Moji eventi</h1>
        <div className="flex items-center gap-2">
          <Link href="/organizer/submit-link">
            <Button variant="outline" className="gap-2"><Link2 className="size-4" />Pošalji link</Button>
          </Link>
          <Link href="/organizer/events/new">
            <Button className="gap-2"><CalendarPlus className="size-4" />Dodaj event</Button>
          </Link>
        </div>
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
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[ev.status] ?? "bg-muted text-muted-foreground"}`}>
                  {STATUS_LABEL[ev.status] ?? ev.status}
                </span>
                {DELETABLE.has(ev.status) && (
                  <span onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
                    <DeleteButton onDelete={() => deleteEvent(ev.id)} />
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {sources.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-semibold text-muted-foreground">Poslani zahtjevi</h2>
          <div className="flex flex-col gap-2">
            {sources.map((s) => {
              const count = candidateCount(s)
              const isProcessed = s.status === "PROCESSED"
              const isParsed = s.status === "PARSED" || s.status === "NEEDS_REVIEW"
              return (
                <div key={s.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {isProcessed
                      ? <CheckCircle2 className="size-4 shrink-0 text-success" />
                      : isParsed
                      ? <AlertCircle className="size-4 shrink-0 text-warning" />
                      : <Clock className="size-4 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{sourceLabel(s)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString("hr")}
                        {count > 0 && ` · ${count} ${count === 1 ? "događaj pronađen" : "događaja pronađeno"}`}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {SOURCE_STATUS_LABEL[s.status] ?? s.status}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">Admin pregledava zahtjeve i objavljuje događaje.</p>
        </div>
      )}
    </div>
  )
}
