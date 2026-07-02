"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { API_URL } from "@/lib/api"
import { orgFetch, type City, type Category } from "@/lib/organizer/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LocationAutocomplete, type LocationValue } from "@/components/ui/location-autocomplete"
import { EventImagePicker, type EventImageValue } from "@/components/admin/event-image-picker"

type EventData = {
  title?: string
  description?: string
  shortDescription?: string
  startsAt?: string
  endsAt?: string
  cityId?: number
  cityName?: string
  categoryId?: number
  categoryIds?: number[]
  venueName?: string
  address?: string | null
  lat?: number | null
  lng?: number | null
  isFree?: boolean
  priceText?: string
  ticketUrl?: string
  sourceUrl?: string
  imageUrl?: string
  imageAlt?: string
  imageCredit?: string
  imageSourceUrl?: string
}

function toLocal(iso?: string) {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export function OrganizerEventForm({ eventId, initial }: { eventId?: number; initial?: EventData }) {
  const router = useRouter()
  const [cities, setCities] = useState<City[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryIds, setCategoryIds] = useState<number[]>(
    initial?.categoryIds?.length ? initial.categoryIds : initial?.categoryId ? [initial.categoryId] : []
  )
  const [isFree, setIsFree] = useState(initial?.isFree ?? false)
  const [location, setLocation] = useState<LocationValue | null>(
    initial?.lat != null && initial?.lng != null
      ? { address: initial.address ?? initial.venueName ?? "", lat: initial.lat, lng: initial.lng }
      : initial?.address ? { address: initial.address, lat: 0, lng: 0 } : null
  )
  const [image, setImage] = useState<EventImageValue>({
    imageUrl: initial?.imageUrl ?? "",
    imageAlt: initial?.imageAlt ?? initial?.title ?? "",
    imageCredit: initial?.imageCredit ?? "",
    imageSourceUrl: initial?.imageSourceUrl ?? "",
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/public/cities`).then((r) => r.json()),
      fetch(`${API_URL}/api/public/categories`).then((r) => r.json()),
    ]).then(([c, cats]) => {
      setCities(c)
      setCategories(cats)
    }).catch(() => {})
  }, [])

  function toggleCategory(id: number) {
    setCategoryIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev])
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const startsAt = String(form.get("startsAt") || "")
    const endsAt = String(form.get("endsAt") || "")
    const cityId = String(form.get("cityId") || "")
    const primaryCategoryId = categoryIds[0]
    const body = {
      title: String(form.get("title") || ""),
      description: String(form.get("description") || ""),
      shortDescription: String(form.get("shortDescription") || "") || undefined,
      startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      cityId: cityId ? Number(cityId) : undefined,
      cityName: String(form.get("cityName") || "") || undefined,
      categoryId: primaryCategoryId,
      categoryIds: categoryIds.length ? categoryIds : undefined,
      venueName: String(form.get("venueName") || "") || undefined,
      address: location?.address || String(form.get("address") || "") || undefined,
      lat: location?.lat || undefined,
      lng: location?.lng || undefined,
      isFree,
      priceText: isFree ? undefined : String(form.get("priceText") || "") || undefined,
      ticketUrl: String(form.get("ticketUrl") || "") || undefined,
      sourceUrl: String(form.get("sourceUrl") || "") || undefined,
      imageUrl: image.imageUrl || undefined,
      imageAlt: image.imageAlt || undefined,
      imageCredit: image.imageCredit || undefined,
      imageSourceUrl: image.imageSourceUrl || undefined,
    }
    try {
      const res = eventId
        ? await orgFetch(`/api/organizer/events/${eventId}`, { method: "PUT", body: JSON.stringify(body) })
        : await orgFetch("/api/organizer/events", { method: "POST", body: JSON.stringify(body) })
      if (!res.ok) {
        const msg = await res.text()
        toast.error("Greška", { description: msg })
        return
      }
      toast.success(eventId ? "Event ažuriran" : "Event poslan na pregled")
      router.push("/organizer/events")
    } catch {
      toast.error("Greška pri spajanju na server")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Osnovni podaci</CardTitle>
          <CardDescription>Podaci su usklađeni s admin unosom.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Naziv događaja">
            <Input name="title" defaultValue={initial?.title} placeholder="npr. Jazz večer u Galeriji" />
          </Field>
          <Field label="Kratki opis">
            <Input name="shortDescription" defaultValue={initial?.shortDescription} />
          </Field>
          <Field label="Opis">
            <Textarea name="description" defaultValue={initial?.description} rows={5} placeholder="Opišite događaj…" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Vrijeme i lokacija</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Početak">
            <Input name="startsAt" type="datetime-local" defaultValue={toLocal(initial?.startsAt)} />
          </Field>
          <Field label="Završetak">
            <Input name="endsAt" type="datetime-local" defaultValue={toLocal(initial?.endsAt)} />
          </Field>
          <Field label="Grad">
            <select name="cityId" defaultValue={initial?.cityId ?? ""}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none ring-ring/40 focus:ring-2">
              <option value="">— Odaberi grad —</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.county.region.name})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Novi grad ako nije na listi">
            <Input name="cityName" defaultValue={initial?.cityName} placeholder="npr. Đurđevac" />
          </Field>
          <Field label="Naziv mjesta / dvorane">
            <Input name="venueName" defaultValue={initial?.venueName} placeholder="npr. Galerija Waldinger" />
          </Field>
          <Field label="Adresa">
            <Input name="address" defaultValue={initial?.address ?? ""} placeholder="npr. Ulica 1" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Precizna lokacija (koordinate)">
              <LocationAutocomplete
                value={location}
                onChange={setLocation}
                placeholder="Pretraži adresu ili naziv mjesta…"
              />
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
            uploadPath="/api/organizer/uploads/event-image"
            uploadFetch={orgFetch}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ulaznice, cijena i izvori</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)}
              className="size-4 rounded border-border accent-primary" />
            Ulaz slobodan / besplatno
          </label>
          <Field label="Cijena">
            <Input name="priceText" defaultValue={initial?.priceText} disabled={isFree} placeholder="npr. 10 EUR" />
          </Field>
          <Field label="Link za ulaznice">
            <Input name="ticketUrl" defaultValue={initial?.ticketUrl} placeholder="https://…" type="url" />
          </Field>
          <Field label="URL izvora">
            <Input name="sourceUrl" defaultValue={initial?.sourceUrl} placeholder="https://…" type="url" />
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
