"use client"

import { useEffect, useState, useCallback } from "react"
import { Pencil, Plus, Check, X } from "lucide-react"
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

interface Category {
  id: number
  name: string
  slug: string
  sortOrder: number
}

type CatForm = { name: string; slug: string; sortOrder: string }

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[čć]/g, "c").replace(/[šš]/g, "s").replace(/[žž]/g, "z").replace(/đ/g, "d").replace(/[^a-z0-9-]/g, "")
}

function CatRow({ cat, onChanged }: { cat: Category; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<CatForm>({ name: cat.name, slug: cat.slug, sortOrder: String(cat.sortOrder) })
  const [busy, setBusy] = useState(false)

  function set(k: keyof CatForm, v: string) { setForm((p) => ({ ...p, [k]: v })) }
  function cancel() { setEditing(false); setForm({ name: cat.name, slug: cat.slug, sortOrder: String(cat.sortOrder) }) }

  async function save() {
    if (!form.name.trim() || !form.slug.trim()) return
    setBusy(true)
    const res = await authedFetch(`/api/admin/categories/${cat.id}`, { method: "PUT", body: JSON.stringify({ name: form.name, slug: form.slug, sortOrder: Number(form.sortOrder) || 0 }) })
    setBusy(false)
    if (res.ok) { toast.success("Spremljeno"); setEditing(false); onChanged() }
    else toast.error("Greška pri spremanju")
  }

  if (editing) {
    return (
      <TableRow className="bg-muted/20">
        <TableCell className="w-12 tabular-nums text-muted-foreground">{cat.id}</TableCell>
        <TableCell><Input value={form.name} onChange={(e) => set("name", e.target.value)} className="h-8" autoFocus /></TableCell>
        <TableCell><Input value={form.slug} onChange={(e) => set("slug", e.target.value)} className="h-8 font-mono text-sm" /></TableCell>
        <TableCell className="text-right"><Input value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} className="h-8 w-16 text-right" /></TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button size="icon-sm" variant="ghost" className="text-success" onClick={save} disabled={busy}><Check /></Button>
            <Button size="icon-sm" variant="ghost" onClick={cancel}><X /></Button>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow>
      <TableCell className="w-12 tabular-nums text-muted-foreground">{cat.id}</TableCell>
      <TableCell className="font-medium">{cat.name}</TableCell>
      <TableCell className="font-mono text-sm text-muted-foreground">{cat.slug}</TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">{cat.sortOrder}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Uredi" onClick={() => setEditing(true)}><Pencil /></Button>
          <DeleteButton onDelete={async () => {
            const r = await authedFetch(`/api/admin/categories/${cat.id}`, { method: "DELETE" })
            if (r.ok) { toast.success(`Obrisano: ${cat.name}`); onChanged() }
            else toast.error("Kategorija je u upotrebi — nije moguće obrisati")
          }} />
        </div>
      </TableCell>
    </TableRow>
  )
}

function AddRow({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CatForm>({ name: "", slug: "", sortOrder: "0" })
  const [busy, setBusy] = useState(false)

  function set(k: keyof CatForm, v: string) {
    setForm((p) => {
      const next = { ...p, [k]: v }
      if (k === "name" && p.slug === toSlug(p.name)) next.slug = toSlug(v)
      return next
    })
  }

  async function save() {
    if (!form.name.trim() || !form.slug.trim()) return
    setBusy(true)
    const res = await authedFetch("/api/admin/categories", { method: "POST", body: JSON.stringify({ name: form.name, slug: form.slug, sortOrder: Number(form.sortOrder) || 0 }) })
    setBusy(false)
    if (res.ok) { toast.success("Kategorija dodana"); setForm({ name: "", slug: "", sortOrder: "0" }); setOpen(false); onCreated() }
    else toast.error("Greška — slug možda već postoji")
  }

  if (!open) {
    return (
      <TableRow>
        <TableCell colSpan={5}>
          <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <Plus className="size-3.5" /> Dodaj kategoriju
          </button>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow className="bg-primary/5">
      <TableCell className="text-muted-foreground text-sm">novi</TableCell>
      <TableCell><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Naziv *" className="h-8" autoFocus /></TableCell>
      <TableCell><Input value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="slug *" className="h-8 font-mono text-sm" /></TableCell>
      <TableCell className="text-right"><Input value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} className="h-8 w-16 text-right" /></TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="icon-sm" variant="ghost" className="text-success" onClick={save} disabled={busy || !form.name.trim() || !form.slug.trim()}><Check /></Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setOpen(false)}><X /></Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/categories")
      if (!res.ok) { setError("Greška pri učitavanju."); return }
      setCategories(await res.json())
    } catch { setError("Greška pri dohvaćanju.") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <>
      <PageHeader
        title="Kategorije"
        description="Kategorije događaja u sustavu."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Kategorije" }]}
      />
      {loading ? <TableLoadingState /> : error ? <ErrorState description={error} onRetry={load} /> : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-12">ID</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Poredak</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => <CatRow key={c.id} cat={c} onChanged={load} />)}
              <AddRow onCreated={load} />
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}
