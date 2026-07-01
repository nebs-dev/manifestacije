"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { API_URL } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || "Pogrešan email ili lozinka"); return }
      localStorage.setItem("orgToken", data.token)
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
          <Input name="password" type="password" placeholder="Lozinka" required autoComplete="current-password" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? "Prijava…" : "Prijava"}</Button>
          <p className="text-center text-sm text-muted-foreground">
            Nemate račun?{" "}
            <Link href="/organizer/register" className="text-primary hover:underline">Registrirajte se</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
