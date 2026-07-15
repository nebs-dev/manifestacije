// Fixed mapping of every Croatian county (županija) to the app's 7 discovery regions.
// Counties are a real-world constant — this list never needs new entries, only the
// app's region slugs (defined in prisma/seed.ts) could change.
export const COUNTY_TO_REGION_SLUG: Record<string, string> = {
  "Grad Zagreb": "zagreb-i-okolica",
  "Zagrebačka županija": "zagreb-i-okolica",

  "Osječko-baranjska županija": "slavonija-i-baranja",
  "Vukovarsko-srijemska županija": "slavonija-i-baranja",
  "Brodsko-posavska županija": "slavonija-i-baranja",
  "Požeško-slavonska županija": "slavonija-i-baranja",
  "Virovitičko-podravska županija": "slavonija-i-baranja",

  "Splitsko-dalmatinska županija": "dalmacija",
  "Zadarska županija": "dalmacija",
  "Šibensko-kninska županija": "dalmacija",
  "Dubrovačko-neretvanska županija": "dalmacija",

  "Istarska županija": "istra-i-kvarner",
  "Primorsko-goranska županija": "istra-i-kvarner",

  "Sisačko-moslavačka županija": "sredisnja-hrvatska",
  "Karlovačka županija": "sredisnja-hrvatska",
  "Bjelovarsko-bilogorska županija": "sredisnja-hrvatska",
  "Koprivničko-križevačka županija": "sredisnja-hrvatska",

  "Ličko-senjska županija": "lika-i-gorski-kotar",

  "Međimurska županija": "medimurje-i-zagorje",
  "Krapinsko-zagorska županija": "medimurje-i-zagorje",
  "Varaždinska županija": "medimurje-i-zagorje",
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
  return lookupViaNominatim(cityName).catch(() => null);
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

  return { countyName: county, lat: place.location.latitude, lng: place.location.longitude };
}

type NominatimResult = {
  lat: string;
  lon: string;
  address?: { state?: string; county?: string };
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

  return { countyName: county, lat: parseFloat(row.lat), lng: parseFloat(row.lon) };
}
