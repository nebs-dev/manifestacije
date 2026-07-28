"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { API_URL } from "@/lib/api"
import { clearToken as clearAdminToken } from "@/lib/admin/api"
import { clearOrganizerSession } from "@/lib/organizer/auth"

const MIN_PASSWORD_LENGTH = 10

function PasswordInput({
  id,
  value,
  onChange,
  disabled,
  autoComplete,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoComplete={autoComplete}
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

type Status = "form" | "loading" | "success" | "invalid-token" | "missing-token" | "error"

export function ResetPasswordForm() {
  // Read the token client-side via window.location rather than useSearchParams
  // to avoid needing a Suspense boundary — the token is never logged or put
  // anywhere else in the UI besides this one read.
  const [token, setToken] = useState<string | null | undefined>(undefined)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [status, setStatus] = useState<Status>("form")
  const [fieldError, setFieldError] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get("token")
    setToken(t)
    if (!t) setStatus("missing-token")
    // Clear any existing session as soon as this page loads — a password
    // reset in progress should not leave a stale logged-in session around.
    clearAdminToken()
    clearOrganizerSession()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldError("")

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFieldError(`Lozinka mora imati najmanje ${MIN_PASSWORD_LENGTH} znakova.`)
      return
    }
    if (password !== confirmPassword) {
      setFieldError("Lozinke se ne podudaraju.")
      return
    }
    if (!token) {
      setStatus("missing-token")
      return
    }

    setStatus("loading")
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
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
        <h1 className="font-heading text-2xl font-semibold">Nova lozinka</h1>
        {status === "form" || status === "loading" ? (
          <p className="mt-1 text-sm text-muted-foreground">Postavite novu lozinku za svoj račun.</p>
        ) : null}
      </div>

      {status === "missing-token" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Poveznica nije valjana ili je istekla.
          </div>
          <Link href="/forgot-password" className="text-center text-sm font-medium text-primary hover:underline">
            Zatraži novu poveznicu
          </Link>
        </div>
      )}

      {status === "invalid-token" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Poveznica nije valjana ili je istekla.
          </div>
          <Link href="/forgot-password" className="text-center text-sm font-medium text-primary hover:underline">
            Zatraži novu poveznicu
          </Link>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-secondary px-4 py-3 text-sm text-secondary-foreground">
            Lozinka je uspješno promijenjena.
          </div>
          <div className="flex justify-center gap-4 text-sm">
            <Link href="/organizer/login" className="font-medium text-primary hover:underline">
              Prijava organizatora
            </Link>
            <Link href="/admin/login" className="font-medium text-primary hover:underline">
              Prijava administratora
            </Link>
          </div>
        </div>
      )}

      {(status === "form" || status === "loading" || status === "error") && (
        <form id="reset-password-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {status === "error" && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Greška pri spremanju lozinke. Pokušajte ponovo.
            </div>
          )}
          {fieldError && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {fieldError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Nova lozinka
            </label>
            <PasswordInput
              id="password"
              value={password}
              onChange={setPassword}
              disabled={status === "loading"}
              autoComplete="new-password"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Potvrdite lozinku
            </label>
            <PasswordInput
              id="confirmPassword"
              value={confirmPassword}
              onChange={setConfirmPassword}
              disabled={status === "loading"}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {status === "loading" ? "Spremanje…" : "Postavi novu lozinku"}
          </button>
        </form>
      )}
    </div>
  )
}
