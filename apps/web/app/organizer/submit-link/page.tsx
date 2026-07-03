"use client"

import type { ChangeEvent, ClipboardEvent, DragEvent, FormEvent } from "react"
import { useRef, useState } from "react"
import { AlertTriangle, ImagePlus, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { orgFetch } from "@/lib/organizer/api"
import { useOrganizerAuth } from "@/hooks/use-organizer-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

type ScreenshotState = {
  data: string
  mediaType: string
  name: string
  imageUrl?: string
}

function isFacebookUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "")
    return hostname === "fb.me" || hostname === "facebook.com" || hostname.endsWith(".facebook.com")
  } catch {
    return false
  }
}

async function resizeToBase64(file: File, maxWidth = 1600): Promise<{ data: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas nije dostupan")
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const mediaType = file.type === "image/png" ? "image/png" : "image/jpeg"
  const dataUrl = canvas.toDataURL(mediaType, 0.88)
  return { data: dataUrl.split(",")[1] ?? "", mediaType }
}

export default function SubmitLinkPage() {
  useOrganizerAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [sourceUrl, setSourceUrl] = useState("")
  const [rawText, setRawText] = useState("")
  const [screenshot, setScreenshot] = useState<ScreenshotState | null>(null)

  const facebookUrl = isFacebookUrl(sourceUrl)
  const hasEvidence = Boolean(rawText.trim() || screenshot)
  const facebookBlocked = facebookUrl && !hasEvidence

  async function uploadEvidence(file: File): Promise<string | undefined> {
    const form = new FormData()
    form.append("file", file)
    try {
      const res = await orgFetch("/api/organizer/uploads/event-image", { method: "POST", body: form })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json() as { imageUrl?: string }
      return data.imageUrl
    } catch {
      toast.warning("Screenshot će se koristiti za parsiranje, ali nije spremljen kao dokaz.")
      return undefined
    }
  }

  async function handleScreenshot(file?: File) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Odaberite sliku: JPEG, PNG ili WebP.")
      return
    }
    try {
      const [{ data, mediaType }, imageUrl] = await Promise.all([
        resizeToBase64(file),
        uploadEvidence(file),
      ])
      setScreenshot({ data, mediaType, name: file.name, imageUrl })
    } catch (error) {
      toast.error("Slika nije učitana", { description: error instanceof Error ? error.message : undefined })
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    void handleScreenshot(e.target.files?.[0])
    e.currentTarget.value = ""
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    void handleScreenshot(e.dataTransfer.files?.[0])
  }

  function onPaste(e: ClipboardEvent<HTMLFormElement>) {
    const image = Array.from(e.clipboardData.files).find((file) => file.type.startsWith("image/"))
    if (image) void handleScreenshot(image)
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (facebookBlocked) {
      toast.error("Za Facebook event dodajte screenshot/plakat ili zalijepite tekst opisa.")
      return
    }
    if (!sourceUrl.trim() && !rawText.trim() && !screenshot) {
      toast.error("Dodajte link, tekst ili screenshot/plakat.")
      return
    }

    setLoading(true)
    const body = {
      sourceUrl: sourceUrl.trim() || undefined,
      rawText: rawText.trim() || undefined,
      screenshotBase64: screenshot?.data,
      screenshotMediaType: screenshot?.mediaType,
      sourceImageUrl: screenshot?.imageUrl,
      contextHint: facebookUrl ? "Facebook event: koristi screenshot/plakat ili zalijepljeni tekst kao primarni izvor." : undefined,
      useLlm: true,
    }
    try {
      const res = await orgFetch("/api/organizer/events/submit-url", {
        method: "POST",
        body: JSON.stringify(body),
      })
      if (!res.ok) { toast.error("Greška", { description: await res.text() }); return }
      toast.success("Poslano na pregled! Admin će obraditi vaš zahtjev.")
      router.refresh()
      router.push("/organizer/events")
    } catch {
      toast.error("Greška pri spajanju na server")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold">Pošalji link ili tekst</h1>
      <Card>
        <CardHeader>
          <CardTitle>Automatski unos događaja</CardTitle>
          <CardDescription className="flex flex-col gap-1">
            <span>AI će automatski izvući podatke o događajima i poslati adminu na pregled.</span>
            <span className="text-xs">
              <strong>Link</strong> — web stranica s programom ili jednim događajem. &nbsp;
              <strong>Tekst</strong> — email, pozivnica, opis (korisno uz Facebook link). &nbsp;
              <strong>Screenshot</strong> — plakat ili slika programa.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} onPaste={onPaste} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Link na web stranicu događaja</Label>
              <Input name="sourceUrl" type="url" placeholder="https://…" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
            </div>

            {facebookUrl && (
              <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="flex flex-col gap-1">
                  <strong>Facebook link se ne može pouzdano pročitati.</strong>
                  <span>Uploadajte screenshot/plakat ili zalijepite tekst opisa događaja. Sam link nije dovoljan.</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Tekst pozivnice / opisa</Label>
              <Textarea name="rawText" rows={8} placeholder="Tekst pozivnice, email, opis…" value={rawText} onChange={(e) => setRawText(e.target.value)} />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Screenshot ili slika plakata</Label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click() }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={[
                  "flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-5 text-center transition-colors",
                  dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:bg-muted/50",
                ].join(" ")}
              >
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                {screenshot ? (
                  <div className="flex w-full items-center justify-between gap-3 rounded-lg bg-background p-3 text-left">
                    <div className="flex min-w-0 items-center gap-3">
                      <ImagePlus className="size-5 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{screenshot.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {screenshot.imageUrl ? "Spremljeno kao dokaz izvora" : "Koristi se samo za parsiranje"}
                        </div>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={(event) => { event.stopPropagation(); setScreenshot(null) }} aria-label="Ukloni screenshot">
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="size-6 text-muted-foreground" />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">Učitajte, povucite ili zalijepite screenshot/plakat</span>
                      <span className="text-xs text-muted-foreground">JPEG, PNG ili WebP. Slika služi kao izvor za admin pregled, ne kao javna slika eventa.</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {facebookBlocked && (
              <p className="text-sm text-destructive">Za Facebook event obavezno dodajte screenshot/plakat ili tekst opisa.</p>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={loading || facebookBlocked}>{loading ? "Slanje…" : "Pošalji na pregled"}</Button>
              <Button type="button" variant="outline" onClick={() => router.push("/organizer/events")}>Odustani</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
