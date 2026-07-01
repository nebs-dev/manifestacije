"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Link2, Plus, Sparkles } from "lucide-react"
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
import { authedFetch } from "@/lib/admin/api"

function isFacebookUrl(url: string) {
  try { return new URL(url).hostname.replace("www.", "").startsWith("facebook.com") }
  catch { return false }
}

export function ParseUrlForm({ onParsed }: { onParsed?: (id: number) => void }) {
  const router = useRouter()
  const [sourceUrl, setSourceUrl] = useState("")
  const [useLlm, setUseLlm] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleUrlChange(val: string) {
    setSourceUrl(val)
    if (isFacebookUrl(val)) setUseLlm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!sourceUrl.trim()) {
      toast.error("Unesite URL izvora.")
      return
    }
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/event-sources/parse-url", {
        method: "POST",
        body: JSON.stringify({ sourceUrl, useLlm }),
      })
      if (!res.ok) {
        toast.error("Parsiranje neuspješno", { description: await res.text() })
        return
      }
      const data = await res.json()
      toast.success("Parsiranje završeno", { description: sourceUrl })
      setSourceUrl("")
      setUseLlm(false)
      if (onParsed) {
        onParsed(data.id)
      } else {
        router.push(`/admin/sources/${data.id}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const facebook = isFacebookUrl(sourceUrl)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parsiraj URL</CardTitle>
        <CardDescription>
          Automatski izvuci događaje s web stranice.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="parse-url">URL izvora</FieldLabel>
              <Input
                id="parse-url"
                type="url"
                inputMode="url"
                placeholder="https://primjer.hr/dogadanja"
                value={sourceUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                disabled={loading}
              />
              <FieldDescription>
                Zalijepite URL turističke zajednice, organizatora, portala ili
                stranice događaja.
              </FieldDescription>
            </Field>

            <Field orientation="horizontal" className="items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
                <input
                  type="checkbox"
                  checked={useLlm}
                  onChange={(e) => setUseLlm(e.target.checked)}
                  disabled={loading || facebook}
                  className="accent-primary size-4 rounded"
                />
                <Sparkles className="size-3.5 text-primary/70" />
                AI parser (Claude)
              </label>
              {facebook && (
                <p className="text-xs text-amber-600">
                  Facebook blokira automatsko dohvaćanje — kopiraj tekst događanja i zalijepi ga u Ručni unos ispod.
                </p>
              )}
            </Field>

            <Field orientation="horizontal" className="justify-end">
              <Button type="submit" disabled={loading || facebook}>
                <Link2 data-icon="inline-start" />
                {loading ? "Parsiranje…" : "Parsiraj URL"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

export function ManualSourceForm({ onCreated }: { onCreated?: () => void }) {
  const [form, setForm] = useState({
    subject: "",
    from: "",
    sourceUrl: "",
    rawText: "",
  })
  const [useLlm, setUseLlm] = useState(false)
  const [loading, setLoading] = useState(false)

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.rawText.trim()) {
      toast.error("Tekst izvora je obavezan.")
      return
    }
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/event-sources/manual-email", {
        method: "POST",
        body: JSON.stringify({
          rawEmailSubject: form.subject || undefined,
          rawEmailFrom: form.from || undefined,
          sourceUrl: form.sourceUrl || undefined,
          rawText: form.rawText,
          useLlm,
        }),
      })
      if (!res.ok) {
        toast.error("Kreiranje neuspješno", { description: await res.text() })
        return
      }
      toast.success("Izvor kreiran", { description: form.subject || "Ručni unos" })
      setForm({ subject: "", from: "", sourceUrl: "", rawText: "" })
      setUseLlm(false)
      onCreated?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ručni unos</CardTitle>
        <CardDescription>
          Zalijepite tekst događanja za parsiranje. Koristite AI parser za Facebook eventi i ostale kompleksne formate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field orientation="responsive">
              <Field>
                <FieldLabel htmlFor="ms-subject">Predmet</FieldLabel>
                <Input
                  id="ms-subject"
                  placeholder="npr. Ljetni program – TZ Rovinj"
                  value={form.subject}
                  onChange={(e) => update("subject", e.target.value)}
                  disabled={loading}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ms-from">Pošiljatelj</FieldLabel>
                <Input
                  id="ms-from"
                  placeholder="ime@organizator.hr"
                  value={form.from}
                  onChange={(e) => update("from", e.target.value)}
                  disabled={loading}
                />
              </Field>
            </Field>
            <Field>
              <FieldLabel htmlFor="ms-url">URL izvora</FieldLabel>
              <Input
                id="ms-url"
                type="url"
                placeholder="https://primjer.hr/dogadanja (opcionalno)"
                value={form.sourceUrl}
                onChange={(e) => update("sourceUrl", e.target.value)}
                disabled={loading}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ms-raw">Tekst događanja</FieldLabel>
              <Textarea
                id="ms-raw"
                rows={6}
                placeholder="Zalijepite tekst Facebook eventi, e-maila, opisa događaja…"
                value={form.rawText}
                onChange={(e) => update("rawText", e.target.value)}
                disabled={loading}
              />
            </Field>

            <Field orientation="horizontal" className="items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
                <input
                  type="checkbox"
                  checked={useLlm}
                  onChange={(e) => setUseLlm(e.target.checked)}
                  disabled={loading}
                  className="accent-primary size-4 rounded"
                />
                <Sparkles className="size-3.5 text-primary/70" />
                AI parser (Claude) — preporučeno za Facebook i nestrukturirani tekst
              </label>
              <Button type="submit" disabled={loading}>
                <Plus data-icon="inline-start" />
                {loading ? "Kreiranje…" : "Kreiraj izvor"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
