"use client"

import { useEffect, useState } from "react"
import { authedFetch } from "@/lib/admin/api"
import { eventFilterParams, type EventFilters } from "@/lib/admin/event-filters"

type Creator = { id: number; name: string | null; email: string; role: string; count: number; organizer: { name: string } | null }
type Report = { creators: Creator[]; unknownCount: number; total: number; adminCount: number; organizerCount: number; organizer: { id: number; name: string } | null }
const label = (creator: Creator) => `${creator.name || creator.email}${creator.name ? ` (${creator.email})` : ""}`

export function EventCreatorReport({ filters, onChange }: { filters: EventFilters; onChange: (filters: EventFilters) => void }) {
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const params = eventFilterParams({ ...filters, createdByUserId: "" }).toString()
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(false)
    authedFetch(`/api/admin/events/creator-report?${params}`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<Report> })
      .then(data => { if (!controller.signal.aborted) setReport(data) })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [params, retry])
  const change = (patch: Partial<EventFilters>) => onChange({ ...filters, ...patch })
  return <section aria-label="Autori i razdoblje unosa" className="mb-4 space-y-3 rounded-lg border p-4">
    {filters.organizerId && <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>Povezani organizator: <strong>{report?.organizer?.id === Number(filters.organizerId) ? report.organizer.name : `#${filters.organizerId}`}</strong></span>
      <button type="button" className="underline" onClick={() => change({ organizerId: "" })}>Ukloni filtar organizatora</button>
    </div>}
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="space-y-1 text-sm">Dodao
        <select aria-label="Dodao" className="block h-9 w-full rounded-md border bg-background px-2" value={filters.createdByUserId || ""} onChange={e => change({ createdByUserId: e.target.value })}>
          <option value="">Svi autori</option>
          <option value="unknown">Nepoznato</option>
          {report?.creators.map(creator => <option key={creator.id} value={creator.id}>{label(creator)}</option>)}
          {filters.createdByUserId && filters.createdByUserId !== "unknown" && !report?.creators.some(creator => String(creator.id) === filters.createdByUserId) && <option value={filters.createdByUserId}>Korisnik #{filters.createdByUserId}</option>}
        </select>
      </label>
      <label className="space-y-1 text-sm">Uneseno od
        <input aria-label="Uneseno od" type="date" className="block h-9 w-full rounded-md border bg-background px-2" value={filters.createdFrom || ""} onChange={e => change({ createdFrom: e.target.value })} />
      </label>
      <label className="space-y-1 text-sm">Uneseno do
        <input aria-label="Uneseno do" type="date" className="block h-9 w-full rounded-md border bg-background px-2" value={filters.createdTo || ""} onChange={e => change({ createdTo: e.target.value })} />
      </label>
    </div>
    <p className="text-xs text-muted-foreground">Datumi se odnose na unos događaja, prema hrvatskom vremenu. Autor unosa odvojen je od povezanog organizatora i kasnijih urednika.</p>
    {(filters.createdByUserId || filters.createdFrom || filters.createdTo) && <button type="button" className="text-sm underline" onClick={() => change({ createdByUserId: "", createdFrom: "", createdTo: "" })}>Ukloni filtre autora i razdoblja</button>}
    {loading ? <p role="status" className="text-sm text-muted-foreground">Učitavanje broja unosa…</p> : error ? <p role="alert" className="text-sm text-destructive">Greška pri učitavanju broja unosa. <button type="button" className="underline" onClick={() => setRetry(value => value + 1)}>Pokušaj ponovno</button></p> : report && <details>
      <summary className="cursor-pointer text-sm font-medium">Broj unosa po autoru — ukupno {report.total} · Administratori: {report.adminCount} · Organizatorski računi: {report.organizerCount} · Nepoznato: {report.unknownCount}</summary>
      <p className="my-2 text-xs text-muted-foreground">Usporedba svih autora za odabrano razdoblje i ostale filtre, prije odabira pojedinog autora. Vrsta računa prikazuje trenutačnu ulogu korisnika. Povijesni unosi bez autora ostaju nepoznati.</p>
      <div className="max-h-72 overflow-auto"><table className="w-full text-left text-sm">
        <thead><tr><th className="p-2">Autor</th><th className="p-2">Vrsta računa</th><th className="p-2">Broj unosa</th><th className="p-2"><span className="sr-only">Radnje</span></th></tr></thead>
        <tbody>{report.creators.map(creator => <tr key={creator.id} className="border-t">
          <td className="p-2 break-words">{label(creator)}{creator.organizer && <span className="block text-xs text-muted-foreground">{creator.organizer.name}</span>}</td>
          <td className="p-2">{creator.role === "ADMIN" ? "Administrator" : "Organizator"}</td><td className="p-2">{creator.count}</td>
          <td className="p-2"><button type="button" className="underline" onClick={() => change({ createdByUserId: String(creator.id) })}>Prikaži unose</button></td>
        </tr>)}<tr className="border-t"><td className="p-2">Nepoznato</td><td className="p-2">—</td><td className="p-2">{report.unknownCount}</td><td className="p-2"><button type="button" className="underline" onClick={() => change({ createdByUserId: "unknown" })}>Prikaži unose</button></td></tr></tbody>
      </table></div>
    </details>}
  </section>
}
