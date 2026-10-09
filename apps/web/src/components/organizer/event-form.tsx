"use client"

import { duplicateCheckInput, useEventDuplicateCheck } from "@/components/event-duplicate-warning"
import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { X } from "lucide-react"
import { API_URL } from "@/lib/api"
import { orgFetch, type Category } from "@/lib/organizer/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LocationAutocomplete, type LocationValue } from "@/components/ui/location-autocomplete"
import { EventImagePicker, type EventImageValue } from "@/components/admin/event-image-picker"
import { EventScheduleEditor, scheduleRowsFromEvent, scheduleRowsToApi, type ScheduleRow } from "@/components/event-schedule-editor"
import { buildOrganizerEventBody, invalidLegacyUrl, organizerUrlError } from "@/lib/organizer/event-form-model"

export type EventData = {
  title?: string
  description?: string
  startsAt?: string
  endsAt?: string
  isAllDay?: boolean
  occurrences?: Array<{ id?: number; startsAt: string; endsAt?: string | null; isAllDay?: boolean }>
  cityId?: number
  cityName?: string
  categoryId?: number
  categoryIds?: number[]
  venueName?: string
  address?: string | null
  lat?: number | null
  lng?: number | null
  isFree?: boolean
  priceText?: string | null
  ticketUrl?: string | null
  sourceUrl?: string | null
  imageUrl?: string | null
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function ClearableInput({ name, value, onChange, placeholder, inputMode, clearLabel }: {
  name: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: "url"
  clearLabel: string
}) {
  return (
    <div className="flex gap-2">
      {/* type="text": type="url" made the browser refuse to submit the whole
          form when a stored legacy value (e.g. "racesmanager") was present. */}
      <Input name={name} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} autoComplete="off" />
      {value && (
        <Button type="button" variant="outline" size="icon" aria-label={clearLabel} title={clearLabel} onClick={() => onChange("")}>
          <X className="size-4" />
        </Button>
      )}
    </div>
  )
}

function LegacyUrlWarning({ value, initial, allowContactLinks = false }: { value: string; initial?: string | null; allowContactLinks?: boolean }) {
  if (!invalidLegacyUrl(value, initial, allowContactLinks)) return null
  return (
    <p className="text-xs text-destructive">
      Spremljena poveznica nije valjana i ne prikazuje se na stranici. Ispravite je ili je obrišite gumbom ×.
    </p>
  )
}

export function OrganizerEventForm({ eventId, initial, published = false }: { eventId?: number; initial?: EventData; published?: boolean }) {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryIds, setCategoryIds] = useState<number[]>(
    initial?.categoryIds?.length ? initial.categoryIds : initial?.categoryId ? [initial.categoryId] : []
  )
  const [isFree, setIsFree] = useState(initial?.isFree ?? false)
  const [location, setLocation] = useState<LocationValue | null>(null)
  const savedAddress = initial?.address ?? initial?.venueName ?? null
  const [image, setImage] = useState<EventImageValue>({
    imageUrl: initial?.imageUrl ?? "",
  })
  const [priceText, setPriceText] = useState(initial?.priceText ?? "")
  const [ticketUrl, setTicketUrl] = useState(initial?.ticketUrl ?? "")
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "")
  const [title, setTitle] = useState(initial?.title || "")
  const [venueName, setVenueName] = useState(initial?.venueName || "")
  const [loading, setLoading] = useState(false)
  const occurrenceBacked = Boolean(initial?.occurrences?.length)
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>(() => scheduleRowsFromEvent({
    startsAt: initial?.startsAt,
    endsAt: initial?.endsAt,
    isAllDay: initial?.isAllDay,
    occurrences: initial?.occurrences,
  }))

  let duplicateInput = null
  try {
    const schedule = scheduleRowsToApi(scheduleRows)
    if (!eventId) duplicateInput = duplicateCheckInput({ title, venueName, cityName: location?.cityName, address: location?.address, sourceUrl,
      ...schedule[0], occurrences: scheduleRows.length > 1 ? schedule : undefined })
  } catch { /* Incomplete schedule. */ }
  const duplicates = useEventDuplicateCheck(duplicateInput, orgFetch, "/api/organizer/duplicates/check")

  useEffect(() => {
    fetch(`${API_URL}/api/public/categories`)
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {})
  }, [])

  function toggleCategory(id: number) {
    setCategoryIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev])
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const primaryCategoryId = categoryIds[0]
    let schedule
    try {
      schedule = scheduleRowsToApi(scheduleRows)
    } catch (error) {
      toast.error("Neispravan raspored", { description: error instanceof Error ? error.message : String(error) })
      setLoading(false)
      return
    }
    const urlError = organizerUrlError({ ticketUrl: isFree ? undefined : ticketUrl, sourceUrl }, initial)
    if (urlError) {
      toast.error("Neispravna poveznica", { description: urlError })
      setLoading(false)
      return
    }
    const body = {
      title: String(form.get("title") || ""),
      description: String(form.get("description") || ""),
      ...buildOrganizerEventBody({
        schedule,
        sendOccurrences: occurrenceBacked || scheduleRows.length > 1,
        isFree,
        priceText,
        ticketUrl,
        sourceUrl,
        imageUrl: image.imageUrl,
      }),
      cityName: location?.cityName || undefined,
      categoryId: primaryCategoryId,
      categoryIds: categoryIds.length ? categoryIds : undefined,
      venueName: String(form.get("venueName") || "") || (eventId && initial?.venueName ? "" : undefined),
      ...(location ? { address: location.address, lat: location.lat || undefined, lng: location.lng || undefined } : {}),
    }
    try {
      if (!eventId && !await duplicates.beforeSave(body)) return
      const res = eventId
        ? await orgFetch(`/api/organizer/events/${eventId}`, { method: "PUT", body: JSON.stringify(body) })
        : await orgFetch("/api/organizer/events", { method: "POST", body: JSON.stringify(body) })
      if (!res.ok) {
        const msg = await res.text()
        toast.error("Greška", { description: msg })
        return
      }
      toast.success(eventId && published ? "Izmjene su poslane na pregled. Trenutačno objavljena verzija ostaje vidljiva." : eventId ? "Event ažuriran" : "Event poslan na pregled")
      router.push("/organizer/events")
    } catch {
      toast.error("Greška pri spajanju na server")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form id="event-form" onInputCapture={duplicates.cancelPending} onChangeCapture={duplicates.cancelPending} onSubmit={submit} className="flex flex-col gap-6">
      {duplicates.warning}
      <Card>
        <CardHeader>
          <CardTitle>Osnovni podaci</CardTitle>
          <CardDescription>{published ? "Izmjene se šalju na pregled. Trenutačno objavljena verzija ostaje vidljiva do odobrenja." : "Podaci su usklađeni s admin unosom."}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Naziv događaja">
            <Input name="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="npr. Jazz večer u Galeriji" />
          </Field>
          <Field label="Opis">
            <Textarea name="description" defaultValue={initial?.description} rows={5} placeholder="Opišite događaj…" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Vrijeme i lokacija</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Raspored">
              <EventScheduleEditor rows={scheduleRows} onChange={setScheduleRows} />
            </Field>
          </div>
          <Field label="Naziv mjesta / dvorane">
            <Input name="venueName" value={venueName} onChange={e => setVenueName(e.target.value)} placeholder="npr. Galerija Waldinger" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Precizna lokacija">
              <LocationAutocomplete
                value={location}
                onChange={setLocation}
                placeholder="Pretraži adresu ili naziv mjesta…"
              />
              {!location && savedAddress && (
                <p className="mt-1 text-xs text-muted-foreground">Trenutno: {savedAddress}</p>
              )}
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Kategorije</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((cat) => (
              <label key={cat.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={categoryIds.includes(cat.id)}
                  onChange={() => toggleCategory(cat.id)}
                  className="size-4 rounded border-input accent-primary"
                />
                <span>{cat.name}</span>
                {categoryIds[0] === cat.id && <span className="text-xs text-muted-foreground">(primarna)</span>}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Slika</CardTitle></CardHeader>
        <CardContent>
          <EventImagePicker
            value={image}
            onChange={setImage}
            hideUrlField
            uploadPath="/api/organizer/uploads/event-image"
            uploadFetch={orgFetch}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ulaznice i cijena</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)}
              className="size-4 rounded border-border accent-primary" />
            Ulaz slobodan / besplatno
          </label>
          {!isFree && (
            <>
              <Field label="Cijena">
                <ClearableInput name="priceText" value={priceText} onChange={setPriceText} placeholder="npr. 10 EUR" clearLabel="Obriši cijenu" />
              </Field>
              <Field label="Link za ulaznice">
                <ClearableInput name="ticketUrl" value={ticketUrl} onChange={setTicketUrl} placeholder="https://…" inputMode="url" clearLabel="Obriši poveznicu za ulaznice" />
                <LegacyUrlWarning value={ticketUrl} initial={initial?.ticketUrl} allowContactLinks />
              </Field>
            </>
          )}
          <Field label="Dodaj poveznicu na događaj">
            <ClearableInput name="sourceUrl" value={sourceUrl} onChange={setSourceUrl} placeholder="https://…" inputMode="url" clearLabel="Obriši poveznicu na događaj" />
            <LegacyUrlWarning value={sourceUrl} initial={initial?.sourceUrl} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Slanje…" : eventId ? "Spremi promjene" : "Pošalji na pregled"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/organizer/events")}>
          Odustani
        </Button>
      </div>
    </form>
  )
}
