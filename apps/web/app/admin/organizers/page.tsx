"use client"

import { useEffect, useState, useCallback, type ComponentProps } from "react"
import { ShieldCheck, Star, Pencil, Plus, Check, X, Trash2, KeyRound, Eye, EyeOff, Send } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/page-header"
import { StatusBadge } from "@/components/admin/status-badge"
import { TableLoadingState, ErrorState, DeleteButton } from "@/components/admin/states"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
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

// Uses a native <button> (not the <Button> component) as the tooltip trigger
// target — <Button> isn't wrapped in forwardRef, so React 18 drops the ref
// Tooltip needs to attach/position itself and the tooltip silently never opens.
function IconAction({ label, className, children, ...props }: ComponentProps<"button"> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<button type="button" className={buttonVariants({ size: "icon-sm", variant: "ghost", className })} aria-label={label} {...props} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function PasswordInput({ value, onChange, placeholder, className, onKeyDown, autoFocus, disabled }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string; onKeyDown?: (e: React.KeyboardEvent) => void; autoFocus?: boolean; disabled?: boolean }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        disabled={disabled}
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

function OrgRow({ org, onChanged, selected, onToggle }: { org: Organizer; onChanged: () => void; selected: boolean; onToggle: () => void }) {
  const [editing, setEditing] = useState(false)
  const [resettingPw, setResettingPw] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [form, setForm] = useState<OrgForm>({ name: org.name, email: org.email ?? "", websiteUrl: org.websiteUrl ?? "", phone: org.phone ?? "" })
  const [busy, setBusy] = useState(false)

  function set(k: keyof OrgForm, v: string) { setForm((p) => ({ ...p, [k]: v })) }

  async function resetPassword() {
    if (newPassword.length < 8) { toast.error("Lozinka mora imati najmanje 8 znakova"); return }
    setBusy(true)
    const res = await authedFetch(`/api/admin/organizers/${org.id}/reset-password`, { method: "POST", body: JSON.stringify({ password: newPassword }) })
    setBusy(false)
    if (res.ok) { toast.success("Lozinka promijenjena"); setResettingPw(false); setNewPassword("") }
    else toast.error("Greška pri promjeni lozinke")
  }

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
        <TableCell>
          <input type="checkbox" checked={selected} onChange={onToggle} className="size-4 cursor-pointer rounded border-border accent-primary" />
        </TableCell>
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
    <TableRow className={selected ? "bg-muted/30" : undefined}>
      <TableCell>
        <input type="checkbox" checked={selected} onChange={onToggle} className="size-4 cursor-pointer rounded border-border accent-primary" />
      </TableCell>
      <TableCell className="font-medium">{org.name}</TableCell>
      <TableCell className="text-muted-foreground">{org.email ?? "—"}</TableCell>
      <TableCell className="max-w-40 truncate text-muted-foreground">{org.websiteUrl ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{org.phone ?? "—"}</TableCell>
      <TableCell><StatusBadge status={org.status} /></TableCell>
      <TableCell className="text-right">
        {resettingPw ? (
          <div className="flex items-center justify-end gap-1">
            <PasswordInput
              value={newPassword}
              onChange={(value) => setNewPassword(value)}
              placeholder="Nova lozinka (min. 8)"
              onKeyDown={(e) => { if (e.key === "Enter") resetPassword(); if (e.key === "Escape") { setResettingPw(false); setNewPassword("") } }}
              className="h-8 w-44 text-xs"
              autoFocus
            />
            <Button size="icon-sm" variant="ghost" className="text-success" onClick={resetPassword} disabled={busy}><Check /></Button>
            <Button size="icon-sm" variant="ghost" onClick={() => { setResettingPw(false); setNewPassword("") }}><X /></Button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <IconAction label="Uredi" onClick={() => setEditing(true)}><Pencil /></IconAction>
            <IconAction label="Resetiraj lozinku" onClick={() => setResettingPw(true)}><KeyRound /></IconAction>
            {org.status !== "VERIFIED" && org.status !== "TRUSTED" && (
              <IconAction label="Verificiraj" className="text-success" onClick={async () => { const r = await authedFetch(`/api/admin/organizers/${org.id}/verify`, { method: "POST" }); if (r.ok) { toast.success(`Verificirano: ${org.name}`); onChanged() } else toast.error("Greška") }}><ShieldCheck /></IconAction>
            )}
            {org.status !== "TRUSTED" && (
              <IconAction label="Pouzdano" className="text-primary" onClick={async () => { const r = await authedFetch(`/api/admin/organizers/${org.id}/trust`, { method: "POST" }); if (r.ok) { toast.success(`Pouzdano: ${org.name}`); onChanged() } else toast.error("Greška") }}><Star /></IconAction>
            )}
            {org.status === "UNCLAIMED" && org.email && (
              <IconAction
                label="Pošalji poziv za preuzimanje profila"
                onClick={async () => {
                  const r = await authedFetch(`/api/admin/organizers/${org.id}/send-claim-invite`, { method: "POST" })
                  if (r.ok) toast.success(`Poziv poslan: ${org.name}`)
                  else toast.error("Greška pri slanju poziva")
                }}
              >
                <Send />
              </IconAction>
            )}
            <DeleteButton onDelete={async () => { const r = await authedFetch(`/api/admin/organizers/${org.id}`, { method: "DELETE" }); if (r.ok) { toast.success(`Obrisano: ${org.name}`); onChanged() } else toast.error("Greška pri brisanju") }} />
          </div>
        )}
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
        <TableCell colSpan={7}>
          <button onClick={() => setOpen(true)} className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <Plus className="size-3.5" /> Dodaj organizatora
          </button>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow className="bg-primary/5">
      <TableCell />
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
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [inviteConfirming, setInviteConfirming] = useState(false)
  const [inviteBusy, setInviteBusy] = useState(false)

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

  const allSelected = organizers.length > 0 && organizers.every((o) => selected.has(o.id))

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setConfirming(false)
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(organizers.map((o) => o.id)))
    setConfirming(false)
  }

  async function bulkDelete() {
    setBulkBusy(true)
    const results = await Promise.all(
      [...selected].map((id) => authedFetch(`/api/admin/organizers/${id}`, { method: "DELETE" }))
    )
    setBulkBusy(false)
    const failed = results.filter((r) => !r.ok).length
    if (failed === 0) toast.success(`Obrisano ${results.length} organizatora`)
    else toast.warning(`${results.length - failed} obrisano, ${failed} nije uspjelo`)
    setSelected(new Set())
    setConfirming(false)
    load()
  }

  interface BulkInviteStats {
    eligible: number
    invited: number
    activeInviteSkipped: number
    missingEmail: number
    alreadyClaimed: number
    failed: number
  }

  async function bulkInviteUnclaimed() {
    setInviteBusy(true)
    try {
      const res = await authedFetch("/api/admin/organizers/bulk-invite-unclaimed", { method: "POST" })
      if (!res.ok) { toast.error("Greška pri slanju poziva."); return }
      const stats: BulkInviteStats = await res.json()
      toast.success(
        `Pozvano ${stats.invited} organizatora`,
        { description: `Već imaju aktivan poziv: ${stats.activeInviteSkipped} · Bez emaila: ${stats.missingEmail} · Neuspjelo: ${stats.failed}` }
      )
      load()
    } catch {
      toast.error("Greška pri slanju poziva.")
    } finally {
      setInviteBusy(false)
      setInviteConfirming(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Organizatori"
        description="Upravljanje organizatorima i njihovim statusima."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Organizatori" }]}
        actions={
          inviteConfirming ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Pozvati sve nepreuzete organizatore s emailom (do 50)?</span>
              <Button size="sm" onClick={bulkInviteUnclaimed} disabled={inviteBusy}>Da, pozovi</Button>
              <Button size="sm" variant="ghost" onClick={() => setInviteConfirming(false)} disabled={inviteBusy}>Odustani</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setInviteConfirming(true)}>
              <Send data-icon="inline-start" />
              Pozovi sve nepreuzete
            </Button>
          )
        }
      />
      {loading ? <TableLoadingState /> : error ? <ErrorState description={error} onRetry={load} /> : (
        <div className="flex flex-col gap-2">
          {selected.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm">
              <span className="font-medium">{selected.size} odabrano</span>
              {confirming ? (
                <>
                  <span className="text-destructive">Sigurno obrisati {selected.size} organizatora?</span>
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
                  <TableHead>Naziv</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Web</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizers.map((o) => (
                  <OrgRow key={o.id} org={o} onChanged={load} selected={selected.has(o.id)} onToggle={() => toggle(o.id)} />
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
