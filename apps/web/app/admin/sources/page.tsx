"use client"

import { useEffect, useState, useCallback } from "react"

import { PageHeader } from "@/components/admin/page-header"
import { ParseUrlForm, ManualSourceForm } from "@/components/admin/source-forms"
import { SourceTable } from "@/components/admin/source-table"
import { DEFAULT_SOURCE_FILTER, SourceFilters, type SourceFilter } from "@/components/admin/source-filters"
import { TableLoadingState, ErrorState } from "@/components/admin/states"
import { authedFetch } from "@/lib/admin/api"
import { adaptEventSource } from "@/lib/admin/adapters"
import type { EventSource } from "@/lib/admin/types"

export default function SourcesPage() {
  const [sources, setSources] = useState<EventSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<SourceFilter>(DEFAULT_SOURCE_FILTER)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (filter.type) params.set("type", filter.type)
      if (filter.status) params.set("status", filter.status)
      if (filter.actionable) params.set("actionable", "true")
      if (filter.unviewed) params.set("unviewed", "true")
      if (filter.q.trim()) params.set("q", filter.q.trim())
      const res = await authedFetch(`/api/admin/event-sources?${params}`)
      if (!res.ok) { setError("Greška pri učitavanju izvora."); return }
      const data = await res.json() as { items?: Record<string, unknown>[]; total?: number }
      setSources((data.items ?? []).map(adaptEventSource))
      setTotal(data.total ?? 0)
      setError("")
    } catch {
      setError("Greška pri dohvaćanju izvora.")
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filter])

  // A filter change re-pages from the start; staying on page 7 of a list that
  // is now four rows long shows an empty table.
  const applyFilter = useCallback((next: SourceFilter) => {
    setFilter(next)
    setPage(1)
  }, [])

  useEffect(() => {
    localStorage.setItem("adminLastSeenSourcesAt", new Date().toISOString())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <PageHeader
        title="Izvori"
        description="Prikupljanje događaja iz poveznica i ručnih unosa."
        breadcrumbs={[{ label: "Administracija", href: "/admin" }, { label: "Izvori" }]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ParseUrlForm onParsed={() => load()} />
        <ManualSourceForm onCreated={() => load()} />
      </div>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Izvori događaja</h2>
        <SourceFilters value={filter} onChange={applyFilter} total={total} />
        {loading ? (
          <TableLoadingState />
        ) : error ? (
          <ErrorState description={error} onRetry={load} />
        ) : (
          <SourceTable
            sources={sources}
            onReparse={load}
            onDelete={load}
            pagination={{ page, pageSize, total }}
            onPageChange={setPage}
            onPageSizeChange={(next) => { setPageSize(next); setPage(1) }}
          />
        )}
      </section>
    </>
  )
}
