"use client"

import { useState, type FormEvent } from "react"
import { Link2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { authedFetch } from "@/lib/admin/api"
import type { MonitoredSourceType } from "@/lib/admin/types"

const SOURCE_TYPE_OPTIONS: { value: MonitoredSourceType; label: string }[] = [
  { value: "LISTING_PAGE", label: "Listing stranica (više događaja)" },
  { value: "EVENT_PAGE", label: "Stranica jednog događaja" },
]

export function AddMonitoredSourceForm({ onCreated }: { onCreated?: () => void }) {
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [sourceType, setSourceType] = useState<MonitoredSourceType>("LISTING_PAGE")
  const [checkIntervalDays, setCheckIntervalDays] = useState("1")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !url.trim()) { toast.error("Naziv i URL su obavezni."); return }
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/monitored-sources", {
        method: "POST",
        body: JSON.stringify({
          name,
          url,
          sourceType,
          checkIntervalMinutes: (Number(checkIntervalDays) || 1) * 1440,
        }),
      })
      if (!res.ok) { toast.error("Dodavanje neuspješno", { description: await res.text() }); return }
      toast.success("Izvor dodan u nadzor")
      setName("")
      setUrl("")
      setSourceType("LISTING_PAGE")
      setCheckIntervalDays("1")
      onCreated?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dodaj izvor za nadzor</CardTitle>
        <CardDescription>Stranica će se periodički provjeravati na nove ili promijenjene događaje.</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="admin-monitored-source-form" onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ms-name">Naziv</FieldLabel>
              <Input
                id="ms-name"
                placeholder="npr. TZ Osijek — događanja"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ms-source-url">URL</FieldLabel>
              <Input
                id="ms-source-url"
                type="url"
                placeholder="https://primjer.hr/dogadanja"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
              />
            </Field>
            <Field>
              <FieldLabel>Tip izvora</FieldLabel>
              <Select value={sourceType} onValueChange={(v) => setSourceType(v as MonitoredSourceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SOURCE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="ms-interval">Provjera svakih (dana)</FieldLabel>
              <Input
                id="ms-interval"
                type="number"
                min={1}
                step={1}
                value={checkIntervalDays}
                onChange={(e) => setCheckIntervalDays(e.target.value)}
                disabled={loading}
              />
              <FieldDescription>Rijetko treba češće od jednom dnevno.</FieldDescription>
            </Field>
            <Field orientation="horizontal" className="justify-end">
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Link2 data-icon="inline-start" />}
                {loading ? "Dodavanje…" : "Dodaj izvor"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
