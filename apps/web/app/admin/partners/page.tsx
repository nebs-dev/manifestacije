"use client"

import { useEffect, useState, useCallback } from "react"
import { Pencil, Plus, Check, X, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/page-header"
import { TableLoadingState, ErrorState, DeleteButton } from "@/components/admin/states"
import { EventImagePicker } from "@/components/admin/event-image-picker"
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

interface Partner {
  id: number
  name: string
  logoUrl: string
  websiteUrl?: string | null
  sortOrder: number
  isActive: boolean
}

type PartnerForm = { name: string; logoUrl: string; websiteUrl: string; sortOrder: string; isActive: boolean }

function PartnerRow({ partner, onChanged, selected, onToggle }: { partner: Partner; onChanged: () => void; selected: boolean; onToggle: () => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<PartnerForm>({ name: partner.name, logoUrl: partner.logoUrl, websiteUrl: partner.websiteUrl || "", sortOrder: String(partner.sortOrder), isActive: partner.isActive })
  const [busy, setBusy] = useState(false)

  function set(k: keyof PartnerForm, v: string | boolean) { setForm((p) => ({ ...p, [k]: v })) }
  function cancel() { setEditing(false); setForm({ name: partner.name, logoUrl: partner.logoUrl, websiteUrl: partner.websiteUrl || "", sortOrder: String(partner.sortOrder), isActive: partner.isActive }) }

  async function save() {
    if (!form.name.trim() || !form.logoUrl.trim()) return
    setBusy(true)
    const res = await authedFetch(`/api/admin/partners/${partner.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: form.name,
        logoUrl: form.logoUrl,
        websiteUrl: form.websiteUrl || undefined,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      }),
    })
    setBusy(false)
    if (res.ok) { toast.success("Spremljeno"); setEditing(false); onChanged() }
    else toast.error("Greška pri spremanju")
  }

  if (editing) {
    return (
      <TableRow className="bg-muted/20">
        <TableCell colSpan={6}>
          <div className="flex flex-col gap-4 p-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <EventImagePicker
                  value={{ imageUrl: form.logoUrl }}
                  onChange={(v) => set("logoUrl", v.imageUrl)}
                  disabled={busy}
                  uploadPath="/api/admin/uploads/partner-logo"
                  fit="contain"
                  aspectClassName="aspect-[3/1]"
                  hideUrlField
                />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Naziv</label>
                  <Input value={form.name} onChange={(e) => set("name", e.target.value)} className="h-8 mt-1" autoFocus />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Stranica</label>
                  <Input value={form.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} type="url" className="h-8 mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Poredak</label>
                    <Input value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} type="number" className="h-8 mt-1 text-right" />
                  </div>
                  <div className="flex items-end">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) => set("isActive", e.target.checked)}
                        className="size-4 rounded border-input accent-primary"
                      />
                      Aktivno
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-1 border-t pt-3">
              <Button size="icon-sm" variant="ghost" className="text-success" onClick={save} disabled={busy || !form.name.trim() || !form.logoUrl.trim()}><Check /></Button>
              <Button size="icon-sm" variant="ghost" onClick={cancel}><X /></Button>
            </div>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow className={selected ? "bg-muted/30" : undefined}>
      <TableCell>
        <input type="checkbox" checked={selected} onChange={onToggle} className="size-4 cursor-pointer rounded border-border accent-primary" />
      </TableCell>
      <TableCell className="w-12 tabular-nums text-muted-foreground">{partner.id}</TableCell>
      <TableCell className="w-24">
        {partner.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={partner.logoUrl} alt={partner.name} className="h-8 w-auto max-w-[96px] object-contain" />
        )}
      </TableCell>
      <TableCell className="font-medium">{partner.name}</TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">{partner.sortOrder}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Uredi" onClick={() => setEditing(true)}><Pencil /></Button>
          <DeleteButton onDelete={async () => {
            const r = await authedFetch(`/api/admin/partners/${partner.id}`, { method: "DELETE" })
            if (r.ok) { toast.success(`Obrisano: ${partner.name}`); onChanged() }
            else toast.error("Greška pri brisanju")
          }} />
        </div>
      </TableCell>
    </TableRow>
  )
}

function AddRow({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<PartnerForm>({ name: "", logoUrl: "", websiteUrl: "", sortOrder: "0", isActive: true })
  const [busy, setBusy] = useState(false)

  function set(k: keyof PartnerForm, v: string | boolean) { setForm((p) => ({ ...p, [k]: v })) }

  async function save() {
    if (!form.name.trim() || !form.logoUrl.trim()) return
    setBusy(true)
    const res = await authedFetch("/api/admin/partners", {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        logoUrl: form.logoUrl,
        websiteUrl: form.websiteUrl || undefined,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      }),
    })
    setBusy(false)
    if (res.ok) { toast.success("Partner dodan"); setForm({ name: "", logoUrl: "", websiteUrl: "", sortOrder: "0", isActive: true }); setOpen(false); onCreated() }
    else toast.error("Greška — provjerite podatke")
  }

  if (!open) {
    return (
      <TableRow>
        <TableCell colSpan={6}>
          <button onClick={() => setOpen(true)} className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <Plus className="size-3.5" /> Dodaj partnera
          </button>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow className="bg-primary/5">
      <TableCell />
      <TableCell className="text-muted-foreground text-sm">novi</TableCell>
      <TableCell colSpan={4}>
        <div className="flex flex-col gap-4 p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <EventImagePicker
                value={{ imageUrl: form.logoUrl }}
                onChange={(v) => set("logoUrl", v.imageUrl)}
                disabled={busy}
                uploadPath="/api/admin/uploads/partner-logo"
                fit="contain"
                aspectClassName="aspect-[3/1]"
                hideUrlField
              />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Naziv *</label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Naziv" className="h-8 mt-1" autoFocus />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Stranica</label>
                <Input value={form.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} type="url" placeholder="https://..." className="h-8 mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Poredak</label>
                  <Input value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} type="number" className="h-8 mt-1 text-right" />
                </div>
                <div className="flex items-end">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => set("isActive", e.target.checked)}
                      className="size-4 rounded border-input accent-primary"
                    />
                    Aktivno
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-1 border-t pt-3">
            <Button size="icon-sm" variant="ghost" className="text-success" onClick={save} disabled={busy || !form.name.trim() || !form.logoUrl.trim()}><Check /></Button>
            <Button size="icon-sm" variant="ghost" onClick={() => setOpen(false)}><X /></Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/partners")
      if (!res.ok) { setError("Greška pri učitavanju."); return }
      setPartners(await res.json())
    } catch { setError("Greška pri dohvaćanju.") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const allSelected = partners.length > 0 && partners.every((p) => selected.has(p.id))

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setConfirming(false)
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(partners.map((p) => p.id)))
    setConfirming(false)
  }

  async function bulkDelete() {
    setBulkBusy(true)
    const results = await Promise.all(
      [...selected].map((id) => authedFetch(`/api/admin/partners/${id}`, { method: "DELETE" }))
    )
    setBulkBusy(false)
    const failed = results.filter((r) => !r.ok).length
    if (failed === 0) toast.success(`Obrisano ${results.length} partnera`)
    else toast.warning(`${results.length - failed} obrisano, ${failed} nije uspjelo`)
    setSelected(new Set())
    setConfirming(false)
    load()
  }

  return (
    <>
      <PageHeader
        title="Partneri"
        description="Partneri prikazani na početnoj stranici."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Partneri" }]}
      />
      {loading ? <TableLoadingState /> : error ? <ErrorState description={error} onRetry={load} /> : (
        <div className="flex flex-col gap-2">
          {selected.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm">
              <span className="font-medium">{selected.size} odabrano</span>
              {confirming ? (
                <>
                  <span className="text-destructive">Sigurno obrisati {selected.size} partnera?</span>
                  <Button variant="destructive" size="sm" onClick={bulkDelete} disabled={bulkBusy}>Da, obriši</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Ne</Button>
                </>
              ) : (
                <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
                  <Trash2 data-icon="inline-start" />
                  Obriši odabrano
                </Button>
              )}
              <button onClick={() => { setSelected(new Set()); setConfirming(false) }} className="ml-auto cursor-pointer text-muted-foreground hover:text-foreground">
                Odustani
              </button>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="size-4 cursor-pointer rounded border-border accent-primary" />
                  </TableHead>
                  <TableHead className="w-12">ID</TableHead>
                  <TableHead>Logo</TableHead>
                  <TableHead>Naziv</TableHead>
                  <TableHead className="text-right">Poredak</TableHead>
                  <TableHead className="text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((p) => (
                  <PartnerRow key={p.id} partner={p} onChanged={load} selected={selected.has(p.id)} onToggle={() => toggle(p.id)} />
                ))}
                <AddRow onCreated={load} />
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </>
  )
}
