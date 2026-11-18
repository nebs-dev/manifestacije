import type { MetadataRoute } from "next";
import { API_URL, WEB_URL } from "@/lib/api";
import { canonicalRegionSlug } from "@/lib/seo-taxonomy";

export const SITEMAP_REVALIDATE = 3600;

// Cached for an hour instead of rebuilt on every request (PERF-02). The shared
// `api()` helper hardcodes `cache: "no-store"`, which is right for the admin
// screens that use it but opts this route out of static rendering entirely:
// the sitemap was re-rendered on a function invocation for every crawl, at
// 2-3.5s a time. This route therefore does its own tagged fetch and leaves
// `api()` untouched. The `events` tag keeps the existing mutation webhook
// (app/api/revalidate/route.ts) working, so a published or edited event still
// reaches the sitemap immediately rather than waiting out the hour.
type SitemapData = {
  events: { slug: string; updatedAt: string }[];
  regions: { slug: string }[];
  cities: { slug: string }[];
  categories: { slug: string }[];
  cityCategories: { citySlug: string; categorySlug: string }[];
  regionCategories: { regionSlug: string; categorySlug: string }[];
  weekendCities: { slug: string }[];
  weekendRegions: { slug: string }[];
};

const EMPTY: SitemapData = {
  events: [], regions: [], cities: [], categories: [],
  cityCategories: [], regionCategories: [], weekendCities: [], weekendRegions: [],
};

// Caching the route means it is now also prerendered at build time, where the
// API may be unreachable — it is during `pnpm build` on a developer machine
// and in CI, and the other ISR pages already fall back to local data there
// rather than failing the build. The sitemap does the same, and says so
// loudly: a degraded sitemap keeps only the static pages, and would otherwise
// be cached for the hour. Next never caches a failed fetch, and the `events`
// webhook invalidates this route on the next event mutation, so the full list
// returns on the next revalidation either way.
async function fetchSitemapData(path: string): Promise<SitemapData> {
  try {
    const res = await fetch(`${API_URL}/api${path}`, {
      next: { revalidate: SITEMAP_REVALIDATE, tags: ["events"] },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as SitemapData;
  } catch (error) {
    console.error({ event: "sitemap_data_unavailable", outcome: "degraded", error: String(error) });
    return EMPTY;
  }
}

export const revalidate = SITEMAP_REVALIDATE;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await fetchSitemapData("/public/seo/sitemap-data");
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
