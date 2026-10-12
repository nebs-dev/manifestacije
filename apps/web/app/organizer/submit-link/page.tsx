"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { ScreenshotsPicker, screenshotsPayload, type ScreenshotInput } from "@/components/screenshots-picker"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { orgFetch } from "@/lib/organizer/api"
import { submissionMessage } from "@/lib/organizer/submission"
import { useOrganizerAuth } from "@/hooks/use-organizer-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

function isFacebookUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "")
    return hostname === "fb.me" || hostname === "facebook.com" || hostname.endsWith(".facebook.com")
  } catch {
    return false
  }
}

export default function SubmitLinkPage() {
  useOrganizerAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sourceUrl, setSourceUrl] = useState("")
  const [rawText, setRawText] = useState("")
  const [screenshots, setScreenshots] = useState<ScreenshotInput[]>([])

  const facebookUrl = isFacebookUrl(sourceUrl)
  const hasEvidence = Boolean(rawText.trim() || screenshots.length)
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
      toast.warning("Slika će se koristiti za obradu, ali nije spremljena kao dokaz.")
      return undefined
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (facebookBlocked) {
      toast.error("Za Facebook događaj dodajte screenshot/plakat ili zalijepite tekst opisa.")
      return
    }
    if (!sourceUrl.trim() && !rawText.trim() && !screenshots.length) {
      toast.error("Dodajte link, tekst ili screenshot/plakat.")
      return
    }

    setLoading(true)
    const body = {
      sourceUrl: sourceUrl.trim() || undefined,
      rawText: rawText.trim() || undefined,
      screenshots: screenshotsPayload(screenshots),
      contextHint: facebookUrl ? "Facebook event: koristi screenshot/plakat ili zalijepljeni tekst kao primarni izvor." : undefined,
      useLlm: true,
    }
    try {
      const res = await orgFetch("/api/organizer/events/submit-url", {
        method: "POST",
        body: JSON.stringify(body),
      })
      if (!res.ok) { toast.error("Greška", { description: await res.text() }); return }
      const message = submissionMessage(await res.json().catch(() => ({})))
      toast.success(message.title, message.description ? { description: message.description } : undefined)
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
              <strong>Slike</strong> — plakat, screenshot ili više slika istog događaja (do 4).
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="organizer-submit-link-form" onSubmit={submit} className="flex flex-col gap-4">
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

            <ScreenshotsPicker value={screenshots} onChange={setScreenshots} upload={uploadEvidence} disabled={loading} />

            {facebookBlocked && (
              <p className="text-sm text-destructive">Za Facebook događaj obavezno dodajte screenshot/plakat ili tekst opisa.</p>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={loading || facebookBlocked}>{loading ? "Slanje…" : "Pošalji na pregled"}</Button>
              <Button type="button" variant="outline" onClick={() => router.push("/organizer/events")}>Odustani</Button>
            </div>
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              Ako nam pošaljete link na događaj putem Facebooka, Instagrama, web stranice ili drugog izvora, podatke koristimo kako bismo pripremili i objavili pregledan unos događaja na platformi manifestacije.hr. Kontakt podatke, ako ih ostavite, koristimo samo za provjeru informacija i komunikaciju vezanu uz poslani događaj.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
