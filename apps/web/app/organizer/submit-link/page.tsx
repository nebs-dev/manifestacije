"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { orgFetch } from "@/lib/organizer/api"
import { useOrganizerAuth } from "@/hooks/use-organizer-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export default function SubmitLinkPage() {
  useOrganizerAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const body = {
      sourceUrl: (form.get("sourceUrl") as string) || undefined,
      rawText: (form.get("rawText") as string) || undefined,
    }
    try {
      const res = await orgFetch("/api/organizer/events/submit-url", {
        method: "POST",
        body: JSON.stringify(body),
      })
      if (!res.ok) { toast.error("Greška", { description: await res.text() }); return }
      toast.success("Poslano na pregled! Admin će obraditi vaš zahtjev.")
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
          <CardDescription>
            Unesite link na stranicu događaja ili zalijepite tekst pozivnice — naš sustav će automatski izvući podatke i poslati na pregled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Link na stranicu događaja</Label>
              <Input name="sourceUrl" type="url" placeholder="https://…" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Ili zalijepite tekst pozivnice / opisa</Label>
              <Textarea name="rawText" rows={8} placeholder="Tekst pozivnice, email, opis…" />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>{loading ? "Slanje…" : "Pošalji na pregled"}</Button>
              <Button type="button" variant="outline" onClick={() => router.push("/organizer/events")}>Odustani</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
