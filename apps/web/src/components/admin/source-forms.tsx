"use client"

import { useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ImagePlus, Link2, Plus, Sparkles, X } from "lucide-react"
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

async function resizeToBase64(file: File, maxWidth = 1600): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const dataUrl = canvas.toDataURL("image/jpeg", 0.88)
      resolve({ data: dataUrl.split(",")[1], mediaType: "image/jpeg" })
    }
    img.onerror = reject
    img.src = url
  })
}

export function ManualSourceForm({ onCreated }: { onCreated?: () => void }) {
  const [form, setForm] = useState({ subject: "", from: "", sourceUrl: "", rawText: "", contextHint: "" })
  const [useLlm, setUseLlm] = useState(false)
  const [screenshot, setScreenshot] = useState<{ data: string; mediaType: string; name: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleScreenshot(file: File) {
    const resized = await resizeToBase64(file)
    setScreenshot({ ...resized, name: file.name })
    setUseLlm(true)
  }

  function handlePaste(e: React.ClipboardEvent) {
    const imageItem = Array.from(e.clipboardData.items).find((item) => item.type.startsWith("image/"))
    if (!imageItem) return
    const file = imageItem.getAsFile()
    if (!file) return
    e.preventDefault()
    void handleScreenshot(file)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.rawText.trim() && !screenshot) {
      toast.error("Potreban je tekst ili screenshot događanja.")
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
          rawText: form.rawText || undefined,
          screenshotBase64: screenshot?.data,
          screenshotMediaType: screenshot?.mediaType,
          contextHint: form.contextHint || undefined,
          useLlm,
        }),
      })
      if (!res.ok) {
        toast.error("Kreiranje neuspješno", { description: await res.text() })
        return
      }
      toast.success("Izvor kreiran", { description: form.subject || "Ručni unos" })
      setForm({ subject: "", from: "", sourceUrl: "", rawText: "", contextHint: "" })
      setUseLlm(false)
      setScreenshot(null)
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
        <form onSubmit={handleSubmit} onPaste={handlePaste}>
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
              <FieldLabel htmlFor="ms-hint">Kontekst (opcionalno)</FieldLabel>
              <Input
                id="ms-hint"
                placeholder="npr. Osijek, OLJK 2026 — sve lokacije su u Osijeku"
                value={form.contextHint}
                onChange={(e) => update("contextHint", e.target.value)}
                disabled={loading}
              />
              <FieldDescription>
                Pomozi AI parseru: grad, festival, organizator, godina. Korisno za screenshotove programa bez eksplicitnog grada.
              </FieldDescription>
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

            <Field>
              <FieldLabel>Screenshot (umjesto teksta)</FieldLabel>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleScreenshot(f) }}
              />
              {screenshot ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
                  <ImagePlus className="size-4 shrink-0 text-primary" />
                  <span className="flex-1 truncate">{screenshot.name}</span>
                  <button type="button" onClick={() => setScreenshot(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={loading}
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground hover:bg-muted/60 disabled:opacity-50"
                >
                  <ImagePlus className="size-4" />
                  Učitaj screenshot ili zalijepi (⌘V)
                </button>
              )}
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
