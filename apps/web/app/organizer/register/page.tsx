"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { API_URL } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { storeOrganizerSession } from "@/lib/organizer/auth"

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const password = form.get("password") as string
    const email = String(form.get("email") || "").trim().toLowerCase()
    if (password.length < 8) { setError("Lozinka mora imati najmanje 8 znakova"); setLoading(false); return }
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          organizerName: form.get("organizerName"),
          email,
          password,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || "Registracija nije uspjela"); return }
      if (data.user?.role !== "ORGANIZER" || data.user?.email?.toLowerCase() !== email) {
        setError("Registracija je uspjela, ali sesija nije organizatorska")
        return
      }
      storeOrganizerSession(data.token, data.user)
      router.push("/organizer/events")
    } catch {
      setError("Greška pri spajanju na server")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Registracija</CardTitle>
        <CardDescription>Kreirajte organizatorski račun i dodajte svoje događaje besplatno.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input name="name" placeholder="Vaše ime i prezime" required />
          <Input name="organizerName" placeholder="Naziv organizatora / udruge" required />
          <Input name="email" type="email" placeholder="Email" required autoComplete="email" />
          <Input name="password" type="password" placeholder="Lozinka (min 8 znakova)" required autoComplete="new-password" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? "Registracija…" : "Registriraj se"}</Button>
          <p className="text-center text-sm text-muted-foreground">
            Već imate račun?{" "}
            <Link href="/organizer/login" className="text-primary hover:underline">Prijavite se</Link>
          </p>
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            Registracijom na manifestacije.hr stvarate korisnički račun koji vam omogućuje unos, uređivanje i upravljanje događajima na platformi. Podatke koje unesete koristimo isključivo za rad platforme, komunikaciju vezanu uz vaše događaje, moderaciju sadržaja, sigurnost korisničkog računa i poboljšanje usluge. Vaše podatke ne prodajemo trećim stranama. Marketinške obavijesti i newsletter šaljemo samo ako za to date posebnu privolu, koju u svakom trenutku možete povući.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
