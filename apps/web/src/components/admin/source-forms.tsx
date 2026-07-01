"use client"

import { useRef, useState, type DragEvent, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ImagePlus, Link2, Plus, Sparkles, X, Upload } from "lucide-react"
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
    if (!sourceUrl.trim()) { toast.error("Unesite URL izvora."); return }
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/event-sources/parse-url", {
        method: "POST",
        body: JSON.stringify({ sourceUrl, useLlm }),
      })
      if (!res.ok) { toast.error("Parsiranje neuspješno", { description: await res.text() }); return }
      const data = await res.json()
      toast.success("Parsiranje završeno", { description: sourceUrl })
      setSourceUrl("")
      setUseLlm(false)
      if (onParsed) onParsed(data.id)
      else router.push(`/admin/sources/${data.id}`)
    } finally {
      setLoading(false)
    }
  }

  const facebook = isFacebookUrl(sourceUrl)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parsiraj URL</CardTitle>
        <CardDescription>Automatski izvuci događaje s web stranice.</CardDescription>
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
                Zalijepite URL turističke zajednice, organizatora, portala ili stranice događaja.
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
                  Facebook blokira automatsko dohvaćanje — kopiraj tekst i zalijepi ga desno.
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
  const [label, setLabel] = useState("")
  const [from, setFrom] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [rawText, setRawText] = useState("")
  const [useLlm, setUseLlm] = useState(false)
  const [screenshot, setScreenshot] = useState<{ data: string; mediaType: string; name: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith("image/")) void handleScreenshot(file)
  }

  function removeScreenshot() {
    setScreenshot(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!rawText.trim() && !screenshot) {
      toast.error("Potreban je screenshot ili tekst događanja.")
      return
    }
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/event-sources/manual-email", {
        method: "POST",
        body: JSON.stringify({
          rawEmailSubject: label || undefined,
          rawEmailFrom: from || undefined,
          sourceUrl: sourceUrl || undefined,
          rawText: rawText || undefined,
          screenshotBase64: screenshot?.data,
          screenshotMediaType: screenshot?.mediaType,
          contextHint: label || undefined,
          useLlm,
        }),
      })
      if (!res.ok) { toast.error("Kreiranje neuspješno", { description: await res.text() }); return }
      toast.success("Izvor kreiran")
      setLabel("")
      setFrom("")
      setSourceUrl("")
      setRawText("")
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
        <CardTitle>Screenshot ili tekst</CardTitle>
        <CardDescription>
          Uploadaj program, flyer ili poster — AI će izvući sve događaje. Radi i za Facebook, e-mail i nestrukturirani tekst.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} onPaste={handlePaste}>
          <FieldGroup>
            {/* Screenshot — primary */}
            <Field>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleScreenshot(f) }}
              />
              {screenshot ? (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
                  <ImagePlus className="size-5 shrink-0 text-primary" />
                  <span className="flex-1 truncate text-sm font-medium">{screenshot.name}</span>
                  <button
                    type="button"
                    onClick={removeScreenshot}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Ukloni screenshot"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  disabled={loading}
                  className={[
                    "flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-sm transition-colors disabled:opacity-50",
                    dragging
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-muted/20 text-muted-foreground hover:border-primary/40 hover:bg-muted/40",
                  ].join(" ")}
                >
                  <Upload className="size-6 opacity-60" />
                  <span className="font-medium">Povuci screenshot ovdje ili klikni za odabir</span>
                  <span className="text-xs opacity-70">Ili zalijepi iz međuspremnika (⌘V)</span>
                </button>
              )}
            </Field>

            {/* URL — optional */}
            <Field>
              <FieldLabel htmlFor="ms-url">URL izvora <span className="font-normal text-muted-foreground">(opcionalno)</span></FieldLabel>
              <Input
                id="ms-url"
                type="url"
                placeholder="https://primjer.hr/dogadanja"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                disabled={loading}
              />
            </Field>

            {/* Text — secondary */}
            <Field>
              <FieldLabel htmlFor="ms-raw">
                Tekst <span className="font-normal text-muted-foreground">(opcionalno, umjesto ili uz screenshot)</span>
              </FieldLabel>
              <Textarea
                id="ms-raw"
                rows={4}
                placeholder="Zalijepite tekst Facebook eventi, e-maila, programa…"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                disabled={loading}
              />
            </Field>

            {/* Email metadata — secondary */}
            <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Email metadata (opcionalno)</p>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="ms-subject" className="text-xs">Predmet</FieldLabel>
                  <Input
                    id="ms-subject"
                    placeholder="npr. Ljetni program – TZ Rovinj"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    disabled={loading}
                    className="h-8 text-sm"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ms-from" className="text-xs">Pošiljatelj</FieldLabel>
                  <Input
                    id="ms-from"
                    placeholder="ime@organizator.hr"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    disabled={loading}
                    className="h-8 text-sm"
                  />
                </Field>
              </div>
            </div>

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
                AI parser (Claude)
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
