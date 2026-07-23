import type { MetadataRoute } from "next";
import { api, WEB_URL } from "@/lib/api";

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
    { url: `${WEB_URL}/kamo-za-vikend` },
    { url: `${WEB_URL}/kalendar` },
    { url: `${WEB_URL}/mapa` },
    { url: `${WEB_URL}/gradovi` },
    { url: `${WEB_URL}/regije` },
    ...data.events.map((e) => ({ url: `${WEB_URL}/eventi/${e.slug}`, lastModified: e.updatedAt })),
    ...data.regions.map((r) => ({ url: `${WEB_URL}/regije/${r.slug}` })),
    ...data.cities.map((c) => ({ url: `${WEB_URL}/gradovi/${c.slug}` })),
    ...data.categories.map((c) => ({ url: `${WEB_URL}/kategorije/${c.slug}` })),
    ...data.cityCategories.map((item) => ({ url: `${WEB_URL}/gradovi/${item.citySlug}/kategorije/${item.categorySlug}` })),
    ...data.regionCategories.map((item) => ({ url: `${WEB_URL}/regije/${item.regionSlug}/kategorije/${item.categorySlug}` })),
    ...(data.weekendCities ?? []).map((city) => ({ url: `${WEB_URL}/kamo-za-vikend/gradovi/${city.slug}` })),
    ...(data.weekendRegions ?? []).map((region) => ({ url: `${WEB_URL}/kamo-za-vikend/regije/${region.slug}` }))
  ];
}
