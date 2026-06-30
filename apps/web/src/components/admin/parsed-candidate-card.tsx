"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarPlus,
  X,
  ExternalLink,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { ConfidenceBadge } from "@/components/admin/confidence-badge"
import { authedFetch } from "@/lib/admin/api"
import type { ParsedCandidate } from "@/lib/admin/types"

type CandidateForm = {
  title: string
  description: string
  startsAt: string
  endsAt: string
  city: string
  venueName: string
  category: string
  isFree: boolean
  priceText: string
  ticketUrl: string
  organizerName: string
  imageUrl: string
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function fromDateTimeLocal(value: string) {
  if (!value) return ""
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toISOString()
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function ParsedCandidateCard({
  candidate,
  onUpdate,
}: {
  candidate: ParsedCandidate
  onUpdate?: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<CandidateForm>(() => ({
    title: candidate.title || "",
    description: candidate.description || "",
    startsAt: toDateTimeLocal(candidate.startsAt),
    endsAt: toDateTimeLocal(candidate.endsAt),
    city: candidate.city || "",
    venueName: candidate.venueName || "",
    category: candidate.category || "",
    isFree: candidate.isFree,
    priceText: candidate.priceText || "",
    ticketUrl: candidate.ticketUrl || "",
    organizerName: candidate.organizerName || "",
    imageUrl: candidate.imageUrl || "",
  }))

  const isCreated = candidate._status === "created"
  const isIgnored = candidate._status === "ignored"
  const isPending = !isCreated && !isIgnored
  const hasRequired = Boolean(
    form.title.trim() &&
      form.startsAt.trim() &&
      form.city.trim() &&
      form.category.trim()
  )

  function setField<K extends keyof CandidateForm>(key: K, value: CandidateForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function createEvent() {
    if (!hasRequired) return
    setBusy(true)
    try {
      const res = await authedFetch(
        `/api/admin/event-sources/${candidate.sourceId}/create-event`,
        {
          method: "POST",
          body: JSON.stringify({
            candidateIndex: candidate.candidateIndex,
            candidate: {
              title: form.title,
              description: form.description,
              startsAt: fromDateTimeLocal(form.startsAt),
              endsAt: fromDateTimeLocal(form.endsAt),
              city: form.city,
              venueName: form.venueName,
              category: form.category,
              isFree: form.isFree,
              priceText: form.priceText,
              ticketUrl: form.ticketUrl,
              organizerName: form.organizerName,
              imageUrl: form.imageUrl,
            },
          }),
        }
      )
      if (res.ok) {
        const data = await res.json()
        toast.success("Događaj kreiran")
        onUpdate?.()
        router.push(`/admin/events/${data.event.id}`)
      } else {
        toast.error("Greška pri kreiranju", { description: await res.text() })
      }
    } finally {
      setBusy(false)
    }
  }

  async function ignoreCandidate() {
    setBusy(true)
    try {
      const res = await authedFetch(
        `/api/admin/event-sources/${candidate.sourceId}/ignore-candidate`,
        {
          method: "POST",
          body: JSON.stringify({ candidateIndex: candidate.candidateIndex }),
        }
      )
      if (res.ok) {
        toast.success("Kandidat ignoriran")
        onUpdate?.()
      } else {
        toast.error("Greška", { description: await res.text() })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className={isIgnored ? "opacity-50" : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">{candidate.title || "—"}</CardTitle>
            {isCreated && candidate._eventId && (
              <Link
                href={`/admin/events/${candidate._eventId}`}
                className="text-xs text-success hover:underline"
              >
                Kreiran → Event #{candidate._eventId}
              </Link>
            )}
            {isIgnored && (
              <span className="text-xs text-muted-foreground">Ignorirano</span>
            )}
            <p className="text-sm text-muted-foreground line-clamp-2">
              {candidate.description}
            </p>
          </div>
          <ConfidenceBadge value={candidate.confidence} />
        </div>

        <div className="mt-1 flex flex-wrap gap-1.5">
          {candidate.isFree ? (
            <Badge variant="secondary" className="rounded-md bg-success/10 text-success">
              Besplatno
            </Badge>
          ) : (
            candidate.priceText && (
              <Badge variant="outline" className="rounded-md font-normal">
                {candidate.priceText}
              </Badge>
            )
          )}
          {candidate.category && (
            <Badge variant="outline" className="rounded-md font-normal">
              {candidate.category}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Naslov">
            <Input value={form.title} disabled={!isPending} onChange={(e) => setField("title", e.target.value)} />
          </Field>
          <Field label="Kategorija">
            <Input value={form.category} disabled={!isPending} onChange={(e) => setField("category", e.target.value)} placeholder="npr. Glazba" />
          </Field>
          <Field label="Početak">
            <Input type="datetime-local" value={form.startsAt} disabled={!isPending} onChange={(e) => setField("startsAt", e.target.value)} />
          </Field>
          <Field label="Završetak">
            <Input type="datetime-local" value={form.endsAt} disabled={!isPending} onChange={(e) => setField("endsAt", e.target.value)} />
          </Field>
          <Field label="Grad">
            <Input value={form.city} disabled={!isPending} onChange={(e) => setField("city", e.target.value)} placeholder="npr. Osijek" />
          </Field>
          <Field label="Lokacija / venue">
            <Input value={form.venueName} disabled={!isPending} onChange={(e) => setField("venueName", e.target.value)} />
          </Field>
          <Field label="Organizator">
            <Input value={form.organizerName} disabled={!isPending} onChange={(e) => setField("organizerName", e.target.value)} />
          </Field>
          <Field label="Cijena">
            <Input value={form.priceText} disabled={!isPending || form.isFree} onChange={(e) => setField("priceText", e.target.value)} placeholder="npr. 8 EUR" />
          </Field>
          <Field label="Ulaznice URL">
            <Input value={form.ticketUrl} disabled={!isPending} onChange={(e) => setField("ticketUrl", e.target.value)} />
          </Field>
          <Field label="Slika URL">
            <Input value={form.imageUrl} disabled={!isPending} onChange={(e) => setField("imageUrl", e.target.value)} />
          </Field>
          <div className="flex items-center gap-2 pt-5">
            <input
              id={`free-${candidate.id}`}
              type="checkbox"
              checked={form.isFree}
              disabled={!isPending}
              onChange={(e) => setField("isFree", e.target.checked)}
              className="size-4 rounded border-border"
            />
            <Label htmlFor={`free-${candidate.id}`} className="text-sm">Besplatno</Label>
          </div>
          <div className="sm:col-span-2">
            <Field label="Opis">
              <Textarea value={form.description} disabled={!isPending} onChange={(e) => setField("description", e.target.value)} rows={4} />
            </Field>
          </div>
        </div>

        {(candidate.missingFields.length > 0 || candidate.warnings.length > 0) && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              {candidate.missingFields.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Nedostaje:
                  </span>
                  {candidate.missingFields.map((f) => (
                    <Badge
                      key={f}
                      variant="secondary"
                      className="rounded-md bg-warning/10 text-warning"
                    >
                      {f}
                    </Badge>
                  ))}
                </div>
              )}
              {candidate.warnings.map((w) => (
                <div
                  key={w}
                  className="flex items-center gap-1.5 text-xs text-destructive"
                >
                  <TriangleAlert className="size-3.5 shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          </>
        )}

        {candidate.sourceUrl && (
          <a
            href={candidate.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            <ExternalLink className="size-3.5" />
            <span className="truncate">{candidate.sourceUrl}</span>
          </a>
        )}
      </CardContent>

      {isPending && (
        <CardFooter className="gap-2">
          <Button onClick={createEvent} disabled={busy || !hasRequired}>
            <CalendarPlus data-icon="inline-start" />
            Kreiraj događaj
          </Button>
          {!hasRequired && (
            <Button variant="outline" disabled>
              Dopuni podatke
            </Button>
          )}
          <Button variant="outline" onClick={ignoreCandidate} disabled={busy}>
            <X data-icon="inline-start" />
            Ignoriraj
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
