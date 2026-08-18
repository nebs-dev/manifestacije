"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Save,
  Check,
  Send,
  X,
  Archive,
  Copy,
  TriangleAlert,
  ExternalLink,
  Repeat,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { formatRelative } from "@/lib/admin/format"

const SOURCE_KIND_LABELS: Record<string, string> = {
  MANUAL: "Ručno kreirao admin",
  ORGANIZER_FORM: "Organizator (putem panela)",
  EMAIL: "Email prijava",
  URL_SUBMISSION: "Automatski (URL / nadzor izvora)",
  IMPORTED: "Uvezeno",
}

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/admin/status-badge"
import { ConfidenceBadge } from "@/components/admin/confidence-badge"
import { authedFetch } from "@/lib/admin/api"
import { EVENT_STATUS_OPTIONS, eventStatusLabel, toApiEventStatus } from "@/lib/admin/status"
import type { AdminEvent, AdminOrganizer } from "@/lib/admin/types"
import { LocationAutocomplete, type LocationValue } from "@/components/ui/location-autocomplete"
import { EventImagePicker, type EventImageValue } from "@/components/admin/event-image-picker"
import { EventScheduleEditor, scheduleRowsFromEvent, scheduleRowsToApi, type ScheduleRow } from "@/components/event-schedule-editor"

export function EventEditForm({
  event,
  onUpdate,
}: {
  event: AdminEvent
  onUpdate?: () => void
}) {
  const [form, setForm] = useState({
    title: event.title,
    slug: event.slug,
    description: event.description,
    isFree: event.isFree,
    isFeatured: event.isFeatured ?? false,
    priceText: event.priceText ?? "",
    ticketUrl: event.ticketUrl ?? "",
    sourceUrl: event.sourceUrl ?? "",
    status: event.status,
    organizerId: event._organizerId ? String(event._organizerId) : "",
    venueName: event.venue ?? "",
  })
  const occurrenceBacked = event.occurrences.length > 0
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>(() => scheduleRowsFromEvent({
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    isAllDay: event.allDay,
    occurrences: event.occurrences,
  }))
  const [image, setImage] = useState<EventImageValue>({
    imageUrl: event.imageUrl ?? "",
  })
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(
    event._categoryIds?.length ? event._categoryIds : (event._categoryId ? [event._categoryId] : [])
  )
  const [location, setLocation] = useState<LocationValue | null>(
    event.lat != null && event.lng != null
      ? { address: event.address ?? event.venue ?? event.city ?? "", lat: event.lat, lng: event.lng, cityName: event.city ?? undefined }
      : null
  )
  const [locationChanged, setLocationChanged] = useState(false)
  const [allCategories, setAllCategories] = useState<{ id: number; name: string; slug: string }[]>([])
  const [organizers, setOrganizers] = useState<AdminOrganizer[]>([])
  const [organizersLoading, setOrganizersLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    authedFetch("/api/admin/categories")
      .then(async (res) => { if (res.ok && alive) setAllCategories(await res.json()) })
      .catch(() => undefined)
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    setOrganizersLoading(true)
    authedFetch("/api/admin/organizers")
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return res.json() as Promise<AdminOrganizer[]>
      })
      .then((data) => {
        if (alive) setOrganizers(data)
      })
      .catch((err) => {
        if (alive) toast.error("Greška pri učitavanju organizatora", { description: err instanceof Error ? err.message : String(err) })
      })
      .finally(() => {
        if (alive) setOrganizersLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const selectedOrganizer = organizers.find((organizer) => String(organizer.id) === form.organizerId)

  async function save(options?: { silent?: boolean; status?: typeof form.status }) {
    setSaving(true)
    try {
      const primaryCategoryId = selectedCategoryIds[0] ?? event._categoryId
      const schedule = scheduleRowsToApi(scheduleRows)
      const first = schedule[0]
      const res = await authedFetch(`/api/admin/events/${event.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: form.title,
          slug: form.slug,
          description: form.description,
          cityId: locationChanged ? undefined : event._cityId,
          cityName: location ? location.cityName : event.city,
          countyName: location?.countyName,
          regionSlug: location?.regionSlug,
          categoryId: primaryCategoryId,
          categoryIds: selectedCategoryIds.length ? selectedCategoryIds : undefined,
          startsAt: first.startsAt,
          endsAt: first.endsAt ?? null,
          isAllDay: first.isAllDay,
          occurrences: occurrenceBacked || scheduleRows.length > 1 ? schedule : undefined,
          isFree: form.isFree,
          isFeatured: form.isFeatured,
          priceText: form.priceText || undefined,
          ticketUrl: form.ticketUrl || undefined,
          sourceUrl: form.sourceUrl || null,
          venueName: form.venueName || undefined,
          address: location?.address || undefined,
          lat: location?.lat,
          lng: location?.lng,
          imageUrl: image.imageUrl || null,
          organizerId: form.organizerId ? Number(form.organizerId) : null,
          status: toApiEventStatus(options?.status ?? form.status),
        }),
      })
      if (res.ok) {
        if (!options?.silent) toast.success("Promjene spremljene", { description: form.title })
        onUpdate?.()
        return true
      } else {
        toast.error("Greška pri spremanju", { description: await res.text() })
        return false
      }
    } catch (error) {
      toast.error("Greška pri spremanju", { description: error instanceof Error ? error.message : String(error) })
      return false
    } finally {
      setSaving(false)
    }
  }

  async function statusAction(action: "approve" | "reject" | "publish" | "archive") {
    if (action === "publish" && !image.imageUrl) {
      toast.warning("Događaj nema sliku", { description: "Objava nije blokirana, ali javne kartice će koristiti fallback sliku." })
    }
    const targetStatus = {
      approve: "published",
      publish: "published",
      reject: "rejected",
      archive: "archived",
    } satisfies Record<typeof action, typeof form.status>
    const ok = await save({ silent: true, status: targetStatus[action] })
    if (ok) {
      update("status", targetStatus[action])
      const labels: Record<string, string> = {
        approve: "Odobreno",
        reject: "Odbijeno",
        publish: "Objavljeno",
        archive: "Arhivirano",
      }
      toast.success(labels[action], { description: form.title })
    }
  }

  const [splitOpen, setSplitOpen] = useState(false)
  const [splitting, setSplitting] = useState(false)
  const [splitForm, setSplitForm] = useState({ firstDate: "", repeatWeeklyUntil: "", startTime: "18:00", endTime: "" })

  async function splitIntoWeeklySeries() {
    if (!splitForm.firstDate || !splitForm.repeatWeeklyUntil || !splitForm.startTime) {
      toast.error("Popuni datum prvog termina, vrijeme i datum do kojeg se ponavlja")
      return
    }
    setSplitting(true)
    try {
      const res = await authedFetch(`/api/admin/events/${event.id}/split-weekly`, {
        method: "POST",
        body: JSON.stringify({
          firstDate: splitForm.firstDate,
          repeatWeeklyUntil: splitForm.repeatWeeklyUntil,
          startTime: splitForm.startTime,
          endTime: splitForm.endTime || undefined,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const result = await res.json() as { _seriesCount: number }
      toast.success(`Kreirano ${result._seriesCount} termina`, { description: "Prvi termin je ovaj isti događaj — ostali su novi." })
      window.location.reload()
    } catch (err) {
      toast.error("Greška pri razdvajanju", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setSplitting(false)
    }
  }

  async function duplicateEvent() {
    setSaving(true)
    try {
      const res = await authedFetch(`/api/admin/events/${event.id}/duplicate`, {
        method: "POST",
      })
      if (res.ok) {
        const duplicated = await res.json() as { id: number }
        toast.success("Događaj dupliciran", { description: form.title })
        window.location.href = `/admin/events/${duplicated.id}`
      } else {
        toast.error("Greška pri dupliciranju", { description: await res.text() })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      id="admin-event-edit-form"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      className="flex flex-col gap-6"
    >
      {event.warnings.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex flex-col gap-1.5 py-1">
            {event.warnings.map((w) => (
              <div
                key={w}
                className="flex items-center gap-2 text-sm text-warning"
              >
                <TriangleAlert className="size-4 shrink-0" />
                {w}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm text-muted-foreground">
          <span>Dodano {formatRelative(event.createdAt)}</span>
          <span className="opacity-40">·</span>
          <span>{SOURCE_KIND_LABELS[event.sourceType ?? ""] ?? "Nepoznat izvor"}</span>
          {event.organizer && (
            <>
              <span className="opacity-40">·</span>
              <span>Organizator: {event.organizer}</span>
            </>
          )}
          {event.sources.length > 0 && (
            <>
              <span className="opacity-40">·</span>
              {event.sources.map((s) => (
                <Link key={s.id} href={`/admin/sources/${s.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                  Pregled izvora <ExternalLink className="size-3" />
                </Link>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Osnovni podaci</CardTitle>
              <CardDescription>Naslov, opis i poveznice.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="title">Naziv</FieldLabel>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="slug">Slug</FieldLabel>
                  <Input
                    id="slug"
                    value={form.slug}
                    onChange={(e) => update("slug", e.target.value)}
                    className="font-mono"
                  />
                  <FieldDescription>
                    Koristi se u javnom URL-u događaja.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="description">Opis</FieldLabel>
                  <Textarea
                    id="description"
                    rows={5}
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Slika</CardTitle>
              <CardDescription>Slika se prikazuje na karticama i stranici događaja.</CardDescription>
            </CardHeader>
            <CardContent>
              <EventImagePicker value={image} onChange={setImage} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vrijeme i lokacija</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Raspored</FieldLabel>
                  <EventScheduleEditor rows={scheduleRows} onChange={setScheduleRows} />
                </Field>
                {!occurrenceBacked && scheduleRows.length === 1 && scheduleRows[0].isAllDay && (
                  <Field className="rounded-lg border border-border p-3">
                    {!splitOpen ? (
                      <button
                        type="button"
                        onClick={() => setSplitOpen(true)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <Repeat className="size-4" />
                        Ovo se zapravo ponavlja svaki tjedan (npr. &ldquo;svakog petka&rdquo;)? Pretvori u seriju termina.
                      </button>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <FieldDescription>
                          Prvi termin postaje ovaj isti događaj (zadržava link), za svaki sljedeći tjedan kreira se novi zaseban događaj.
                        </FieldDescription>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field>
                            <FieldLabel>Datum prvog termina</FieldLabel>
                            <Input type="date" value={splitForm.firstDate} onChange={(e) => setSplitForm((p) => ({ ...p, firstDate: e.target.value }))} />
                          </Field>
                          <Field>
                            <FieldLabel>Ponavlja se do (uključivo)</FieldLabel>
                            <Input type="date" value={splitForm.repeatWeeklyUntil} onChange={(e) => setSplitForm((p) => ({ ...p, repeatWeeklyUntil: e.target.value }))} />
                          </Field>
                          <Field>
                            <FieldLabel>Vrijeme početka</FieldLabel>
                            <Input type="time" value={splitForm.startTime} onChange={(e) => setSplitForm((p) => ({ ...p, startTime: e.target.value }))} />
                          </Field>
                          <Field>
                            <FieldLabel>Vrijeme završetka (opcionalno)</FieldLabel>
                            <Input type="time" value={splitForm.endTime} onChange={(e) => setSplitForm((p) => ({ ...p, endTime: e.target.value }))} />
                          </Field>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" disabled={splitting} onClick={() => void splitIntoWeeklySeries()}>
                            {splitting ? <Loader2 className="size-4 animate-spin" /> : <Repeat className="size-4" />}
                            Podijeli u tjednu seriju
                          </Button>
                          <Button type="button" size="sm" variant="ghost" disabled={splitting} onClick={() => setSplitOpen(false)}>
                            Odustani
                          </Button>
                        </div>
                      </div>
                    )}
                  </Field>
                )}
                <Field>
                  <FieldLabel>Naziv mjesta / dvorane</FieldLabel>
                  <FieldDescription>Kratki naziv lokacije (npr. &ldquo;Galerija Waldinger&rdquo;, &ldquo;HNK Osijek&rdquo;).</FieldDescription>
                  <Input
                    value={form.venueName}
                    onChange={(e) => update("venueName", e.target.value)}
                    placeholder="npr. Galerija Waldinger"
                  />
                </Field>
                <Field>
                  <FieldLabel>Precizna lokacija (koordinate)</FieldLabel>
                  <FieldDescription>Ulica i broj za Google Maps.</FieldDescription>
                  <LocationAutocomplete
                    value={location}
                    onChange={(value) => {
                      setLocation(value)
                      setLocationChanged(true)
                    }}
                    localSuggest={async (q) => {
                      const res = await authedFetch(`/api/admin/venues/search?q=${encodeURIComponent(q)}`)
                      return res.ok ? res.json() : []
                    }}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cijena i poveznice</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field
                  orientation="horizontal"
                  className="items-center justify-between rounded-lg border border-border p-3"
                >
                  <FieldLabel htmlFor="isFeatured" className="mb-0">
                    Izdvojeno (featured)
                  </FieldLabel>
                  <Switch
                    id="isFeatured"
                    checked={form.isFeatured}
                    onCheckedChange={(v) => update("isFeatured", v)}
                  />
                </Field>
                <Field
                  orientation="horizontal"
                  className="items-center justify-between rounded-lg border border-border p-3"
                >
                  <FieldLabel htmlFor="isFree" className="mb-0">
                    Besplatan ulaz
                  </FieldLabel>
                  <Switch
                    id="isFree"
                    checked={form.isFree}
                    onCheckedChange={(v) => update("isFree", v)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="priceText">Cijena (tekst)</FieldLabel>
                  <Input
                    id="priceText"
                    placeholder="npr. od 25 EUR"
                    value={form.priceText}
                    onChange={(e) => update("priceText", e.target.value)}
                    disabled={form.isFree}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ticketUrl">URL ulaznica</FieldLabel>
                  <Input
                    id="ticketUrl"
                    type="url"
                    value={form.ticketUrl}
                    onChange={(e) => update("ticketUrl", e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="sourceUrl">URL izvora</FieldLabel>
                  <Input
                    id="sourceUrl"
                    type="url"
                    value={form.sourceUrl}
                    onChange={(e) => update("sourceUrl", e.target.value)}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Trenutno</span>
                <StatusBadge status={form.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pouzdanost</span>
                <ConfidenceBadge value={event.confidence} />
              </div>
              <Separator />
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="status">Promijeni status</FieldLabel>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      update("status", v as typeof form.status)
                    }
                  >
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue placeholder="Odaberi status">
                        {eventStatusLabel(form.status)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {EVENT_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
              {form.sourceUrl && (
                <a
                  href={form.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" />
                  Otvori izvor
                </a>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Klasifikacija</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Kategorije</FieldLabel>
                  {allCategories.length > 0 ? (
                    <div className="mt-1 flex flex-col gap-1.5">
                      {allCategories.map((cat) => (
                        <label key={cat.id} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedCategoryIds.includes(cat.id)}
                            onChange={() => {
                              setSelectedCategoryIds((prev) =>
                                prev.includes(cat.id)
                                  ? prev.filter((id) => id !== cat.id)
                                  : [cat.id, ...prev]
                              )
                            }}
                            className="size-4 rounded border-input accent-primary"
                          />
                          <span>{cat.name}</span>
                          {selectedCategoryIds[0] === cat.id && (
                            <span className="text-xs text-muted-foreground">(primarna)</span>
                          )}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground pt-1">
                      {event.categories.map((c) => c.name).join(", ") || event.category || "—"}
                    </p>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="organizerId">Organizator</FieldLabel>
                  <Select
                    value={form.organizerId || "none"}
                    onValueChange={(v) => update("organizerId", v === "none" ? "" : String(v ?? ""))}
                  >
                    <SelectTrigger id="organizerId" className="w-full">
                      <SelectValue placeholder="Odaberi organizatora">
                        {selectedOrganizer?.name ?? event.organizer ?? "Bez organizatora"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">Bez organizatora</SelectItem>
                        {organizers.map((organizer) => (
                          <SelectItem key={organizer.id} value={String(organizer.id)}>
                            {organizer.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {organizersLoading && (
                    <FieldDescription>Učitavanje organizatora…</FieldDescription>
                  )}
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-1">
          <Button type="submit" disabled={saving}>
            <Save data-icon="inline-start" />
            {saving ? "Spremanje…" : "Spremi"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={duplicateEvent}
            disabled={saving}
          >
            <Copy data-icon="inline-start" />
            Dupliciraj
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => statusAction("approve")}
          >
            <Check data-icon="inline-start" />
            Odobri
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => statusAction("publish")}
          >
            <Send data-icon="inline-start" />
            Objavi
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => statusAction("archive")}
            >
              <Archive data-icon="inline-start" />
              Arhiviraj
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => statusAction("reject")}
            >
              <X data-icon="inline-start" />
              Odbij
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
