"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ProposalPanel, type ProposalField } from "@/components/admin/parsed-candidate-card"
import { ScreenshotsPicker, screenshotsPayload, type ScreenshotInput } from "@/components/screenshots-picker"
import { authedFetch } from "@/lib/admin/api"
import type { CandidateProposal } from "@/lib/admin/types"

async function uploadAdminEvidence(file: File): Promise<string | undefined> {
  const form = new FormData()
  form.append("file", file)
  try {
    const res = await authedFetch("/api/admin/uploads/event-image", { method: "POST", body: form })
    return res.ok ? ((await res.json()) as { imageUrl?: string }).imageUrl : undefined
  } catch {
    return undefined
  }
}

/**
 * EVT-08 for an existing event: send extra text/images to the AI and review
 * proposed field values. Applying only fills the editor; the event changes
 * when the editor saves it, through the normal save and review rules.
 */
export function EventSupplementPanel({ eventId, current, onApply }: {
  eventId: string
  current: Record<string, unknown>
  onApply: (fields: ProposalField[], proposal: CandidateProposal) => void
}) {
  const [text, setText] = useState("")
  const [shots, setShots] = useState<ScreenshotInput[]>([])
  const [busy, setBusy] = useState(false)
  const [proposal, setProposal] = useState<CandidateProposal | null>(null)
  const [message, setMessage] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null)

  async function run() {
    if (!text.trim() && !shots.length) { setMessage({ tone: "error", text: "Dodajte tekst ili barem jednu sliku." }); return }
    setBusy(true); setMessage(null); setProposal(null)
    try {
      const res = await authedFetch(`/api/admin/events/${eventId}/supplement-parse`, {
        method: "POST", body: JSON.stringify({ text: text.trim() || undefined, screenshots: screenshotsPayload(shots) }),
      })
      const body = await res.json().catch(() => ({})) as { proposal?: CandidateProposal; message?: string }
      if (!res.ok) { setMessage({ tone: res.status === 503 ? "warn" : "error", text: body.message ?? "Obrada nije uspjela." }); return }
      const fields = Object.keys(body.proposal ?? {})
      if (!fields.length) setMessage({ tone: "ok", text: "AI nije pronašao ništa što bi promijenio u postojećim podacima." })
      else setProposal(body.proposal!)
    } catch {
      setMessage({ tone: "error", text: "Greška pri spajanju na server." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dopuni podatke pomoću AI</CardTitle>
        <CardDescription>Imate dodatni tekst ili novu sliku plakata? AI predlaže izmjene, a vi birate što preuzeti. Događaj se ne mijenja dok ga ne spremite.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Textarea aria-label="Dodatne informacije za AI" rows={3} value={text} onChange={(event) => setText(event.target.value)} disabled={busy}
          placeholder="npr. Promijenjen je početak na 21 h; ulaznice 15 EUR na mjestu održavanja." />
        <ScreenshotsPicker value={shots} onChange={setShots} upload={uploadAdminEvidence} disabled={busy} label="Nove slike (neobavezno)" />
        {message && (
          <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "ok" ? "text-sm text-muted-foreground" : message.tone === "warn" ? "text-sm text-warning" : "text-sm text-destructive"}>{message.text}</p>
        )}
        <div><Button type="button" variant="outline" onClick={run} disabled={busy}>{busy ? "Obrada…" : message?.tone === "warn" ? "Pokušaj ponovno" : "Predloži izmjene"}</Button></div>
        {proposal && (
          <ProposalPanel proposal={proposal} current={current}
            note="Adresa i grad prikazani su informativno — za točne koordinate odaberite lokaciju u polju za lokaciju."
            onDismiss={() => setProposal(null)}
            onApply={(fields) => {
              onApply(fields, proposal)
              setProposal(null); setText(""); setShots([])
              toast.success("Prijedlog je primijenjen u obrazac", { description: "Pregledajte i spremite događaj." })
            }} />
        )}
      </CardContent>
    </Card>
  )
}
