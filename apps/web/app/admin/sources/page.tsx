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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/event-sources")
      if (!res.ok) { setError("Greška pri učitavanju izvora."); return }
      const data = await res.json()
      setSources((data as Record<string, unknown>[]).map(adaptEventSource))
    } catch {
      setError("Greška pri dohvaćanju izvora.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("adminLastSeenSourcesAt", new Date().toISOString())
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
          <SourceTable sources={sources} onReparse={load} onDelete={load} />
        )}
      </section>
    </>
  )
}
