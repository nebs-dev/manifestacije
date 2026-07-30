"use client"

import { useEffect, useState, useCallback } from "react"

import { PageHeader } from "@/components/admin/page-header"
import { ParseUrlForm, ManualSourceForm } from "@/components/admin/source-forms"
import { SourceTable } from "@/components/admin/source-table"
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
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
  }, [page, pageSize])

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
        description="Cockpit za prikupljanje događaja iz URL-ova i ručnih unosa."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Izvori" }]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ParseUrlForm onParsed={() => load()} />
        <ManualSourceForm onCreated={() => load()} />
      </div>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Izvori događaja</h2>
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
