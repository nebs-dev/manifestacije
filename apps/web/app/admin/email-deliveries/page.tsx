"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { authedFetch } from "@/lib/admin/api"

const labels: Record<string, string> = {
  submitting: "Slanje pokrenuto — ishod još nije poznat", logged: "Lokalni zapis — poruka nije poslana",
  submission_unknown: "Ishod slanja nije poznat (mrežna pogreška) — dostava nije potvrđena",
  submission_failed: "Slanje pružatelju nije uspjelo", accepted: "Resend prihvatio zahtjev",
  sent: "Resend poslao poruku", delivery_delayed: "Dostava kasni", delivered: "Poslužitelj primatelja prihvatio poruku",
  failed: "Slanje nije uspjelo", bounced: "Poruka vraćena", suppressed: "Resend blokirao dostavu", complained: "Primatelj označio kao neželjenu poštu",
}
type Delivery = { id: string; userId: number | null; template: string; provider: string; messageId: string | null; status: string; createdAt: string; acceptedAt: string | null; lastEventAt: string | null }

export default function EmailDeliveriesPage() {
  const [items, setItems] = useState<Delivery[]>([])
  const [userId, setUserId] = useState("")
  const [filter, setFilter] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("userId") || ""
    const valid = /^[1-9][0-9]*$/.test(value) ? value : ""
    setUserId(valid); setFilter(valid)
  }, [])
  const load = useCallback(async () => {
    if (filter === null) return
    setLoading(true); setError("")
    try {
      const res = await authedFetch(`/api/admin/email-deliveries${filter ? `?userId=${encodeURIComponent(filter)}` : ""}`)
      if (!res.ok) throw new Error()
      setItems((await res.json()).items)
    } catch { setError("Zapise trenutačno nije moguće učitati. Pokušajte ponovno.") }
    finally { setLoading(false) }
  }, [filter])
  useEffect(() => { void load() }, [load])
  function submit(e: FormEvent) { e.preventDefault(); setFilter(userId) }
  return <div className="space-y-5 p-4 md:p-6">
    <h1 className="text-2xl font-semibold">Dostava emailova</h1>
    <p className="max-w-3xl text-sm text-muted-foreground">Posljednjih 100 zahtjeva za promjenu lozinke i poruka dobrodošlice. Prihvaćen zahtjev nije potvrda dostave. Prihvat poslužitelja primatelja ne potvrđuje dolazak u ulazni pretinac niti čitanje poruke. Povijest je dostupna od uvođenja praćenja.</p>
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">ID korisničkog računa<input aria-label="ID korisničkog računa" type="number" min="1" value={userId} onChange={e => setUserId(e.target.value)} className="ml-2 w-24 rounded border bg-background p-2" /></label>
      <button className="rounded border px-3 py-2 text-sm" type="submit">Filtriraj</button>
      <button className="rounded border px-3 py-2 text-sm" type="button" onClick={() => void load()} disabled={loading}>Osvježi</button>
    </form>
    {loading ? <p role="status">Učitavanje…</p> : error ? <p role="alert" className="text-destructive">{error}</p> : !items.length ? <p>Nema zapisa za odabrane korisnike.</p> : <ul className="space-y-3">
      {items.map(item => <li key={item.id} className="space-y-2 rounded-lg border p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><strong>{item.template === "password_reset" ? "Promjena lozinke" : "Dobrodošlica organizatoru"}</strong><time>{new Date(item.createdAt).toLocaleString("hr-HR")}</time></div>
        <p>{labels[item.status] || "Nepoznat ishod"}</p>
        <p className="text-muted-foreground">Korisnički račun: {item.userId ?? "—"} · Pružatelj: {item.provider}</p>
        {item.acceptedAt && <p>Zahtjev prihvaćen: {new Date(item.acceptedAt).toLocaleString("hr-HR")}</p>}
        {item.lastEventAt && <p>Posljednji status dostave: {new Date(item.lastEventAt).toLocaleString("hr-HR")}</p>}
        <p className="break-all text-xs text-muted-foreground">ID poruke: {item.messageId ?? "nije dostupan"} · ID pokušaja: {item.id}</p>
      </li>)}
    </ul>}
  </div>
}
