"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { authedFetch } from "@/lib/admin/api"
import { revisionDate, type EventRevision } from "@/lib/event-revisions"
import { Button } from "@/components/ui/button"

export default function EventRevisionsPage() {
  const [items, setItems] = useState<EventRevision[]>([])
  const [page, setPage] = useState(1), [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true), [error, setError] = useState("")
  useEffect(() => {
    let active = true
    setLoading(true); setError("")
    authedFetch(`/api/admin/event-revisions?page=${page}`).then(async response => {
      if (!response.ok) throw new Error("Izmjene nije moguće učitati.")
      const data = await response.json()
      if (active) { setItems(data.items); setTotal(data.total) }
    }).catch(() => { if (active) setError("Izmjene nije moguće učitati. Pokušajte ponovno.") }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page])
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-2xl font-semibold">Izmjene objavljenih događaja</h1>
      <p className="text-muted-foreground">Objavljene verzije ostaju vidljive dok pregledavate prijedloge.</p>
      {error ? <p role="alert" className="text-destructive">{error}</p> : loading ? <p>Učitavanje…</p> : items.length ? (
        <ul className="flex flex-col gap-3">{items.map(revision => (
          <li key={revision.id}><Link href={`/admin/event-revisions/${revision.id}`} className="flex flex-col gap-1 rounded-lg border p-4 hover:bg-muted/30">
            <strong>{revision.event?.title}</strong>
            <span>{revision.organizer?.name} · {revisionDate(revision.submittedAt)}</span>
            <span className="text-sm text-primary">Pregledaj izmjene →</span>
          </Link></li>
        ))}</ul>
      ) : <p>Nema izmjena na čekanju.</p>}
      <div className="flex items-center gap-3">
        <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Prethodna</Button>
        <span>Stranica {page} · Ukupno {total}</span>
        <Button variant="outline" disabled={page * 25 >= total || loading} onClick={() => setPage(value => value + 1)}>Sljedeća</Button>
      </div>
    </div>
  )
}
