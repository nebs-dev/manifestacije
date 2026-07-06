"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EventImagePicker, type EventImageValue } from "@/components/admin/event-image-picker"
import { authedFetch } from "@/lib/admin/api"
import { EVENT_STATUS_OPTIONS, toApiEventStatus } from "@/lib/admin/status"
import type { AdminOrganizer, EventStatus } from "@/lib/admin/types"

type Category = { id: number; name: string; slug: string }
type City = { id: number; name: string }
type Region = { counties?: { cities?: City[] }[] }

export function EventCreateForm() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [organizers, setOrganizers] = useState<AdminOrganizer[]>([])
  const [categoryIds, setCategoryIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: "",
    description: "",
    startsAt: "",
    endsAt: "",
    cityId: "",
    cityName: "",
    organizerId: "",
    venueName: "",
    address: "",
    isFree: true,
    priceText: "",
    ticketUrl: "",
    sourceUrl: "",
    status: "draft" as EventStatus,
  })
  const [image, setImage] = useState<EventImageValue>({ imageUrl: "" })

  useEffect(() => {
    let alive = true
    Promise.all([
      authedFetch("/api/admin/categories").then((res) => res.ok ? res.json() : []),
      authedFetch("/api/admin/organizers").then((res) => res.ok ? res.json() : []),
      authedFetch("/api/admin/regions").then((res) => res.ok ? res.json() : []),
    ]).then(([cats, orgs, regions]: [Category[], AdminOrganizer[], Region[]]) => {
      if (!alive) return
      setCategories(cats)
      setOrganizers(orgs)
      setCities(regions.flatMap((region) => region.counties?.flatMap((county) => county.cities || []) || []).sort((a, b) => a.name.localeCompare(b.name, "hr")))
    }).catch(() => undefined)
    return () => { alive = false }
  }, [])

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    const primaryCategoryId = categoryIds[0]
    setSaving(true)
    try {
      const res = await authedFetch("/api/admin/events", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          cityId: form.cityId ? Number(form.cityId) : undefined,
          cityName: form.cityName || undefined,
          categoryId: primaryCategoryId,
          categoryIds: categoryIds.length ? categoryIds : undefined,
          organizerId: form.organizerId ? Number(form.organizerId) : null,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
          venueName: form.venueName || undefined,
          address: form.address || undefined,
          isFree: form.isFree,
          priceText: form.priceText || undefined,
          ticketUrl: form.ticketUrl || undefined,
          sourceUrl: form.sourceUrl || undefined,
          status: toApiEventStatus(form.status),
          imageUrl: image.imageUrl || undefined,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const event = await res.json() as { id: number }
      toast.success("Događaj kreiran", { action: { label: "Otvori", onClick: () => router.push(`/admin/events/${event.id}`) } })
    } catch (err) {
      toast.error("Greška pri kreiranju", { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save() }} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Osnovni podaci</CardTitle>
            <CardDescription>Slika nije obavezna za skicu.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field><FieldLabel>Naziv</FieldLabel><Input value={form.title} onChange={(e) => update("title", e.target.value)} /></Field>
              <Field><FieldLabel>Opis</FieldLabel><Textarea rows={5} value={form.description} onChange={(e) => update("description", e.target.value)} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field><FieldLabel>Početak</FieldLabel><Input type="datetime-local" value={form.startsAt} onChange={(e) => update("startsAt", e.target.value)} /></Field>
                <Field><FieldLabel>Završetak</FieldLabel><Input type="datetime-local" value={form.endsAt} onChange={(e) => update("endsAt", e.target.value)} /></Field>
              </div>
              <Field>
                <FieldLabel>Grad</FieldLabel>
                <Select value={form.cityId || "none"} onValueChange={(v) => update("cityId", v === "none" ? "" : String(v ?? ""))}>
                  <SelectTrigger><SelectValue placeholder="Odaberi grad" /></SelectTrigger>
                  <SelectContent><SelectGroup><SelectItem value="none">Odaberi grad</SelectItem>{cities.map((city) => <SelectItem key={city.id} value={String(city.id)}>{city.name}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field><FieldLabel>Novi grad ako nije na listi</FieldLabel><Input value={form.cityName} onChange={(e) => update("cityName", e.target.value)} placeholder="npr. Đurđevac" /></Field>
              <Field><FieldLabel>Lokacija / venue</FieldLabel><Input value={form.venueName} onChange={(e) => update("venueName", e.target.value)} /></Field>
              <Field><FieldLabel>Adresa</FieldLabel><Input value={form.address} onChange={(e) => update("address", e.target.value)} /></Field>
            </FieldGroup>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Slika</CardTitle></CardHeader>
          <CardContent><EventImagePicker value={image} onChange={setImage} /></CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader><CardTitle>Klasifikacija</CardTitle></CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Kategorije</FieldLabel>
                <div className="flex flex-col gap-1.5">
                  {categories.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={categoryIds.includes(cat.id)} onChange={() => setCategoryIds((prev) => prev.includes(cat.id) ? prev.filter((id) => id !== cat.id) : [...prev, cat.id])} className="size-4 rounded border-input accent-primary" />
                      <span>{cat.name}</span>
                      {categoryIds[0] === cat.id && <span className="text-xs text-muted-foreground">(primarna)</span>}
                    </label>
                  ))}
                </div>
              </Field>
              <Field>
                <FieldLabel>Organizator</FieldLabel>
                <Select value={form.organizerId || "none"} onValueChange={(v) => update("organizerId", v === "none" ? "" : String(v ?? ""))}>
                  <SelectTrigger><SelectValue placeholder="Odaberi organizatora" /></SelectTrigger>
                  <SelectContent><SelectGroup><SelectItem value="none">Bez organizatora</SelectItem>{organizers.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Select value={form.status} onValueChange={(v) => update("status", String(v ?? "draft") as EventStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup>{EVENT_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Cijena i poveznice</CardTitle></CardHeader>
          <CardContent>
            <FieldGroup>
              <Field orientation="horizontal" className="items-center justify-between rounded-lg border border-border p-3">
                <FieldLabel className="mb-0">Besplatan ulaz</FieldLabel>
                <Switch checked={form.isFree} onCheckedChange={(v) => update("isFree", v)} />
              </Field>
              <Field><FieldLabel>Cijena</FieldLabel><Input value={form.priceText} disabled={form.isFree} onChange={(e) => update("priceText", e.target.value)} /></Field>
              <Field><FieldLabel>URL ulaznica</FieldLabel><Input value={form.ticketUrl} onChange={(e) => update("ticketUrl", e.target.value)} /></Field>
              <Field><FieldLabel>URL izvora</FieldLabel><Input value={form.sourceUrl} onChange={(e) => update("sourceUrl", e.target.value)} /></Field>
              <Button type="submit" disabled={saving}><Save data-icon="inline-start" />{saving ? "Spremanje…" : "Kreiraj događaj"}</Button>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
    </form>
  )
}
