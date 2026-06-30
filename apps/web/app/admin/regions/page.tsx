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

interface City { id: number; name: string; slug: string; lat: number | null; lng: number | null }
interface County { id: number; name: string; slug: string; cities: City[] }
interface Region { id: number; name: string; slug: string; counties: County[] }

export default function RegionsPage() {
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/regions")
      if (!res.ok) { setError("Greška pri učitavanju regija."); return }
      setRegions(await res.json())
    } catch {
      setError("Greška pri dohvaćanju regija.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <>
      <PageHeader
        title="Regije i gradovi"
        description="Geografska taksonomija: regije, županije i gradovi."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Regije" }]}
      />
      {loading ? (
        <TableLoadingState />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <div className="flex flex-col gap-6">
          {regions.map((region) => (
            <div key={region.id} className="flex flex-col gap-3">
              <h2 className="text-base font-semibold">{region.name}</h2>
              {region.counties.map((county) => (
                <div key={county.id}>
                  <p className="mb-1.5 text-sm font-medium text-muted-foreground">{county.name}</p>
                  <div className="overflow-x-auto rounded-xl border border-border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="w-12">ID</TableHead>
                          <TableHead>Naziv</TableHead>
                          <TableHead>Slug</TableHead>
                          <TableHead className="text-right">Lat</TableHead>
                          <TableHead className="text-right">Lng</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {county.cities.map((city) => (
                          <TableRow key={city.id}>
                            <TableCell className="tabular-nums text-muted-foreground">{city.id}</TableCell>
                            <TableCell className="font-medium">{city.name}</TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">{city.slug}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {city.lat ?? "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {city.lng ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
