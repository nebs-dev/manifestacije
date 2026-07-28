"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { API_URL } from "@/lib/api"
import { clearToken as clearAdminToken } from "@/lib/admin/api"
import { clearOrganizerSession } from "@/lib/organizer/auth"

const MIN_PASSWORD_LENGTH = 10

function PasswordInput({ id, value, onChange, disabled }: { id: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete="new-password"
        required
        className="w-full rounded-lg border border-input bg-card px-3 py-2 pr-10 text-sm outline-none ring-ring/40 focus:ring-2 disabled:opacity-60"
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

type Status = "checking" | "form" | "loading" | "success" | "invalid-token" | "missing-token" | "error"

export function ClaimCompleteForm() {
  // Read the token client-side via window.location rather than useSearchParams
  // to avoid needing a Suspense boundary — same approach as the reset-password
  // page. The token is never logged or put anywhere else in the UI.
  const [token, setToken] = useState<string | null | undefined>(undefined)
  const [organizerName, setOrganizerName] = useState("")
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [status, setStatus] = useState<Status>("checking")
  const [fieldError, setFieldError] = useState("")

  useEffect(() => {
    clearAdminToken()
    clearOrganizerSession()

    const params = new URLSearchParams(window.location.search)
    const t = params.get("token")
    setToken(t)
    if (!t) {
      setStatus("missing-token")
      return
    }

    fetch(`${API_URL}/api/organizer-claims/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t }),
    })
      .then((res) => (res.ok ? res.json() : { valid: false }))
      .then((data: { valid: boolean; requiresPassword?: boolean; organizerName?: string }) => {
        if (!data.valid) {
          setStatus("invalid-token")
          return
        }
        setOrganizerName(data.organizerName || "")
        setRequiresPassword(Boolean(data.requiresPassword))
        setStatus("form")
      })
      .catch(() => setStatus("error"))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldError("")

    if (requiresPassword) {
      if (!name.trim()) {
        setFieldError("Unesite ime.")
        return
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setFieldError(`Lozinka mora imati najmanje ${MIN_PASSWORD_LENGTH} znakova.`)
        return
      }
      if (password !== confirmPassword) {
        setFieldError("Lozinke se ne podudaraju.")
        return
      }
    }
    if (!token) {
      setStatus("missing-token")
      return
    }

    setStatus("loading")
    try {
      const res = await fetch(`${API_URL}/api/organizer-claims/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requiresPassword ? { token, name, password } : { token }),
      })
      if (res.ok) {
        setStatus("success")
        return
      }
      if (res.status === 400) {
        setStatus("invalid-token")
        return
      }
      setStatus("error")
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
        <h1 className="font-heading text-2xl font-semibold">Preuzmite profil</h1>
        {status === "form" && organizerName ? (
          <p className="mt-1 text-sm text-muted-foreground">Potvrdite preuzimanje profila organizatora <strong>{organizerName}</strong>.</p>
        ) : null}
      </div>

      {status === "checking" && <p className="text-center text-sm text-muted-foreground">Provjera poveznice…</p>}

      {(status === "missing-token" || status === "invalid-token") && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Poveznica nije valjana ili je istekla.
          </div>
          <p className="text-center text-sm text-muted-foreground">Zatražite novu poveznicu na stranici profila organizatora.</p>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-secondary px-4 py-3 text-sm text-secondary-foreground">
            Profil je uspješno preuzet.
          </div>
          <div className="flex justify-center gap-4 text-sm">
            <Link href="/organizer/login" className="font-medium text-primary hover:underline">
              Prijava organizatora
            </Link>
          </div>
        </div>
      )}

      {(status === "form" || status === "loading" || status === "error") && (
        <form id="organizer-claim-complete-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {status === "error" && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Greška pri preuzimanju profila. Pokušajte ponovo.
            </div>
          )}
          {fieldError && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{fieldError}</div>
          )}

          {requiresPassword && (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-sm font-medium">
                  Ime i prezime
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={status === "loading"}
                  required
                  className="rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none ring-ring/40 focus:ring-2 disabled:opacity-60"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                  Lozinka
                </label>
                <PasswordInput id="password" value={password} onChange={setPassword} disabled={status === "loading"} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirmPassword" className="text-sm font-medium">
                  Potvrdite lozinku
                </label>
                <PasswordInput id="confirmPassword" value={confirmPassword} onChange={setConfirmPassword} disabled={status === "loading"} />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {status === "loading" ? "Preuzimanje…" : "Preuzmi profil"}
          </button>
        </form>
      )}
    </div>
  )
}
