"use client"

import { useState } from "react"
import {
  Save,
  Check,
  Send,
  X,
  Archive,
  TriangleAlert,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"

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
import type { AdminEvent } from "@/lib/admin/types"

const statusLabels: Record<AdminEvent["status"], string> = {
  draft: "Skica",
  pending: "Na čekanju",
  approved: "Odobreno",
  published: "Objavljeno",
  rejected: "Odbijeno",
  archived: "Arhivirano",
}

const CATEGORIES = [
  "Glazba", "Sport", "Kultura", "Hrana i vino", "Zabava",
  "Djeca i obitelj", "Edukacija", "Outdoor", "Festivali",
  "Radionice", "Sajmovi", "Tradicija i folklor", "Humanitarno", "Ostalo",
]

function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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
    shortDescription: event.shortDescription,
    startsAt: toLocalInput(event.startsAt),
    endsAt: toLocalInput(event.endsAt),
    allDay: event.allDay,
    isFree: event.isFree,
    priceText: event.priceText ?? "",
    ticketUrl: event.ticketUrl ?? "",
    sourceUrl: event.sourceUrl ?? "",
    status: event.status,
  })
  const [saving, setSaving] = useState(false)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await authedFetch(`/api/admin/events/${event.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          shortDescription: form.shortDescription || undefined,
          cityId: event._cityId,
          categoryId: event._categoryId,
          startsAt: form.startsAt || undefined,
          endsAt: form.endsAt || undefined,
          isAllDay: form.allDay,
          isFree: form.isFree,
          priceText: form.priceText || undefined,
          ticketUrl: form.ticketUrl || undefined,
          sourceUrl: form.sourceUrl || undefined,
          status: form.status.toUpperCase() === "PENDING_REVIEW"
            ? "PENDING_REVIEW"
            : form.status.toUpperCase(),
        }),
      })
      if (res.ok) {
        toast.success("Promjene spremljene", { description: form.title })
        onUpdate?.()
      } else {
        toast.error("Greška pri spremanju", { description: await res.text() })
      }
    } finally {
      setSaving(false)
    }
  }

  async function statusAction(action: "approve" | "reject" | "publish" | "archive") {
    const res = await authedFetch(`/api/admin/events/${event.id}/${action}`, {
      method: "POST",
    })
    if (res.ok) {
      const labels: Record<string, string> = {
        approve: "Odobreno",
        reject: "Odbijeno",
        publish: "Objavljeno",
        archive: "Arhivirano",
      }
      toast.success(labels[action], { description: form.title })
      onUpdate?.()
    } else {
      toast.error("Greška", { description: await res.text() })
    }
  }

  return (
    <form
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
                  <FieldLabel htmlFor="shortDescription">Kratki opis</FieldLabel>
                  <Input
                    id="shortDescription"
                    value={form.shortDescription}
                    onChange={(e) => update("shortDescription", e.target.value)}
                  />
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
              <CardTitle>Vrijeme i lokacija</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field orientation="responsive">
                  <Field>
                    <FieldLabel htmlFor="startsAt">Početak</FieldLabel>
                    <Input
                      id="startsAt"
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(e) => update("startsAt", e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="endsAt">Završetak</FieldLabel>
                    <Input
                      id="endsAt"
                      type="datetime-local"
                      value={form.endsAt}
                      onChange={(e) => update("endsAt", e.target.value)}
                    />
                  </Field>
                </Field>
                <Field
                  orientation="horizontal"
                  className="items-center justify-between rounded-lg border border-border p-3"
                >
                  <FieldLabel htmlFor="allDay" className="mb-0">
                    Cjelodnevni događaj
                  </FieldLabel>
                  <Switch
                    id="allDay"
                    checked={form.allDay}
                    onCheckedChange={(v) => update("allDay", v)}
                  />
                </Field>
                {(event.city || event.venue) && (
                  <Field orientation="responsive">
                    {event.city && (
                      <Field>
                        <FieldLabel>Grad</FieldLabel>
                        <p className="text-sm text-muted-foreground pt-1">
                          {event.city}
                        </p>
                      </Field>
                    )}
                    {event.venue && (
                      <Field>
                        <FieldLabel>Mjesto / dvorana</FieldLabel>
                        <p className="text-sm text-muted-foreground pt-1">
                          {event.venue}
                        </p>
                      </Field>
                    )}
                  </Field>
                )}
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
                      <SelectValue placeholder="Odaberi status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="draft">Skica</SelectItem>
                        <SelectItem value="pending">Na čekanju</SelectItem>
                        <SelectItem value="approved">Odobreno</SelectItem>
                        <SelectItem value="published">Objavljeno</SelectItem>
                        <SelectItem value="rejected">Odbijeno</SelectItem>
                        <SelectItem value="archived">Arhivirano</SelectItem>
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
                  <FieldLabel>Kategorija</FieldLabel>
                  <p className="text-sm text-muted-foreground pt-1">
                    {event.category ?? "—"}
                  </p>
                </Field>
                <Field>
                  <FieldLabel>Organizator</FieldLabel>
                  <p className="text-sm text-muted-foreground pt-1">
                    {event.organizer ?? "—"}
                  </p>
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
