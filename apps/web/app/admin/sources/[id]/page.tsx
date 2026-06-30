"use client"

import { useEffect, useState, useCallback } from "react"

import { PageHeader } from "@/components/admin/page-header"
import { SourceReview } from "@/components/admin/source-review"
import { TableLoadingState, ErrorState } from "@/components/admin/states"
import { authedFetch } from "@/lib/admin/api"
import { adaptEventSource, adaptEventSourceCandidates } from "@/lib/admin/adapters"
import type { EventSource, ParsedCandidate } from "@/lib/admin/types"

export default function SourceDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const [source, setSource] = useState<EventSource | null>(null)
  const [candidates, setCandidates] = useState<ParsedCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch(`/api/admin/event-sources/${id}`)
      if (!res.ok) { setError("Izvor nije pronađen."); return }
      const data = await res.json() as Record<string, unknown>
      setSource(adaptEventSource(data))
      setCandidates(adaptEventSourceCandidates(data))
    } catch {
      setError("Greška pri dohvaćanju izvora.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <TableLoadingState />
  if (error || !source) return <ErrorState description={error} onRetry={load} />

  return (
    <>
      <PageHeader
        title={source.subject}
        description="Pregled i obrada parsiranih kandidata."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Izvori", href: "/admin/sources" },
          { label: source.subject },
        ]}
      />
      <SourceReview source={source} candidates={candidates} onReparse={load} />
    </>
  )
}
