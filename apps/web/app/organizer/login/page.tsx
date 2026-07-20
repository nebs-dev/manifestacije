"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { API_URL } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { storeOrganizerSession } from "@/lib/organizer/auth"

function PasswordInput({ name, placeholder, required, autoComplete }: { name: string; placeholder?: string; required?: boolean; autoComplete?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        name={name}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [claimSlug, setClaimSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setClaimSlug(null)
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const email = String(form.get("email") || "").trim().toLowerCase()
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: form.get("password") }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === "CLAIM_REQUIRED" && data.organizerSlug) {
          setClaimSlug(data.organizerSlug)
          setError(data.message || "Ovaj organizator još nema postavljenu lozinku.")
          return
        }
        setError(data.message || "Pogrešan email ili lozinka")
        return
      }
      if (data.user?.role !== "ORGANIZER" || data.user?.email?.toLowerCase() !== email) {
        setError("Ovaj email je admin račun. Za organizatora koristite drugi email.")
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
        <CardTitle>Prijava</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input name="email" type="email" placeholder="Email" required autoComplete="email" />
          <PasswordInput name="password" placeholder="Lozinka" required autoComplete="current-password" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {claimSlug && (
            <Link
              href={`/organizatori/${claimSlug}/preuzmi`}
              className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Preuzmi svoj profil
            </Link>
          )}
          <Button type="submit" disabled={loading}>{loading ? "Prijava…" : "Prijava"}</Button>
          <Link href="/forgot-password" className="text-center text-sm text-muted-foreground hover:text-foreground hover:underline">
            Zaboravili ste lozinku?
          </Link>
          <p className="text-center text-sm text-muted-foreground">
            Nemate račun?{" "}
            <Link href="/organizer/register" className="text-primary hover:underline">Registrirajte se</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
