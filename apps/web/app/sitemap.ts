import type { MetadataRoute } from "next";
import { api, WEB_URL } from "../lib/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await api<{ events: { slug: string; updatedAt: string }[]; regions: { slug: string }[]; cities: { slug: string }[]; categories: { slug: string }[] }>("/public/seo/sitemap-data");
  return [
    { url: WEB_URL },
    ...data.events.map((e) => ({ url: `${WEB_URL}/eventi/${e.slug}`, lastModified: e.updatedAt })),
    ...data.regions.map((r) => ({ url: `${WEB_URL}/regije/${r.slug}` })),
    ...data.cities.map((c) => ({ url: `${WEB_URL}/gradovi/${c.slug}` })),
    ...data.categories.map((c) => ({ url: `${WEB_URL}/kategorije/${c.slug}` }))
  ];
}
