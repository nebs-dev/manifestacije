export type FieldFilter = { id: string; field: string; op: string; value: string }
export type EventFilters = {
  search: string
  fieldFilters: FieldFilter[]
  organizerId?: string
  createdByUserId?: string
  createdFrom?: string
  createdTo?: string
  startsFrom?: string
  startsTo?: string
  status?: string
}

const scalarFilters = ["organizerId", "createdByUserId", "createdFrom", "createdTo", "startsFrom", "startsTo", "status"] as const

export function eventFilterParams(filters: EventFilters) {
  const params = new URLSearchParams()
  if (filters.search.trim()) params.set("search", filters.search.trim())
  for (const key of scalarFilters) if (filters[key]) params.set(key, filters[key]!)
  if (filters.fieldFilters.length) params.set("fieldFilters", JSON.stringify(filters.fieldFilters))
  return params
}

export function parseEventFilters(searchParams: Record<string, string | string[] | undefined> = {}): EventFilters {
  const value = (key: string) => { const v = searchParams[key]; return Array.isArray(v) ? v[0] : v }
  let fieldFilters: FieldFilter[] = []
  try {
    const raw = JSON.parse(value("fieldFilters") || "[]")
    if (Array.isArray(raw)) fieldFilters = raw.flatMap((item, index) => {
      if (!item || typeof item.field !== "string" || !item.field) return []
      return [{ id: typeof item.id === "string" ? item.id : `filter-${index}`, field: item.field,
        op: typeof item.op === "string" ? item.op : "contains", value: typeof item.value === "string" ? item.value : "" }]
    })
  } catch { /* Invalid optional filter JSON has no effect, matching the API. */ }
  return { search: value("search") ?? "", fieldFilters, ...Object.fromEntries(scalarFilters.map(key => [key, value(key) ?? ""])) }
}
