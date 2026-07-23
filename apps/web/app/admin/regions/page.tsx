"use client"

import { useEffect, useState, useCallback } from "react"
import { Pencil, Plus, Check, X, ChevronDown, ChevronRight } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/page-header"
import { TableLoadingState, ErrorState, DeleteButton } from "@/components/admin/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { authedFetch } from "@/lib/admin/api"

interface City { id: number; name: string; slug: string; lat: number | null; lng: number | null }
interface County { id: number; name: string; slug: string; cities: City[] }
interface Region { id: number; name: string; slug: string; counties: County[] }

function toSlug(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-")
    .replace(/[čć]/g, "c").replace(/š/g, "s").replace(/ž/g, "z").replace(/đ/g, "d")
    .replace(/[^a-z0-9-]/g, "")
}

// ── City row ────────────────────────────────────────────────────────────────

function CityRow({ city, onChanged }: { city: City; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: city.name, slug: city.slug, lat: city.lat != null ? String(city.lat) : "", lng: city.lng != null ? String(city.lng) : "" })
  const [busy, setBusy] = useState(false)

  function set(k: keyof typeof form, v: string) { setForm((p) => ({ ...p, [k]: v })) }
  function cancel() { setEditing(false); setForm({ name: city.name, slug: city.slug, lat: city.lat != null ? String(city.lat) : "", lng: city.lng != null ? String(city.lng) : "" }) }

  async function save() {
    setBusy(true)
    const res = await authedFetch(`/api/admin/cities/${city.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: form.name, slug: form.slug, countyId: 0, lat: form.lat ? Number(form.lat) : undefined, lng: form.lng ? Number(form.lng) : undefined }),
    })
    setBusy(false)
    if (res.ok) { toast.success("Grad spremljen"); setEditing(false); onChanged() }
    else toast.error("Greška pri spremanju")
  }

  if (editing) {
    return (
      <TableRow className="bg-muted/20">
        <TableCell><Input value={form.name} onChange={(e) => set("name", e.target.value)} className="h-7 text-sm" autoFocus /></TableCell>
        <TableCell><Input value={form.slug} onChange={(e) => set("slug", e.target.value)} className="h-7 font-mono text-xs" /></TableCell>
        <TableCell><Input value={form.lat} onChange={(e) => set("lat", e.target.value)} placeholder="45.555" className="h-7 text-sm" /></TableCell>
        <TableCell><Input value={form.lng} onChange={(e) => set("lng", e.target.value)} placeholder="18.695" className="h-7 text-sm" /></TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button size="icon-sm" variant="ghost" className="text-success" onClick={save} disabled={busy}><Check /></Button>
            <Button size="icon-sm" variant="ghost" onClick={cancel}><X /></Button>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow>
      <TableCell className="font-medium text-sm">{city.name}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{city.slug}</TableCell>
      <TableCell className="tabular-nums text-sm text-muted-foreground">{city.lat ?? "—"}</TableCell>
      <TableCell className="tabular-nums text-sm text-muted-foreground">{city.lng ?? "—"}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button size="icon-sm" variant="ghost" onClick={() => setEditing(true)}><Pencil /></Button>
          <DeleteButton onDelete={async () => {
            const r = await authedFetch(`/api/admin/cities/${city.id}`, { method: "DELETE" })
            if (r.ok) { toast.success(`Obrisano: ${city.name}`); onChanged() }
            else {
              const body = await r.json().catch(() => null)
              toast.error(body?.message || "Grad je u upotrebi — nije moguće obrisati")
            }
          }} />
        </div>
      </TableCell>
    </TableRow>
  )
}

// ── Add city row ─────────────────────────────────────────────────────────────

function AddCityRow({ countyId, onCreated }: { countyId: number; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: "", slug: "", lat: "", lng: "" })
  const [busy, setBusy] = useState(false)

  function set(k: keyof typeof form, v: string) {
    setForm((p) => {
      const next = { ...p, [k]: v }
      if (k === "name" && p.slug === toSlug(p.name)) next.slug = toSlug(v)
      return next
    })
  }

  async function save() {
    if (!form.name.trim()) return
    setBusy(true)
    const res = await authedFetch("/api/admin/cities", {
      method: "POST",
      body: JSON.stringify({ name: form.name, slug: form.slug || toSlug(form.name), countyId, lat: form.lat ? Number(form.lat) : undefined, lng: form.lng ? Number(form.lng) : undefined }),
    })
    setBusy(false)
    if (res.ok) { toast.success(`Grad dodan: ${form.name}`); setForm({ name: "", slug: "", lat: "", lng: "" }); setOpen(false); onCreated() }
    else toast.error("Greška — slug možda već postoji")
  }

  if (!open) {
    return (
      <TableRow>
        <TableCell colSpan={5}>
          <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Plus className="size-3" /> Dodaj grad
          </button>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow className="bg-primary/5">
      <TableCell><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Naziv *" className="h-7 text-sm" autoFocus /></TableCell>
      <TableCell><Input value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="auto" className="h-7 font-mono text-xs" /></TableCell>
      <TableCell><Input value={form.lat} onChange={(e) => set("lat", e.target.value)} placeholder="45.555" className="h-7 text-sm" /></TableCell>
      <TableCell><Input value={form.lng} onChange={(e) => set("lng", e.target.value)} placeholder="18.695" className="h-7 text-sm" /></TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button size="icon-sm" variant="ghost" className="text-success" onClick={save} disabled={busy || !form.name.trim()}><Check /></Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setOpen(false)}><X /></Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ── County section ────────────────────────────────────────────────────────────

function CountySection({ county, onChanged }: { county: County; onChanged: () => void }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          {county.name}
          <span className="text-xs font-normal">({county.cities.length})</span>
        </button>
        <DeleteButton onDelete={async () => {
          const r = await authedFetch(`/api/admin/counties/${county.id}`, { method: "DELETE" })
          if (r.ok) { toast.success(`Obrisano: ${county.name}`); onChanged() }
          else toast.error("Županija ima gradove — prvo obrišite gradove")
        }} />
      </div>
      {open && (
        <div className="ml-4 overflow-x-auto rounded-lg border border-border/60 bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs">Grad</TableHead>
                <TableHead className="text-xs">Slug</TableHead>
                <TableHead className="text-xs">Lat</TableHead>
                <TableHead className="text-xs">Lng</TableHead>
                <TableHead className="text-right text-xs">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {county.cities.map((c) => <CityRow key={c.id} city={c} onChanged={onChanged} />)}
              <AddCityRow countyId={county.id} onCreated={onChanged} />
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ── Add county ────────────────────────────────────────────────────────────────

function AddCounty({ regionId, onCreated }: { regionId: number; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: "", slug: "" })
  const [busy, setBusy] = useState(false)

  function set(k: keyof typeof form, v: string) {
    setForm((p) => {
      const next = { ...p, [k]: v }
      if (k === "name" && p.slug === toSlug(p.name)) next.slug = toSlug(v)
      return next
    })
  }

  async function save() {
    if (!form.name.trim()) return
    setBusy(true)
    const res = await authedFetch("/api/admin/counties", { method: "POST", body: JSON.stringify({ name: form.name, slug: form.slug || toSlug(form.name), regionId }) })
    setBusy(false)
    if (res.ok) { toast.success(`Županija dodana: ${form.name}`); setForm({ name: "", slug: "" }); setOpen(false); onCreated() }
    else toast.error("Greška")
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <Plus className="size-3.5" /> Dodaj županiju
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
      <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Naziv *" className="h-7 w-48 text-sm" autoFocus />
      <Input value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="slug (auto)" className="h-7 w-36 font-mono text-xs" />
      <Button size="icon-sm" variant="ghost" className="text-success" onClick={save} disabled={busy || !form.name.trim()}><Check /></Button>
      <Button size="icon-sm" variant="ghost" onClick={() => setOpen(false)}><X /></Button>
    </div>
  )
}

// ── Region section ────────────────────────────────────────────────────────────

function RegionSection({ region, onChanged }: { region: Region; onChanged: () => void }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 font-heading text-base font-semibold hover:text-primary">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          {region.name}
        </button>
        <DeleteButton onDelete={async () => {
          const r = await authedFetch(`/api/admin/regions/${region.id}`, { method: "DELETE" })
          if (r.ok) { toast.success(`Obrisano: ${region.name}`); onChanged() }
          else toast.error("Regija ima županije — prvo obrišite sadržaj")
        }} />
      </div>
      {open && (
        <div className="flex flex-col gap-4 pl-2">
          {region.counties.map((c) => <CountySection key={c.id} county={c} onChanged={onChanged} />)}
          <AddCounty regionId={region.id} onCreated={onChanged} />
        </div>
      )}
    </div>
  )
}

// ── Add region ────────────────────────────────────────────────────────────────

function AddRegion({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: "", slug: "" })
  const [busy, setBusy] = useState(false)

  function set(k: keyof typeof form, v: string) {
    setForm((p) => {
      const next = { ...p, [k]: v }
      if (k === "name" && p.slug === toSlug(p.name)) next.slug = toSlug(v)
      return next
    })
  }

  async function save() {
    if (!form.name.trim()) return
    setBusy(true)
    const res = await authedFetch("/api/admin/regions", { method: "POST", body: JSON.stringify({ name: form.name, slug: form.slug || toSlug(form.name) }) })
    setBusy(false)
    if (res.ok) { toast.success(`Regija dodana: ${form.name}`); setForm({ name: "", slug: "" }); setOpen(false); onCreated() }
    else toast.error("Greška")
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground">
        <Plus className="size-4" /> Dodaj regiju
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
      <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Naziv regije *" className="h-8 w-52" autoFocus />
      <Input value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="slug (auto)" className="h-8 w-40 font-mono text-sm" />
      <Button size="icon-sm" variant="ghost" className="text-success" onClick={save} disabled={busy || !form.name.trim()}><Check /></Button>
      <Button size="icon-sm" variant="ghost" onClick={() => setOpen(false)}><X /></Button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RegionsPage() {
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/regions")
      if (!res.ok) { setError("Greška pri učitavanju."); return }
      setRegions(await res.json())
    } catch { setError("Greška pri dohvaćanju.") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <>
      <PageHeader
        title="Regije i gradovi"
        description="Geografska taksonomija: regije, županije i gradovi."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Regije" }]}
      />
      {loading ? <TableLoadingState /> : error ? <ErrorState description={error} onRetry={load} /> : (
        <div className="flex flex-col gap-4">
          {regions.map((r) => <RegionSection key={r.id} region={r} onChanged={load} />)}
          <AddRegion onCreated={load} />
        </div>
      )}
    </>
  )
}
