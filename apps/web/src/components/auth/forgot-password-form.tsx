"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { API_URL } from "@/lib/api"

const GENERIC_MESSAGE = "Ako račun s tom adresom postoji, poslali smo upute za promjenu lozinke."

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus("loading")
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      // The generic success message is shown for every 2xx/4xx response —
      // the backend never signals whether the account exists, and neither
      // does this page. Only a network/server failure gets a distinct state.
      if (res.ok || res.status === 400) {
        setStatus("done")
      } else {
        setStatus("error")
      }
    } catch {
      setStatus("error")
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="mb-3 flex justify-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-lg font-bold">M</span>
          </div>
        </div>
        <h1 className="font-heading text-2xl font-semibold">Zaboravljena lozinka</h1>
        <p className="mt-1 text-sm text-muted-foreground">Unesite email i poslat ćemo vam upute za promjenu lozinke.</p>
      </div>

      {status === "done" ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-secondary px-4 py-3 text-sm text-secondary-foreground">
            {GENERIC_MESSAGE}
          </div>
          <Link
            href="/organizer/login"
            className="text-center text-sm font-medium text-primary hover:underline"
          >
            Natrag na prijavu
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {status === "error" && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Greška pri slanju zahtjeva. Pokušajte ponovo.
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none ring-ring/40 focus:ring-2 disabled:opacity-60"
              disabled={status === "loading"}
            />
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {status === "loading" ? "Slanje…" : "Pošalji upute"}
          </button>

          <div className="flex justify-center gap-4 text-sm">
            <Link href="/organizer/login" className="text-muted-foreground hover:text-foreground hover:underline">
              Prijava organizatora
            </Link>
            <Link href="/admin/login" className="text-muted-foreground hover:text-foreground hover:underline">
              Prijava administratora
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
