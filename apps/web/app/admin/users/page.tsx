"use client"

import { useEffect, useState, useCallback } from "react"
import { Users as UsersIcon } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/page-header"
import { StatusBadge } from "@/components/admin/status-badge"
import { TableLoadingState, ErrorState, EmptyState, DeleteButton } from "@/components/admin/states"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { authedFetch } from "@/lib/admin/api"

interface AdminUser {
  id: number
  email: string
  name: string
  role: "ADMIN" | "ORGANIZER"
  organizerId: number | null
  organizer: { id: number; name: string; slug: string; status: string } | null
  createdAt: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("hr-HR", { dateStyle: "medium", timeStyle: "short" })
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/users")
      if (!res.ok) { setError("Greška pri učitavanju."); return }
      setUsers(await res.json())
    } catch { setError("Greška pri dohvaćanju.") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function deleteUser(user: AdminUser) {
    const res = await authedFetch(`/api/admin/users/${user.id}`, { method: "DELETE" })
    if (res.ok) { toast.success(`Obrisano: ${user.email}`); load() }
    else toast.error("Greška pri brisanju", { description: await res.text() })
  }

  return (
    <>
      <PageHeader
        title="Korisnici"
        description="Svi računi za prijavu — uključujući račune čiji je organizator obrisan (i dalje drže email zauzetim dok se ne obrišu ovdje)."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Korisnici" }]}
      />
      {loading ? <TableLoadingState /> : error ? <ErrorState description={error} onRetry={load} /> : users.length === 0 ? (
        <EmptyState title="Nema korisnika" icon={<UsersIcon />} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Email</TableHead>
                <TableHead>Ime</TableHead>
                <TableHead>Uloga</TableHead>
                <TableHead>Organizator</TableHead>
                <TableHead>Kreiran</TableHead>
                <TableHead className="text-right">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const orphaned = u.role === "ORGANIZER" && !u.organizer
                return (
                  <TableRow key={u.id} className={orphaned ? "bg-destructive/5" : undefined}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground">{u.name}</TableCell>
                    <TableCell><StatusBadge status={u.role} /></TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.organizer ? u.organizer.name : orphaned ? (
                        <span className="text-destructive">Bez organizatora (obrisan)</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <DeleteButton onDelete={() => deleteUser(u)} label="Obriši korisnika" />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}
