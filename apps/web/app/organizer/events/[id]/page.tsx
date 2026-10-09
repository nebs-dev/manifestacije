"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { orgFetch } from "@/lib/organizer/api"
import { OrganizerEventForm } from "@/components/organizer/event-form"
import { useOrganizerAuth } from "@/hooks/use-organizer-auth"
import { EventRevisionDiff } from "@/components/event-revision-diff"
import { type EventRevision, revisionApiError } from "@/lib/event-revisions"
import { Button } from "@/components/ui/button"

export default function EditEventPage() {
  useOrganizerAuth()
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [proposal, setProposal] = useState<EventRevision | null>(null)
  const [editingProposal, setEditingProposal] = useState(false)
  const [proposalError, setProposalError] = useState("")

  async function viewProposal(revisionId: number) {
    setProposalError("")
    try {
      const response = await orgFetch(`/api/organizer/event-revisions/${revisionId}`)
      if (!response.ok) throw new Error(await revisionApiError(response))
      setProposal(await response.json())
    } catch (error) { setProposalError(error instanceof Error ? error.message : "Greška pri učitavanju izmjena.") }
  }

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
  const pending = (event.revisions as Array<{ id: number }> | undefined)?.[0]
  const published = event.status === "PUBLISHED" || Boolean(event.publishedAt)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold">Uredi događaj</h1>
      {pending && <div className="rounded-md border p-4 space-y-3">
        <p>Izmjene su na pregledu. Trenutačno objavljena verzija ostaje vidljiva.</p>
        <Button type="button" variant="outline" onClick={() => viewProposal(pending.id)}>Pogledaj predložene izmjene</Button>
        {proposalError && <p role="alert" className="text-destructive">{proposalError}</p>}
        {proposal && <>
          {proposal.conflict && <p role="alert">Objavljena verzija je promijenjena. Pregledajte podatke i ponovno pošaljite izmjene.</p>}
          <EventRevisionDiff revision={proposal} />
          <Button type="button" onClick={() => setEditingProposal(true)}>Uredi prijedlog</Button>
          {editingProposal && <Button type="button" variant="outline" onClick={() => setEditingProposal(false)}>Učitaj objavljenu verziju</Button>}
        </>}
      </div>}
      {published && <p className="text-sm text-muted-foreground">{editingProposal ? "Uređujete predložene izmjene." : "Uređujete trenutačno objavljene podatke."}</p>}
      <OrganizerEventForm
        key={editingProposal ? `proposal-${proposal?.version}` : "published"}
        eventId={Number(id)}
        published={published}
        initial={editingProposal && proposal ? proposal.proposed : {
          title: event.title as string,
          description: event.description as string,
          startsAt: event.startsAt as string,
          endsAt: event.endsAt as string | undefined,
          isAllDay: event.isAllDay as boolean | undefined,
          occurrences: event.occurrences as Array<{ id?: number; startsAt: string; endsAt?: string | null; isAllDay?: boolean }> | undefined,
          cityName: event.cityName as string | undefined ?? (event.city as { name?: string } | null)?.name,
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
        }}
      />
    </div>
  )
}
