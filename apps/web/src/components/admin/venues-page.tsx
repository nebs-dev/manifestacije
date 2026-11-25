"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { authedFetch } from "@/lib/admin/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Venue = { id: number; name: string; address: string | null; cityName: string; cityId: number; lat: number | null; lng: number | null; eventCount: number }
type DuplicateGroup = { cityId: number; cityName?: string; venues: Venue[] }

/**
 * Stored venues and their near-duplicates (VEN-06).
 *
 * Merging moves every event onto the venue that is kept and removes the other
 * one, so it is deliberately a two-step action with the consequence spelled
 * out. The API refuses a merge across cities; this page never offers one,
 * because the groups it shows are built per city.
 */
export function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState<{ source: Venue; target: Venue } | null>(null)

  const load = useCallback(async (query: string) => {
    setLoading(true); setError("")
    try {
      const params = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ""
      const [list, duplicates] = await Promise.all([
        authedFetch(`/api/admin/venues${params}`),
        authedFetch("/api/admin/venues/duplicates"),
      ])
      if (!list.ok || !duplicates.ok) throw new Error()
      setVenues((await list.json()) as Venue[])
      setGroups((await duplicates.json()) as DuplicateGroup[])
    } catch {
      setError("Mjesta nije moguće učitati. Pokušajte ponovno.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load("") }, [load])

  async function merge(source: Venue, target: Venue) {
    setBusy(true)
    try {
      const response = await authedFetch(`/api/admin/venues/${source.id}/merge`, {
        method: "POST",
        body: JSON.stringify({ intoId: target.id }),
      })
      if (!response.ok) { toast.error("Spajanje nije uspjelo", { description: await response.text() }); return }
      const result = await response.json()
      toast.success(`Spojeno u „${target.name}"`, { description: `Premješteno događaja: ${result.movedEvents}` })
      setConfirming(null)
      await load(search)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Mjesta održavanja</h1>
        <p className="text-muted-foreground">
          Svako mjesto koje je jednom potvrđeno koristi se kod sljedećih unosa. Ovdje se spajaju dvostruki zapisi istog mjesta.
        </p>
      </header>

      <section aria-label="Mogući duplikati" className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Mogući duplikati</h2>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">{loading ? "Učitavanje…" : "Nema prepoznatih duplikata."}</p>
        ) : groups.map(group => (
          <div key={`${group.cityId}-${group.venues[0].id}`} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">{group.cityName ?? `Grad #${group.cityId}`}</p>
            <ul className="flex flex-col gap-2">
              {group.venues.map(venue => (
                <li key={venue.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{venue.name}</span>
                  <span className="text-muted-foreground">{venue.address ?? "bez adrese"} · {venue.eventCount} događaja</span>
                  {venue.id !== group.venues[0].id && (
                    <Button type="button" size="sm" variant="outline" className="ml-auto" disabled={busy}
                      onClick={() => setConfirming({ source: venue, target: group.venues[0] })}>
                      Spoji u &bdquo;{group.venues[0].name}&ldquo;
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {confirming && (
        <div role="alertdialog" aria-label="Potvrda spajanja" className="flex flex-col gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
          <p className="text-sm">
            Svi događaji s mjesta <strong>{confirming.source.name}</strong> ({confirming.source.eventCount}) premjestit će se na{" "}
            <strong>{confirming.target.name}</strong>, a prvo mjesto se briše. Adresa mjesta koje ostaje se ne mijenja.
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => merge(confirming.source, confirming.target)}>Spoji</Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConfirming(null)}>Odustani</Button>
          </div>
        </div>
      )}

      <section aria-label="Sva mjesta" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="venue-search" className="text-xs text-muted-foreground">Pretraži mjesta</Label>
            <Input id="venue-search" value={search} className="w-64" onChange={event => setSearch(event.target.value)}
              placeholder="npr. Oxygene ili Kapucinska" />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => void load(search)} disabled={loading}>Pretraži</Button>
        </div>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Mjesto</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Adresa</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Grad</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Događaja</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Koordinate</th>
              </tr>
            </thead>
            <tbody>
              {venues.map(venue => (
                <tr key={venue.id} className="border-t border-border">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">{venue.name}</th>
                  <td className="px-3 py-1.5">{venue.address ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-1.5">{venue.cityName}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{venue.eventCount}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {venue.lat !== null && venue.lng !== null ? `${venue.lat.toFixed(4)}, ${venue.lng.toFixed(4)}` : "nema"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
