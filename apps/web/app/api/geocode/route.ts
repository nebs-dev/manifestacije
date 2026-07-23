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
    county?: string
    state?: string
    regionSlug?: string
  }
}

const COUNTY_TO_REGION_SLUG: Record<string, string> = {
  "Grad Zagreb": "zagreb-i-okolica",
  "Zagrebačka": "zagreb-i-okolica",
  "Osječko-baranjska": "slavonija-i-baranja",
  "Vukovarsko-srijemska": "slavonija-i-baranja",
  "Brodsko-posavska": "slavonija-i-baranja",
  "Požeško-slavonska": "slavonija-i-baranja",
  "Virovitičko-podravska": "slavonija-i-baranja",
  "Splitsko-dalmatinska": "dalmacija",
  "Zadarska": "dalmacija",
  "Šibensko-kninska": "dalmacija",
  "Dubrovačko-neretvanska": "dalmacija",
  "Istarska": "istra-i-kvarner",
  "Primorsko-goranska": "istra-i-kvarner",
  "Sisačko-moslavačka": "sredisnja-hrvatska",
  "Karlovačka": "sredisnja-hrvatska",
  "Bjelovarsko-bilogorska": "sredisnja-hrvatska",
  "Koprivničko-križevačka": "sredisnja-hrvatska",
  "Ličko-senjska": "lika-i-gorski-kotar",
  "Međimurska": "medimurje-i-zagorje",
  "Krapinsko-zagorska": "medimurje-i-zagorje",
  "Varaždinska": "medimurje-i-zagorje",
}

const COUNTY_ALIASES: Record<string, string> = {
  "osijek baranja": "Osječko-baranjska",
  "osjecko baranjska": "Osječko-baranjska",
  "osijek-baranja": "Osječko-baranjska",
  "primorsko goranska": "Primorsko-goranska",
  "sibensko kninska": "Šibensko-kninska",
  "sibenik knin": "Šibensko-kninska",
  "varazdinska": "Varaždinska",
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
}

function normalizeCountyName(value?: string) {
  if (!value) return undefined
  const trimmed = value.trim().replace(/\s+County$/i, "").replace(/\s+županija$/i, "")
  return COUNTY_ALIASES[normalizeKey(trimmed)] ?? trimmed
}

function regionSlugForCounty(value?: string) {
  const county = normalizeCountyName(value)
  return county ? COUNTY_TO_REGION_SLUG[county] : undefined
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
      ?? p.addressComponents?.find((c) => c.types?.includes("postal_town"))?.longText
    const county = normalizeCountyName(p.addressComponents?.find((c) => c.types?.includes("administrative_area_level_1"))?.longText)
    return {
      place_id: p.id,
      lat: String(p.location?.latitude ?? ""),
      lon: String(p.location?.longitude ?? ""),
      display_name: p.formattedAddress ?? p.displayName?.text ?? "",
      address: {
        name: p.displayName?.text,
        city,
        state: county,
        regionSlug: regionSlugForCounty(county),
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
  const rows = await res.json() as GeocodeResult[]
  return rows.map((row) => {
    const county = normalizeCountyName(row.address?.state ?? row.address?.county)
    return {
      ...row,
      address: {
        ...row.address,
        state: county,
        regionSlug: regionSlugForCounty(county),
      },
    }
  })
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
