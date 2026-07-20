"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { API_URL } from "@/lib/api"

const GENERIC_MESSAGE = "Ako je moguće potvrditi zahtjev, poslali smo vam poveznicu na unesenu adresu."

type Choice = "unset" | "existing" | "new"
type Status = "idle" | "loading" | "done" | "error"

export function JoinForm() {
  const [choice, setChoice] = useState<Choice>("unset")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<Status>("idle")

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus("loading")
    try {
      const res = await fetch(`${API_URL}/api/organizer-claims/request-by-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      // Generic response regardless of whether the email is actually known —
      // the backend never signals whether an organizer with that email exists.
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
        <h1 className="font-heading text-2xl font-semibold">Dobrodošli, organizatori</h1>
        <p className="mt-1 text-sm text-muted-foreground">Jeste li već navedeni na Manifestacije.hr?</p>
      </div>

      {choice === "unset" && (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setChoice("existing")}
            className="cursor-pointer rounded-lg border border-input bg-card px-4 py-3 text-left text-sm hover:bg-muted"
          >
            <span className="block font-medium">Da, već sam naveden/a</span>
            <span className="block text-muted-foreground">Netko je već dodao moj program/organizaciju.</span>
          </button>
          <Link
            href="/organizer/register"
            className="cursor-pointer rounded-lg border border-input bg-card px-4 py-3 text-left text-sm hover:bg-muted"
          >
            <span className="block font-medium">Ne, prvi put sam ovdje</span>
            <span className="block text-muted-foreground">Registrirat ću se od nule.</span>
          </Link>
        </div>
      )}

      {choice === "existing" && status !== "done" && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {status === "error" && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Greška pri slanju zahtjeva. Pokušajte ponovo.
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email pod kojim ste vjerojatno navedeni
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
            {status === "loading" ? "Slanje…" : "Pošalji poveznicu"}
          </button>

          <button
            type="button"
            onClick={() => setChoice("unset")}
            className="text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Natrag
          </button>
        </form>
      )}

      {status === "done" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-secondary px-4 py-3 text-sm text-secondary-foreground">{GENERIC_MESSAGE}</div>
          <p className="text-center text-sm text-muted-foreground">
            Niste dobili ništa? Vjerojatno niste još navedeni —{" "}
            <Link href="/organizer/register" className="font-medium text-primary hover:underline">
              registrirajte se
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  )
}
