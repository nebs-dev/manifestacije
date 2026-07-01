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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type EventData = {
  title?: string
  description?: string
  startsAt?: string
  endsAt?: string
  cityId?: number
  categoryId?: number
  venueName?: string
  isFree?: boolean
  priceText?: string
  ticketUrl?: string
  imageUrl?: string
}

function toLocal(iso?: string) {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function OrganizerEventForm({ eventId, initial }: { eventId?: number; initial?: EventData }) {
  const router = useRouter()
  const [cities, setCities] = useState<City[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isFree, setIsFree] = useState(initial?.isFree ?? false)
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

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const body = {
      title: form.get("title") as string,
      description: form.get("description") as string,
      startsAt: new Date(form.get("startsAt") as string).toISOString(),
      endsAt: form.get("endsAt") ? new Date(form.get("endsAt") as string).toISOString() : undefined,
      cityId: Number(form.get("cityId")),
      categoryId: Number(form.get("categoryId")),
      venueName: (form.get("venueName") as string) || undefined,
      isFree,
      priceText: isFree ? undefined : (form.get("priceText") as string) || undefined,
      ticketUrl: (form.get("ticketUrl") as string) || undefined,
      imageUrl: (form.get("imageUrl") as string) || undefined,
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
        <CardHeader><CardTitle>Osnovni podaci</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Naziv događaja *</Label>
            <Input name="title" defaultValue={initial?.title} required placeholder="npr. Jazz večer u Galeriji" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Opis *</Label>
            <Textarea name="description" defaultValue={initial?.description} required rows={5} placeholder="Opišite događaj…" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Slika (URL)</Label>
            <Input name="imageUrl" defaultValue={initial?.imageUrl ?? ""} placeholder="https://…" type="url" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Vrijeme i lokacija</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Početak *</Label>
            <Input name="startsAt" type="datetime-local" defaultValue={toLocal(initial?.startsAt)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Završetak</Label>
            <Input name="endsAt" type="datetime-local" defaultValue={toLocal(initial?.endsAt)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Grad *</Label>
            <select name="cityId" required defaultValue={initial?.cityId}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none ring-ring/40 focus:ring-2">
              <option value="">— Odaberi grad —</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.county.region.name})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Kategorija *</Label>
            <select name="categoryId" required defaultValue={initial?.categoryId}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none ring-ring/40 focus:ring-2">
              <option value="">— Odaberi kategoriju —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Naziv mjesta / dvorane</Label>
            <Input name="venueName" defaultValue={initial?.venueName} placeholder="npr. Galerija Waldinger" />
          </div>
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
            <div className="flex flex-col gap-1.5">
              <Label>Cijena</Label>
              <Input name="priceText" defaultValue={initial?.priceText} placeholder="npr. 10 EUR" />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Link za ulaznice</Label>
            <Input name="ticketUrl" defaultValue={initial?.ticketUrl} placeholder="https://…" type="url" />
          </div>
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
