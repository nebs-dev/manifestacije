"use client"

import { useEffect, useState, useCallback } from "react"

import { PageHeader } from "@/components/admin/page-header"
import { DuplicatesView } from "@/components/admin/duplicates-view"
import { TableLoadingState, ErrorState } from "@/components/admin/states"
import { authedFetch } from "@/lib/admin/api"
import { adaptDuplicate } from "@/lib/admin/adapters"
import type { DuplicateCandidate } from "@/lib/admin/types"

export default function DuplicatesPage() {
  const [items, setItems] = useState<DuplicateCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/duplicates")
      if (!res.ok) { setError("Greška pri učitavanju."); return }
      const data = await res.json()
      setItems((data as Record<string, unknown>[]).map(adaptDuplicate))
    } catch {
      setError("Greška pri dohvaćanju duplikata.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <>
      <PageHeader
        title="Duplikati"
        description="Pregledaj i riješi predložene duplikate događaja."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Duplikati" },
        ]}
      />
      {loading ? (
        <TableLoadingState />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <DuplicatesView items={items} onAction={load} />
      )}
    </>
  )
}
