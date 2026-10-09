"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { authedFetch } from "@/lib/admin/api"
import { revisionApiError, revisionDate, type EventRevision } from "@/lib/event-revisions"
import { EventRevisionDiff } from "@/components/event-revision-diff"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

export function EventRevisionReview({ id }: { id: number }) {
  const [revision, setRevision] = useState<EventRevision | null>(null)
  const [reason, setReason] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0), [notice, setNotice] = useState("")
  useEffect(() => {
    let active = true
    setRevision(null); setError("")
    authedFetch(`/api/admin/event-revisions/${id}`).then(async response => {
      if (!response.ok) throw new Error(await revisionApiError(response))
      const data = await response.json()
      if (active) setRevision(data)
    }).catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [id, refresh])

  async function decide(action: "approve" | "reject") {
    if (!revision || revision.status !== "PENDING") return
    setBusy(true); setError("")
    try {
      const response = await authedFetch(`/api/admin/event-revisions/${id}/${action}`, { method: "POST", body: JSON.stringify({ version: revision.version, ...(action === "reject" ? { reason } : {}) }) })
      if (!response.ok) {
        setError(await revisionApiError(response))
        // Force a fresh review after a conflict; never automatically approve
        // the replacement proposal using the previously viewed version.
        if (response.status === 409) setRevision({ ...revision, conflict: true })
        return
      }
      setRevision({ ...revision, ...(await response.json()) })
      setNotice(action === "approve" ? "Izmjene su odobrene." : "Izmjene su odbijene. Objavljena verzija nije promijenjena.")
      window.dispatchEvent(new Event("event-revisions-changed"))
    } catch { setError("Greška pri spajanju na poslužitelj.") } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-2xl font-semibold">Pregled izmjena događaja</h1>
      <Link href="/admin/event-revisions" className="text-primary underline">Sve izmjene na čekanju</Link>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-success/10 p-3">{notice}</p>}
      {!revision ? <><p>Učitavanje prijedloga…</p>{error && <Button onClick={() => setRefresh(value => value + 1)}>Pokušaj ponovno</Button>}</> : <>
        <div className="rounded-lg border p-4">
          <h2 className="text-xl font-semibold">{revision.event?.title}</h2>
          <p>{revision.organizer?.name} · Poslano {revisionDate(revision.submittedAt)}</p>
          {revision.submittedBy && <p>Poslao/la: {revision.submittedBy.name} ({revision.submittedBy.email})</p>}
          <p className="mt-2 text-sm text-muted-foreground">Vremena su prikazana za Hrvatsku (Europe/Zagreb). Odobrenje čuva postojeću javnu adresu događaja.</p>
          <Link className="text-primary underline" href={`/eventi/${revision.event?.slug}`} target="_blank" rel="noopener noreferrer">Otvori objavljenu verziju</Link>
        </div>
        {revision.conflict && revision.status === "PENDING" && <div role="alert" className="rounded-lg border border-warning p-4">
          <p>Objavljena verzija ili prijedlog promijenjeni su nakon slanja ili učitavanja. Odobrenje je blokirano. Osvježite pregled; za promijenjenu objavljenu verziju potreban je novi prijedlog organizatora.</p>
          <Button variant="outline" onClick={() => setRefresh(value => value + 1)}>Osvježi pregled</Button>
        </div>}
        <EventRevisionDiff revision={revision} />
        {revision.status === "PENDING" ? <>
          <div className="flex flex-col gap-2"><Label htmlFor="revision-reason">Razlog odbijanja (opcionalno)</Label><Textarea id="revision-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} disabled={busy} /></div>
          <div className="flex flex-wrap gap-3"><Button disabled={busy || revision.conflict} onClick={() => decide("approve")}>Odobri izmjene</Button><Button variant="destructive" disabled={busy} onClick={() => decide("reject")}>Odbij izmjene</Button></div>
        </> : <p>{revision.status === "APPROVED" ? "Izmjene odobrene" : "Izmjene odbijene"}{revision.rejectionReason ? ` · ${revision.rejectionReason}` : ""}</p>}
      </>}
    </div>
  )
}
