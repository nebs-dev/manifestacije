import { CITY_COORDS, type CroEvent } from "./data"
import { normalizeCity } from "./discovery-filters"

export const DISCOVERY_BOUNDS: [[number, number], [number, number]] = [[44.95, 16.9], [46.1, 19.5]]
export function resolveMapCity(query: string, results: CroEvent[]): [number, number] | undefined {
  const slug = normalizeCity(query)
  if (!slug) return undefined
  const matches = results.filter(event => normalizeCity(event.citySlug || event.city) === slug)
  if (!matches.length) return undefined
  const known = Object.entries(CITY_COORDS).find(([name]) => normalizeCity(name) === slug)
  if (known) return known[1]
  const coords = matches.filter(event => Number.isFinite(event.lat) && Number.isFinite(event.lng))
  if (!coords.length) return undefined
  const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
  return [median(coords.map(event => event.lat!)), median(coords.map(event => event.lng!))]
}
