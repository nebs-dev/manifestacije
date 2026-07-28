// Fixed mapping of every Croatian county (županija) to the app's 7 discovery regions.
// Counties are a real-world constant — this list never needs new entries, only the
// app's region slugs (defined in prisma/seed.ts) could change.
export const COUNTY_TO_REGION_SLUG: Record<string, string> = {
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
};

export const KNOWN_REGION_SLUGS = new Set(Object.values(COUNTY_TO_REGION_SLUG));

export function regionSlugForCounty(countyName: string): string | undefined {
  return COUNTY_TO_REGION_SLUG[normalizeCountyName(countyName)];
}

export function regionNameFromSlug(slug: string) {
  return {
    "slavonija-i-baranja": "Slavonija i Baranja",
    "zagreb-i-okolica": "Zagreb i okolica",
    "dalmacija": "Dalmacija",
    "istra-i-kvarner": "Istra i Kvarner",
    "sredisnja-hrvatska": "Središnja Hrvatska",
    "lika-i-gorski-kotar": "Lika i Gorski kotar",
    "medimurje-i-zagorje": "Međimurje i Zagorje",
  }[slug];
}

const COUNTY_ALIASES: Record<string, string> = {
  "primorje-gorski kotar county": "Primorsko-goranska",
  "primorje-gorski kotar": "Primorsko-goranska",
  "primorsko goranska": "Primorsko-goranska",
  "sibenik-knin county": "Šibensko-kninska",
  "sibenik-knin": "Šibensko-kninska",
  "sibenik knin": "Šibensko-kninska",
  "sibensko kninska": "Šibensko-kninska",
  "varazdin county": "Varaždinska",
  "varazdinska": "Varaždinska",
  "osijek-baranja county": "Osječko-baranjska",
  "osijek-baranja": "Osječko-baranjska",
  "osijek baranja": "Osječko-baranjska",
  "osjecko baranjska": "Osječko-baranjska",
};

const CITY_FALLBACKS: Record<string, GeoLookupResult> = {
  drnis: { countyName: "Šibensko-kninska", lat: 43.8625, lng: 16.1556 },
  drniš: { countyName: "Šibensko-kninska", lat: 43.8625, lng: 16.1556 },
  rijeka: { countyName: "Primorsko-goranska", lat: 45.3271, lng: 14.4422 },
  varazdin: { countyName: "Varaždinska", lat: 46.3057, lng: 16.3366 },
  varaždin: { countyName: "Varaždinska", lat: 46.3057, lng: 16.3366 },
  belisce: { countyName: "Osječko-baranjska", lat: 45.6809, lng: 18.4056 },
  belišće: { countyName: "Osječko-baranjska", lat: 45.6809, lng: 18.4056 },
  pula: { countyName: "Istarska", lat: 44.8666, lng: 13.8496 },
  zadar: { countyName: "Zadarska", lat: 44.1194, lng: 15.2314 },
  split: { countyName: "Splitsko-dalmatinska", lat: 43.5081, lng: 16.4402 },
  dubrovnik: { countyName: "Dubrovačko-neretvanska", lat: 42.6507, lng: 18.0944 },
};

export type GeoLookupResult = {
  countyName: string;
  lat: number;
  lng: number;
};

type PlacesTextSearchResponse = {
  places?: {
    location?: { latitude: number; longitude: number };
    addressComponents?: { longText?: string; types?: string[] }[];
  }[];
};

// Resolves a free-text city name to its real Croatian county + coordinates via
// Google Places. Falls back to free Nominatim if no API key is configured.
export async function lookupCityGeo(cityName: string): Promise<GeoLookupResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (apiKey) {
    const viaGoogle = await lookupViaGooglePlaces(cityName, apiKey).catch(() => null);
    if (viaGoogle) return viaGoogle;
  }
  const viaNominatim = await lookupViaNominatim(cityName).catch(() => null);
  return viaNominatim ?? fallbackCityGeo(cityName);
}

export function fallbackCityGeo(cityName: string): GeoLookupResult | null {
  return CITY_FALLBACKS[normalizeKey(cityName)] ?? null;
}

export type PointGeo = {
  lat: number;
  lng: number;
  /** Street address as the provider knows it — lets a venue that was only
   *  ever given by name ("Gradsko kazalište Joza Ivakić") still end up with
   *  a real address on the event. */
  formattedAddress?: string;
};

/** Anything further than this from the city centre is treated as the geocoder
 *  having matched a same-named street in another town (or another country)
 *  rather than the venue we asked about. Mirrors the public site's own
 *  plausibility rule so the map and the stored point never disagree. */
const MAX_KM_FROM_CITY = 80;

/**
 * Resolves a venue's precise point from its street address, falling back to
 * the venue name (bars, halls and theatres are usually mapped by name even
 * when no street address is known). Unlike lookupCityGeo this does not
 * require the provider to report a county — a house number rarely needs one,
 * and demanding it would throw away otherwise good hits.
 *
 * Returns null rather than a guess when nothing plausible is found; callers
 * keep whatever coarser location they already had.
 */
export async function lookupVenueGeo(
  parts: { address?: string | null; venueName?: string | null; cityName?: string | null },
  cityCentre?: PointGeo | null,
): Promise<PointGeo | null> {
  const city = parts.cityName?.trim();
  const queries = [parts.address?.trim(), parts.venueName?.trim()]
    .filter((v): v is string => Boolean(v))
    .map((v) => [v, city, "Hrvatska"].filter(Boolean).join(", "));

  const centre = cityCentre ?? (city ? fallbackCityGeo(city) : null);

  for (const query of queries) {
    const point = await lookupPointGeo(query);
    if (!point) continue;
    if (centre && distanceKm(point, centre) > MAX_KM_FROM_CITY) continue;
    return point;
  }
  return null;
}

async function lookupPointGeo(query: string): Promise<PointGeo | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (apiKey) {
    const viaGoogle = await lookupPointViaGooglePlaces(query, apiKey).catch(() => null);
    if (viaGoogle) return viaGoogle;
  }
  return lookupPointViaNominatim(query).catch(() => null);
}

async function lookupPointViaGooglePlaces(query: string, apiKey: string): Promise<PointGeo | null> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.location,places.addressComponents",
    },
    body: JSON.stringify({ textQuery: query, languageCode: "hr" }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as PlacesTextSearchResponse;
  const place = data.places?.[0];
  if (!place?.location) return null;
  const component = (type: string) => place.addressComponents?.find((c) => c.types?.includes(type))?.longText;
  const route = component("route");
  const streetNumber = component("street_number");
  return {
    lat: place.location.latitude,
    lng: place.location.longitude,
    formattedAddress: route ? [route, streetNumber].filter(Boolean).join(" ") : undefined,
  };
}

async function lookupPointViaNominatim(query: string): Promise<PointGeo | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("accept-language", "hr");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "Manifestacije/1.0 (contact@manifestacije.hr)" },
  });
  if (!res.ok) return null;
  const row = ((await res.json()) as NominatimResult[])[0];
  if (!row) return null;
  const lat = parseFloat(row.lat);
  const lng = parseFloat(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const road = row.address?.road;
  return {
    lat,
    lng,
    formattedAddress: road ? [road, row.address?.house_number].filter(Boolean).join(" ") : undefined,
  };
}

function distanceKm(a: PointGeo, b: PointGeo): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const sinLat = Math.sin(toRad(b.lat - a.lat) / 2);
  const sinLng = Math.sin(toRad(b.lng - a.lng) / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

export function normalizeCountyName(countyName: string): string {
  const trimmed = countyName.trim().replace(/\s+County$/i, "").replace(/\s+županija$/i, "");
  return COUNTY_ALIASES[normalizeKey(trimmed)] ?? trimmed;
}

async function lookupViaGooglePlaces(cityName: string, apiKey: string): Promise<GeoLookupResult | null> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.location,places.addressComponents",
    },
    body: JSON.stringify({
      textQuery: `${cityName}, Hrvatska`,
      languageCode: "hr",
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as PlacesTextSearchResponse;
  const place = data.places?.[0];
  if (!place?.location) return null;

  const county = place.addressComponents?.find((c) => c.types?.includes("administrative_area_level_1"))?.longText;
  if (!county) return null;

  return { countyName: normalizeCountyName(county), lat: place.location.latitude, lng: place.location.longitude };
}

type NominatimResult = {
  lat: string;
  lon: string;
  address?: { state?: string; county?: string; road?: string; house_number?: string };
};

async function lookupViaNominatim(cityName: string): Promise<GeoLookupResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${cityName}, Hrvatska`);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("accept-language", "hr");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "Manifestacije/1.0 (contact@manifestacije.hr)" },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as NominatimResult[];
  const row = rows[0];
  const county = row?.address?.state;
  if (!row || !county) return null;

  return { countyName: normalizeCountyName(county), lat: parseFloat(row.lat), lng: parseFloat(row.lon) };
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}
