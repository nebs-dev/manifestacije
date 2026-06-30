"use client"

import { useEffect, useState, useCallback } from "react"

import { PageHeader } from "@/components/admin/page-header"
import { TableLoadingState, ErrorState } from "@/components/admin/states"
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

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/categories")
      if (!res.ok) { setError("Greška pri učitavanju kategorija."); return }
      setCategories(await res.json())
    } catch {
      setError("Greška pri dohvaćanju kategorija.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <>
      <PageHeader
        title="Kategorije"
        description="Kategorije događaja u sustavu."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Kategorije" }]}
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
                <TableHead className="w-12">ID</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Poredak</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="tabular-nums text-muted-foreground">{c.id}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{c.slug}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{c.sortOrder}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}
