"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarPlus,
  X,
  ExternalLink,
  TriangleAlert,
  ChevronDown,
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
import { LocationAutocomplete, type LocationValue } from "@/components/ui/location-autocomplete"
import { EventImagePicker, type EventImageValue } from "@/components/admin/event-image-picker"

type BackendCategory = { id: number; name: string; slug: string }

type CandidateForm = {
  title: string
  description: string
  startsAt: string
  endsAt: string
  isAllDay: boolean
  city: string
  venueName: string
  isFree: boolean
  priceText: string
  ticketUrl: string
  organizerName: string
  sourceUrl: string
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

function slugToId(slug: string, cats: BackendCategory[]): number | undefined {
  return cats.find((c) => c.slug === slug || c.name.toLowerCase() === slug.toLowerCase())?.id
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
  const [allCategories, setAllCategories] = useState<BackendCategory[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  const [location, setLocation] = useState<LocationValue | null>(null)

  const [form, setForm] = useState<CandidateForm>(() => ({
    title: candidate.title || "",
    description: candidate.description || "",
    startsAt: toDateTimeLocal(candidate.startsAt),
    endsAt: toDateTimeLocal(candidate.endsAt),
    isAllDay: candidate.isAllDay ?? false,
    city: candidate.city || "",
    venueName: candidate.venueName || "",
    isFree: candidate.isFree,
    priceText: candidate.priceText || "",
    ticketUrl: candidate.ticketUrl || "",
    organizerName: candidate.organizerName || "",
    sourceUrl: candidate.sourceUrl || "",
  }))
  const [image, setImage] = useState<EventImageValue>({
    imageUrl: candidate.imageUrl || "",
  })

  useEffect(() => {
    let alive = true
    authedFetch("/api/admin/categories")
      .then(async (res) => {
        if (!res.ok || !alive) return
        const cats = (await res.json()) as BackendCategory[]
        if (!alive) return
        setAllCategories(cats)
        const initial: number[] = []
        if (candidate.category) {
          const id = slugToId(candidate.category, cats)
          if (id) initial.push(id)
        }
        if (initial.length > 0) setSelectedCategoryIds(initial)
      })
      .catch(() => undefined)
    return () => { alive = false }
  }, [candidate.category])

  const isCreated = candidate._status === "created"
  const isIgnored = candidate._status === "ignored"
  const isPending = !isCreated && !isIgnored
  const [open, setOpen] = useState(false)

  const liveMissingFields = [
    !form.title.trim() && "title",
    !form.startsAt.trim() && "startsAt",
    !form.city.trim() && "city",
    selectedCategoryIds.length === 0 && "category",
  ].filter(Boolean) as string[]

  const liveWarnings = candidate.warnings.filter((w) => {
    if (selectedCategoryIds.length > 0 && /kategorij/i.test(w)) return false
    if (form.city.trim() && /grad/i.test(w)) return false
    return true
  })

  function setField<K extends keyof CandidateForm>(key: K, value: CandidateForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function toggleCategory(id: number) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]
    )
  }

  async function createEvent(publish = false) {
    setBusy(true)
    try {
      const primaryCategoryId = selectedCategoryIds[0]
      const res = await authedFetch(
        `/api/admin/event-sources/${candidate.sourceId}/create-event`,
        {
          method: "POST",
          body: JSON.stringify({
            candidateIndex: candidate.candidateIndex,
            publish,
            candidate: {
              title: form.title,
              description: form.description,
              startsAt: fromDateTimeLocal(form.startsAt),
              endsAt: fromDateTimeLocal(form.endsAt),
              isAllDay: form.isAllDay,
              city: form.city,
              venueName: form.venueName,
              address: location?.address,
              lat: location?.lat,
              lng: location?.lng,
              category: allCategories.find((c) => c.id === primaryCategoryId)?.slug || candidate.category,
              categoryIds: selectedCategoryIds,
              isFree: form.isFree,
              priceText: form.priceText,
              ticketUrl: form.ticketUrl,
              organizerName: form.organizerName,
              imageUrl: image.imageUrl,
              // null explicitly clears the source URL instead of falling back
              // to the parent source's URL — see admin.service.ts.
              sourceUrl: form.sourceUrl.trim() || null,
            },
          }),
        }
      )
      if (res.ok) {
        const data = await res.json()
        toast.success(publish ? "Događaj kreiran i objavljen" : "Događaj kreiran", {
          action: { label: "Otvori", onClick: () => router.push(`/admin/events/${data.event.id}`) },
        })
        onUpdate?.()
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

  const summaryParts = [
    form.startsAt ? new Date(form.startsAt).toLocaleDateString("hr") : null,
    form.city || null,
    candidate.category || null,
  ].filter(Boolean).join(" · ")

  return (
    <Card className={isIgnored ? "opacity-50" : undefined}>
      {/* Collapsed header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors rounded-t-xl"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm leading-snug">{candidate.title || "—"}</span>
            {isCreated && candidate._eventId && (
              <span className="text-xs text-success">✓ Event #{candidate._eventId}</span>
            )}
            {isIgnored && <span className="text-xs text-muted-foreground">Ignorirano</span>}
            {liveMissingFields.length > 0 && (
              <span className="text-xs text-warning">nedostaje: {liveMissingFields.join(", ")}</span>
            )}
          </div>
          {summaryParts && (
            <p className="text-xs text-muted-foreground mt-0.5">{summaryParts}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ConfidenceBadge value={candidate.confidence} />
          <ChevronDown className={["size-4 text-muted-foreground transition-transform", open ? "rotate-180" : ""].join(" ")} />
        </div>
      </button>

      {/* Expanded body */}
      {open && <>
      <Separator />
      <CardContent className="flex flex-col gap-4 pt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Naslov">
            <Input value={form.title} disabled={!isPending} onChange={(e) => setField("title", e.target.value)} />
          </Field>
          <Field label="Početak">
            <Input type="datetime-local" value={form.startsAt} disabled={!isPending} onChange={(e) => setField("startsAt", e.target.value)} />
          </Field>
          <Field label="Završetak">
            <Input type="datetime-local" value={form.endsAt} disabled={!isPending} onChange={(e) => setField("endsAt", e.target.value)} />
          </Field>
          <div className="flex items-center gap-2 pt-5">
            <input
              id={`allday-${candidate.id}`}
              type="checkbox"
              checked={form.isAllDay}
              disabled={!isPending}
              onChange={(e) => setField("isAllDay", e.target.checked)}
              className="size-4 rounded border-border"
            />
            <Label htmlFor={`allday-${candidate.id}`} className="text-sm">Cjelodnevni događaj</Label>
          </div>
          <Field label="Grad">
            <Input value={form.city} disabled={!isPending} onChange={(e) => setField("city", e.target.value)} placeholder="npr. Osijek" />
          </Field>
          <Field label="Lokacija / venue">
            <Input value={form.venueName} disabled={!isPending} onChange={(e) => setField("venueName", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Precizna lokacija (koordinate)">
              <LocationAutocomplete
                value={location}
                onChange={setLocation}
                disabled={!isPending}
                placeholder="Pretraži adresu ili naziv mjesta…"
                localSuggest={async (q) => {
                  const res = await authedFetch(`/api/admin/venues/search?q=${encodeURIComponent(q)}`)
                  return res.ok ? res.json() : []
                }}
              />
            </Field>
          </div>
          <Field label="Organizator">
            <Input value={form.organizerName} disabled={!isPending} onChange={(e) => setField("organizerName", e.target.value)} />
          </Field>
          <Field label="Cijena">
            <Input value={form.priceText} disabled={!isPending || form.isFree} onChange={(e) => setField("priceText", e.target.value)} placeholder="npr. 8 EUR" />
          </Field>
          <Field label="Ulaznice URL">
            <Input value={form.ticketUrl} disabled={!isPending} onChange={(e) => setField("ticketUrl", e.target.value)} />
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
              <Textarea value={form.description} disabled={!isPending} onChange={(e) => setField("description", e.target.value)} rows={3} />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl border border-border p-3">
          <EventImagePicker
            value={image}
            onChange={setImage}
            disabled={!isPending}
            suggestedImageUrl={candidate.imageUrl}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Kategorije</Label>
          {allCategories.length > 0 ? (
            <div className="grid grid-cols-2 gap-1">
              {allCategories.map((cat) => (
                <label key={cat.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.includes(cat.id)}
                    disabled={!isPending}
                    onChange={() => toggleCategory(cat.id)}
                    className="size-4 rounded border-border accent-primary"
                  />
                  <span>{cat.name}</span>
                  {selectedCategoryIds[0] === cat.id && (
                    <span className="text-xs text-muted-foreground">(primarna)</span>
                  )}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{candidate.category || "—"}</p>
          )}
        </div>

        {(liveMissingFields.length > 0 || liveWarnings.length > 0) && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              {liveMissingFields.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Nedostaje:
                  </span>
                  {liveMissingFields.map((f) => (
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
              {liveWarnings.map((w) => (
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

        <Field label="URL izvora">
          <div className="flex items-center gap-2">
            <Input
              value={form.sourceUrl}
              disabled={!isPending}
              onChange={(e) => setField("sourceUrl", e.target.value)}
              placeholder="https://…"
            />
            {form.sourceUrl && (
              <Button
                variant="outline"
                size="icon"
                nativeButton={false}
                render={<a href={form.sourceUrl} target="_blank" rel="noreferrer" aria-label="Otvori URL izvora" />}
              >
                <ExternalLink className="size-4" />
              </Button>
            )}
          </div>
        </Field>
      </CardContent>

      {isPending && (
        <CardFooter className="gap-2 flex-wrap">
          <Button onClick={() => createEvent(false)} disabled={busy}>
            <CalendarPlus data-icon="inline-start" />
            Kreiraj događaj
          </Button>
          <Button variant="outline" onClick={() => createEvent(true)} disabled={busy}>
            <CalendarPlus data-icon="inline-start" />
            Kreiraj i objavi
          </Button>
          <Button variant="outline" onClick={ignoreCandidate} disabled={busy} className="ml-auto">
            <X data-icon="inline-start" />
            Ignoriraj
          </Button>
        </CardFooter>
      )}
      </>}
    </Card>
  )
}
