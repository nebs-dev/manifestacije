"use client"

import { useEffect, useState, useCallback } from "react"
import { ShieldCheck, Star, Pencil, Plus, Check, X } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/page-header"
import { StatusBadge } from "@/components/admin/status-badge"
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

interface Organizer {
  id: number
  name: string
  slug: string
  email: string | null
  websiteUrl: string | null
  phone: string | null
  status: string
}

type OrgForm = { name: string; email: string; websiteUrl: string; phone: string }
const emptyForm = (): OrgForm => ({ name: "", email: "", websiteUrl: "", phone: "" })

function OrgRow({ org, onChanged }: { org: Organizer; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<OrgForm>({ name: org.name, email: org.email ?? "", websiteUrl: org.websiteUrl ?? "", phone: org.phone ?? "" })
  const [busy, setBusy] = useState(false)

  function set(k: keyof OrgForm, v: string) { setForm((p) => ({ ...p, [k]: v })) }

  async function save() {
    if (!form.name.trim()) return
    setBusy(true)
    const res = await authedFetch(`/api/admin/organizers/${org.id}`, { method: "PUT", body: JSON.stringify({ name: form.name, email: form.email || undefined, websiteUrl: form.websiteUrl || undefined, phone: form.phone || undefined }) })
    setBusy(false)
    if (res.ok) { toast.success("Spremljeno"); setEditing(false); onChanged() }
    else toast.error("Greška pri spremanju")
  }

  if (editing) {
    return (
      <TableRow className="bg-muted/20">
        <TableCell><Input value={form.name} onChange={(e) => set("name", e.target.value)} className="h-8" autoFocus /></TableCell>
        <TableCell><Input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email" className="h-8" /></TableCell>
        <TableCell><Input value={form.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://..." className="h-8" /></TableCell>
        <TableCell><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+385..." className="h-8" /></TableCell>
        <TableCell />
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button size="icon-sm" variant="ghost" className="text-success" onClick={save} disabled={busy}><Check /></Button>
            <Button size="icon-sm" variant="ghost" onClick={() => { setEditing(false); setForm({ name: org.name, email: org.email ?? "", websiteUrl: org.websiteUrl ?? "", phone: org.phone ?? "" }) }}><X /></Button>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{org.name}</TableCell>
      <TableCell className="text-muted-foreground">{org.email ?? "—"}</TableCell>
      <TableCell className="max-w-40 truncate text-muted-foreground">{org.websiteUrl ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{org.phone ?? "—"}</TableCell>
      <TableCell><StatusBadge status={org.status} /></TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Uredi" onClick={() => setEditing(true)}><Pencil /></Button>
          {org.status !== "VERIFIED" && org.status !== "TRUSTED" && (
            <Button size="icon-sm" variant="ghost" aria-label="Verificiraj" className="text-success" onClick={async () => { const r = await authedFetch(`/api/admin/organizers/${org.id}/verify`, { method: "POST" }); if (r.ok) { toast.success(`Verificirano: ${org.name}`); onChanged() } else toast.error("Greška") }}><ShieldCheck /></Button>
          )}
          {org.status !== "TRUSTED" && (
            <Button size="icon-sm" variant="ghost" aria-label="Pouzdano" className="text-primary" onClick={async () => { const r = await authedFetch(`/api/admin/organizers/${org.id}/trust`, { method: "POST" }); if (r.ok) { toast.success(`Pouzdano: ${org.name}`); onChanged() } else toast.error("Greška") }}><Star /></Button>
          )}
          <DeleteButton onDelete={async () => { const r = await authedFetch(`/api/admin/organizers/${org.id}`, { method: "DELETE" }); if (r.ok) { toast.success(`Obrisano: ${org.name}`); onChanged() } else toast.error("Greška pri brisanju") }} />
        </div>
      </TableCell>
    </TableRow>
  )
}

function AddRow({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<OrgForm>(emptyForm())
  const [busy, setBusy] = useState(false)

  function set(k: keyof OrgForm, v: string) { setForm((p) => ({ ...p, [k]: v })) }

  async function save() {
    if (!form.name.trim()) return
    setBusy(true)
    const res = await authedFetch("/api/admin/organizers", { method: "POST", body: JSON.stringify({ name: form.name, email: form.email || undefined, websiteUrl: form.websiteUrl || undefined, phone: form.phone || undefined }) })
    setBusy(false)
    if (res.ok) { toast.success("Organizator dodan"); setForm(emptyForm()); setOpen(false); onCreated() }
    else toast.error("Greška pri dodavanju")
  }

  if (!open) {
    return (
      <TableRow>
        <TableCell colSpan={6}>
          <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <Plus className="size-3.5" /> Dodaj organizatora
          </button>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow className="bg-primary/5">
      <TableCell><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Naziv *" className="h-8" autoFocus /></TableCell>
      <TableCell><Input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email" className="h-8" /></TableCell>
      <TableCell><Input value={form.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://..." className="h-8" /></TableCell>
      <TableCell><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+385..." className="h-8" /></TableCell>
      <TableCell />
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="icon-sm" variant="ghost" className="text-success" onClick={save} disabled={busy || !form.name.trim()}><Check /></Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setOpen(false)}><X /></Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function OrganizersPage() {
  const [organizers, setOrganizers] = useState<Organizer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/organizers")
      if (!res.ok) { setError("Greška pri učitavanju."); return }
      setOrganizers(await res.json())
    } catch { setError("Greška pri dohvaćanju.") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <>
      <PageHeader
        title="Organizatori"
        description="Upravljanje organizatorima i njihovim statusima."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Organizatori" }]}
      />
      {loading ? <TableLoadingState /> : error ? <ErrorState description={error} onRetry={load} /> : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Naziv</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Web</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizers.map((o) => <OrgRow key={o.id} org={o} onChanged={load} />)}
              <AddRow onCreated={load} />
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}
