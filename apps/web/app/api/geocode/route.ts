import { NextRequest, NextResponse } from "next/server"

// Slavonia and Baranja bounding box, used to bias/restrict both providers.
const VIEWBOX = { west: 17.0, south: 44.5, east: 19.5, north: 46.0 }

type GeocodeResult = {
  place_id: string | number
  lat: string
  lon: string
  display_name: string
  address: {
    name?: string
    road?: string
    house_number?: string
    city?: string
    town?: string
    village?: string
    city_district?: string
  }
}

async function searchGooglePlaces(q: string, apiKey: string): Promise<GeocodeResult[]> {
  const url = new URL("https://places.googleapis.com/v1/places:searchText")
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents",
    },
    body: JSON.stringify({
      textQuery: q,
      languageCode: "hr",
      locationBias: {
        rectangle: {
          low: { latitude: VIEWBOX.south, longitude: VIEWBOX.west },
          high: { latitude: VIEWBOX.north, longitude: VIEWBOX.east },
        },
      },
    }),
  }).catch(() => null)

  if (!res?.ok) return []
  const data = await res.json() as {
    places?: {
      id: string
      displayName?: { text?: string }
      formattedAddress?: string
      location?: { latitude: number; longitude: number }
      addressComponents?: { longText?: string; types?: string[] }[]
    }[]
  }

  return (data.places ?? []).map((p) => {
    const city = p.addressComponents?.find((c) => c.types?.includes("locality"))?.longText
      ?? p.addressComponents?.find((c) => c.types?.includes("administrative_area_level_2"))?.longText
    return {
      place_id: p.id,
      lat: String(p.location?.latitude ?? ""),
      lon: String(p.location?.longitude ?? ""),
      display_name: p.formattedAddress ?? p.displayName?.text ?? "",
      address: {
        name: p.displayName?.text,
        city,
      },
    }
  }).filter((r) => r.lat && r.lon)
}

async function searchNominatim(q: string): Promise<GeocodeResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("q", q)
  url.searchParams.set("format", "json")
  url.searchParams.set("addressdetails", "1")
  url.searchParams.set("limit", "7")
  url.searchParams.set("accept-language", "hr")
  // Bias toward Slavonia and Baranja without hard filtering so venue names work too
  url.searchParams.set("viewbox", `${VIEWBOX.west},${VIEWBOX.south},${VIEWBOX.east},${VIEWBOX.north}`)
  url.searchParams.set("bounded", "0")

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "Manifestacije/1.0 (contact@manifestacije.hr)" },
  }).catch(() => null)

  if (!res?.ok) return []
  return res.json() as Promise<GeocodeResult[]>
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? ""
  if (q.length < 2) return NextResponse.json([])

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (apiKey) {
    const results = await searchGooglePlaces(q, apiKey)
    if (results.length > 0) return NextResponse.json(results)
  }

  // Fallback: no key configured, or Places returned nothing.
  return NextResponse.json(await searchNominatim(q))
}
