import type { MetadataRoute } from "next";
import { api, WEB_URL } from "@/lib/api";
import { canonicalRegionSlug } from "@/lib/seo-taxonomy";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await api<{
    events: { slug: string; updatedAt: string }[];
    regions: { slug: string }[];
    cities: { slug: string }[];
    categories: { slug: string }[];
    cityCategories: { citySlug: string; categorySlug: string }[];
    regionCategories: { regionSlug: string; categorySlug: string }[];
    weekendCities: { slug: string }[];
    weekendRegions: { slug: string }[];
  }>("/public/seo/sitemap-data");
  return [
    { url: WEB_URL },
    { url: `${WEB_URL}/eventi` },
    { url: `${WEB_URL}/danas` },
    { url: `${WEB_URL}/ovaj-vikend` },
    { url: `${WEB_URL}/kalendar` },
    { url: `${WEB_URL}/prosli-dogadaji` },
    { url: `${WEB_URL}/mapa` },
    { url: `${WEB_URL}/gradovi` },
    { url: `${WEB_URL}/regije` },
    // Indexable standalone pages with their own title and content. /dodaj-event
    // and /pridruzi-se stay out: the first has no metadata of its own, the
    // second is noindex.
    { url: `${WEB_URL}/uvjeti-koristenja` },
    { url: `${WEB_URL}/pravila-privatnosti` },
    { url: `${WEB_URL}/kolacici` },
    ...data.events.map((e) => ({ url: `${WEB_URL}/eventi/${e.slug}`, lastModified: e.updatedAt })),
    // The API returns the long region slugs; only the canonical (short) form
    // belongs in the sitemap — the long one 301s (see next.config.js).
    ...data.regions.map((r) => ({ url: `${WEB_URL}/regije/${canonicalRegionSlug(r.slug)}` })),
    ...data.cities.map((c) => ({ url: `${WEB_URL}/gradovi/${c.slug}` })),
    ...data.categories.map((c) => ({ url: `${WEB_URL}/kategorije/${c.slug}` })),
    ...data.cityCategories.map((item) => ({ url: `${WEB_URL}/gradovi/${item.citySlug}/kategorije/${item.categorySlug}` })),
    ...data.regionCategories.map((item) => ({ url: `${WEB_URL}/regije/${canonicalRegionSlug(item.regionSlug)}/kategorije/${item.categorySlug}` })),
    ...(data.weekendCities ?? []).map((city) => ({ url: `${WEB_URL}/kamo-za-vikend/gradovi/${city.slug}` })),
    ...(data.weekendRegions ?? []).map((region) => ({ url: `${WEB_URL}/kamo-za-vikend/regije/${canonicalRegionSlug(region.slug)}` }))
  ];
}
