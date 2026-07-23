import type { PrismaClient } from "@prisma/client";
import { slugify, uniqueSlug } from "./slug";
import { KNOWN_REGION_SLUGS, lookupCityGeo, normalizeCountyName, regionNameFromSlug, regionSlugForCounty, type GeoLookupResult } from "./croatia-geo";

/**
 * Resolves (upserting as needed) the County + Region for a city, given an
 * explicit county/region override or a geocoding result. Shared by
 * findOrCreateCity and the repair script's city-region fixup pass so both
 * use identical fallback logic (county → region-for-county → given region →
 * "Slavonija i Baranja" as the last resort, since that's this app's primary
 * coverage area).
 */
export async function resolveCountyAndRegion(
  prisma: PrismaClient,
  options: { countyName?: string; regionName?: string; geo?: GeoLookupResult | null }
) {
  const cleanRegionSlug = options.regionName ? slugify(options.regionName) : undefined;
  const usableRegionSlug = cleanRegionSlug && KNOWN_REGION_SLUGS.has(cleanRegionSlug) ? cleanRegionSlug : undefined;
  const countyClean = normalizeCountyName(options.countyName?.trim() || options.geo?.countyName || "Nepoznata županija");
  const resolvedRegionSlug = regionSlugForCounty(countyClean);
  const regionSlug = resolvedRegionSlug || usableRegionSlug || "slavonija-i-baranja";
  const regionClean = regionNameFromSlug(regionSlug) || "Slavonija i Baranja";
  const region = await prisma.region.upsert({
    where: { slug: regionSlug },
    update: {},
    create: { name: regionClean, slug: regionSlug, sortOrder: 999 },
  });

  const countySlug = slugify(countyClean) || "nepoznata-zupanija";
  const county = await prisma.county.upsert({
    where: { slug: countySlug },
    update: {},
    create: { name: countyClean, slug: countySlug, regionId: region.id },
  });

  return { county, region };
}

/**
 * Finds an existing City by name, or creates one — resolving county/region
 * from an explicit override, or by live-geocoding the city name (Google
 * Places, falling back to Nominatim) when no override is given. Shared
 * between AdminService (new events) and the repair-event-locations script
 * (fixing existing events) so both use identical resolution logic.
 */
export async function findOrCreateCity(
  prisma: PrismaClient,
  name: string,
  countyName?: string,
  regionName?: string
) {
  const cleaned = name.trim();
  const existing = await prisma.city.findFirst({
    where: { name: { equals: cleaned, mode: "insensitive" } },
    include: { county: { include: { region: true } } },
  });
  if (existing) {
    if (KNOWN_REGION_SLUGS.has(existing.county.region.slug)) return existing;
    // This city is stuck on a bad/placeholder region from an earlier failed
    // lookup (or an older version of this resolution logic) — self-heal it
    // now that it's being used again, instead of leaving every future event
    // under this city name broken until someone runs the repair script.
    const geo = countyName || regionName ? null : await lookupCityGeo(cleaned);
    const { county } = await resolveCountyAndRegion(prisma, { countyName, regionName, geo });
    return prisma.city.update({
      where: { id: existing.id },
      data: { countyId: county.id, lat: geo?.lat ?? existing.lat, lng: geo?.lng ?? existing.lng },
    });
  }

  const cleanRegionSlug = regionName ? slugify(regionName) : undefined;
  const usableRegionSlug = cleanRegionSlug && KNOWN_REGION_SLUGS.has(cleanRegionSlug) ? cleanRegionSlug : undefined;
  const geo = countyName || usableRegionSlug ? null : await lookupCityGeo(cleaned);
  const { county } = await resolveCountyAndRegion(prisma, { countyName, regionName, geo });

  const citySlug = await uniqueSlug(cleaned, async (s) => !!(await prisma.city.findUnique({ where: { slug: s } })));
  return prisma.city.create({ data: { name: cleaned, slug: citySlug, countyId: county.id, lat: geo?.lat, lng: geo?.lng } });
}
