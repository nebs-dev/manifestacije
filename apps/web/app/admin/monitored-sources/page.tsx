"use client"

import { useEffect, useState, useCallback } from "react"

import { PageHeader } from "@/components/admin/page-header"
import { AddMonitoredSourceForm } from "@/components/admin/monitored-source-forms"
import { MonitoredSourceTable } from "@/components/admin/monitored-source-table"
import { TableLoadingState, ErrorState } from "@/components/admin/states"
import { authedFetch } from "@/lib/admin/api"
import { adaptMonitoredSource } from "@/lib/admin/adapters"
import type { MonitoredSource } from "@/lib/admin/types"

export default function MonitoredSourcesPage() {
  const [sources, setSources] = useState<MonitoredSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/monitored-sources")
      if (!res.ok) { setError("Greška pri učitavanju izvora."); return }
      const data = await res.json()
      setSources((data as Record<string, unknown>[]).map(adaptMonitoredSource))
    } catch {
      setError("Greška pri dohvaćanju izvora.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <>
      <PageHeader
        title="Nadzirani izvori"
        description="Periodička provjera stranica za nove ili promijenjene događaje."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Nadzirani izvori" }]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AddMonitoredSourceForm onCreated={() => load()} />
      </div>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Izvori pod nadzorom</h2>
        {loading ? (
          <TableLoadingState />
        ) : error ? (
          <ErrorState description={error} onRetry={load} />
        ) : (
          <MonitoredSourceTable sources={sources} onChange={load} />
        )}
      </section>
    </>
  )
}
