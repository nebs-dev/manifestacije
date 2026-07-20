"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { Check, X, Send } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/page-header"
import { StatusBadge } from "@/components/admin/status-badge"
import { TableLoadingState, ErrorState, EmptyState } from "@/components/admin/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { authedFetch } from "@/lib/admin/api"

interface OrganizerClaim {
  id: number
  email: string
  status: string
  createdAt: string
  completedAt: string | null
  organizer: {
    id: number
    name: string
    slug: string
    email: string | null
    websiteUrl: string | null
    status: string
  }
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "ALL", label: "Sve" },
  { value: "NEEDS_ADMIN_REVIEW", label: "Za pregled" },
  { value: "EMAIL_VERIFICATION_SENT", label: "Poslano" },
  { value: "COMPLETED", label: "Preuzeto" },
  { value: "REJECTED", label: "Odbijeno" },
  { value: "EXPIRED", label: "Isteklo" },
]

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("hr-HR", { dateStyle: "medium", timeStyle: "short" })
}

function ClaimRow({ claim, onChanged }: { claim: OrganizerClaim; onChanged: () => void }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  async function approve() {
    setBusy(true)
    const res = await authedFetch(`/api/admin/organizer-claims/${claim.id}/approve`, { method: "POST" })
    setBusy(false)
    if (res.ok) { toast.success(`Poziv poslan: ${claim.organizer.name}`); onChanged() }
    else toast.error("Greška pri odobravanju")
  }

  async function reject() {
    setBusy(true)
    const res = await authedFetch(`/api/admin/organizer-claims/${claim.id}/reject`, {
      method: "POST",
      body: JSON.stringify({ internalReason: reason || undefined }),
    })
    setBusy(false)
    if (res.ok) { toast.success("Zahtjev odbijen"); setRejecting(false); setReason(""); onChanged() }
    else toast.error("Greška pri odbijanju")
  }

  const pending = claim.status === "NEEDS_ADMIN_REVIEW"

  return (
    <TableRow>
      <TableCell className="font-medium">{claim.organizer.name}</TableCell>
      <TableCell className="text-muted-foreground">{claim.email}</TableCell>
      <TableCell className="text-muted-foreground">{claim.organizer.email ?? "—"}</TableCell>
      <TableCell className="max-w-40 truncate text-muted-foreground">{claim.organizer.websiteUrl ?? "—"}</TableCell>
      <TableCell><StatusBadge status={claim.status} /></TableCell>
      <TableCell className="text-muted-foreground">{formatDate(claim.createdAt)}</TableCell>
      <TableCell className="text-muted-foreground">{formatDate(claim.completedAt)}</TableCell>
      <TableCell className="text-right">
        {!pending ? null : rejecting ? (
          <div className="flex items-center justify-end gap-1">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Razlog (interno)"
              className="h-8 w-44 text-xs"
              autoFocus
            />
            <Button size="icon-sm" variant="destructive" onClick={reject} disabled={busy}><Check /></Button>
            <Button size="icon-sm" variant="ghost" onClick={() => { setRejecting(false); setReason("") }}><X /></Button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" variant="outline" className="text-success" onClick={approve} disabled={busy}>
              <Check data-icon="inline-start" /> Odobri
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRejecting(true)} disabled={busy}>
              <X data-icon="inline-start" /> Odbij
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}

export default function OrganizerClaimsPage() {
  const [claims, setClaims] = useState<OrganizerClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/organizer-claims")
      if (!res.ok) { setError("Greška pri učitavanju."); return }
      setClaims(await res.json())
    } catch { setError("Greška pri dohvaćanju.") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {}
    for (const c of claims) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1
    return byStatus
  }, [claims])

  const filtered = statusFilter === "ALL" ? claims : claims.filter((c) => c.status === statusFilter)

  return (
    <>
      <PageHeader
        title="Zahtjevi za preuzimanje profila"
        description="Pregled i odobravanje zahtjeva za preuzimanje organizatorskih profila."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Zahtjevi za preuzimanje" }]}
      />
      {loading ? <TableLoadingState /> : error ? <ErrorState description={error} onRetry={load} /> : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  statusFilter === f.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label} {f.value === "ALL" ? claims.length : (counts[f.value] ?? 0)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="Nema zahtjeva" description="Nema zahtjeva s ovim statusom." icon={<Send />} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Organizator</TableHead>
                    <TableHead>Poslani email</TableHead>
                    <TableHead>Email organizatora</TableHead>
                    <TableHead>Web</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Kreirano</TableHead>
                    <TableHead>Preuzeto</TableHead>
                    <TableHead className="text-right">Akcije</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <ClaimRow key={c.id} claim={c} onChanged={load} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </>
  )
}
