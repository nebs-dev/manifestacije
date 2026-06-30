"use client"

import { useEffect, useState, useCallback } from "react"
import { ShieldCheck, Star } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/page-header"
import { StatusBadge } from "@/components/admin/status-badge"
import { TableLoadingState, ErrorState, DeleteButton } from "@/components/admin/states"
import { Button } from "@/components/ui/button"
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
  status: string
  createdAt: string
}

export default function OrganizersPage() {
  const [organizers, setOrganizers] = useState<Organizer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/organizers")
      if (!res.ok) { setError("Greška pri učitavanju organizatora."); return }
      setOrganizers(await res.json())
    } catch {
      setError("Greška pri dohvaćanju organizatora.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function verify(id: number, name: string) {
    const res = await authedFetch(`/api/admin/organizers/${id}/verify`, { method: "POST" })
    if (res.ok) { toast.success(`Verificirano: ${name}`); load() }
    else toast.error("Greška pri verifikaciji")
  }

  async function trust(id: number, name: string) {
    const res = await authedFetch(`/api/admin/organizers/${id}/trust`, { method: "POST" })
    if (res.ok) { toast.success(`Označeno pouzdanim: ${name}`); load() }
    else toast.error("Greška")
  }

  async function deleteOrganizer(id: number, name: string) {
    const res = await authedFetch(`/api/admin/organizers/${id}`, { method: "DELETE" })
    if (res.ok) { toast.success(`Obrisano: ${name}`); load() }
    else toast.error("Greška pri brisanju")
  }

  return (
    <>
      <PageHeader
        title="Organizatori"
        description="Upravljanje organizatorima i njihovim statusima."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Organizatori" }]}
      />
      {loading ? (
        <TableLoadingState />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Naziv</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizers.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell className="text-muted-foreground">{o.email ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {o.status !== "VERIFIED" && o.status !== "TRUSTED" && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Verificiraj"
                          className="text-success"
                          onClick={() => verify(o.id, o.name)}
                        >
                          <ShieldCheck />
                        </Button>
                      )}
                      {o.status !== "TRUSTED" && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Označi pouzdanim"
                          className="text-primary"
                          onClick={() => trust(o.id, o.name)}
                        >
                          <Star />
                        </Button>
                      )}
                      <DeleteButton onDelete={() => deleteOrganizer(o.id, o.name)} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}
