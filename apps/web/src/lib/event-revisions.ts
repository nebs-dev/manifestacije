export type RevisionChange = { field: string; original: unknown; proposed: unknown }
export type EventRevision = {
  id: number; eventId: number; version: number; status: "PENDING" | "APPROVED" | "REJECTED"
  submittedAt: string; reviewedAt?: string | null; rejectionReason?: string | null
  original: Record<string, unknown>; proposed: Record<string, unknown>; current?: Record<string, unknown>
  changes: RevisionChange[]; conflict: boolean
  organizer?: { id: number; name: string }
  submittedBy?: { name: string; email: string } | null
  event?: { id: number; title: string; slug: string }
  categories?: Array<{ id: number; name: string }>
}

export const REVISION_FIELD_LABELS: Record<string, string> = {
  title: "Naziv", description: "Opis", startsAt: "Početak", endsAt: "Završetak", isAllDay: "Cjelodnevno",
  occurrences: "Raspored termina", cityId: "Grad", cityName: "Naziv grada", venueName: "Mjesto / dvorana",
  address: "Adresa", lat: "Geografska širina", lng: "Geografska dužina", categoryId: "Primarna kategorija",
  categoryIds: "Kategorije", isFree: "Besplatno", priceText: "Cijena", ticketUrl: "Poveznica za ulaznice",
  sourceUrl: "Poveznica na događaj", imageUrl: "Slika",
}

export function revisionDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString("hr-HR", { timeZone: "Europe/Zagreb", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) : value
}

export function revisionValue(field: string, value: unknown, categories: EventRevision["categories"] = []): string {
  if (value === null || value === undefined || value === "") return "Nije navedeno"
  if (typeof value === "boolean") return value ? "Da" : "Ne"
  if ((field === "startsAt" || field === "endsAt") && typeof value === "string") return revisionDate(value)
  if (field === "categoryId") return categories?.find(category => category.id === value)?.name ?? String(value)
  if (field === "categoryIds" && Array.isArray(value)) return value.map(id => categories?.find(category => category.id === id)?.name ?? String(id)).join(", ") || "Nije navedeno"
  if (field === "occurrences" && Array.isArray(value)) return value.map(row => {
    const occurrence = row as { startsAt: string; endsAt?: string | null; isAllDay?: boolean }
    return `${revisionDate(occurrence.startsAt)}${occurrence.endsAt ? ` → ${revisionDate(occurrence.endsAt)}` : ""}${occurrence.isAllDay ? " · Cjelodnevno" : ""}`
  }).join("\n") || "Nema zasebnih termina"
  return typeof value === "object" ? JSON.stringify(value) : String(value)
}

export async function revisionApiError(response: Response) {
  const text = await response.text()
  try { const data = JSON.parse(text); return typeof data.message === "string" ? data.message : "Zahtjev nije uspio." } catch { return text || "Zahtjev nije uspio." }
}
