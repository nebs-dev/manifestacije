import { RevalidateService } from "../admin/revalidate.service";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { KNOWN_REGION_SLUGS, lookupCityGeo, normalizeCountyName, regionSlugForCounty } from "../common/croatia-geo";
import { resolveCountyAndRegion } from "../common/city-resolver";
import { slugify } from "../common/slug";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const prisma = new PrismaClient();
let publicDataChanged = false;
const apply = process.argv.includes("--apply");

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");
}

function cityMentionInText(text: string, cityName: string) {
  const normalizedText = normalize(text);
  const normalizedCity = normalize(cityName);
  return normalizedText.split(",").map((part) => part.trim()).includes(normalizedCity)
    || normalizedText.includes(` ${normalizedCity}`)
    || normalizedText.endsWith(normalizedCity);
}

/**
 * City rows carry a cached county/region link resolved once, when the city
 * was first created — a bad geocoding result (or an older, less accurate
 * version of this resolution logic) at that time leaves the city stuck on a
 * wrong county/region forever after, even though live geocoding for a venue
 * address on a *new* event under that same city works fine (it's a
 * completely separate per-request lookup). Re-resolves any city whose
 * cached region isn't one of the app's known regions.
 */
async function repairBrokenCityRegions() {
  const cities = await prisma.city.findMany({ include: { county: { include: { region: true } } } });
  let fixed = 0;

  for (const city of cities) {
    if (KNOWN_REGION_SLUGS.has(city.county.region.slug)) continue;

    console.log(JSON.stringify({
      step: "city-region-repair",
      cityId: city.id,
      cityName: city.name,
      badCounty: city.county.name,
      badRegionSlug: city.county.region.slug,
      applied: apply,
    }));

    if (!apply) continue;

    const geo = await lookupCityGeo(city.name);
    await sleep(1100); // be polite to Nominatim's ~1req/sec usage policy
    const resolvedRegionSlug = geo?.countyName ? regionSlugForCounty(normalizeCountyName(geo.countyName)) : undefined;
    if (!resolvedRegionSlug || !KNOWN_REGION_SLUGS.has(resolvedRegionSlug)) {
      console.log(JSON.stringify({
        step: "city-region-repair-skipped",
        cityId: city.id,
        cityName: city.name,
        reason: "geocoder-did-not-return-known-county-region",
        geo,
      }));
      continue;
    }
    const { county } = await resolveCountyAndRegion(prisma, { geo });
    await prisma.city.update({
      where: { id: city.id },
      data: { countyId: county.id, lat: geo?.lat ?? city.lat, lng: geo?.lng ?? city.lng },
    });
    publicDataChanged = true;
    fixed += 1;
  }

  console.log(JSON.stringify({ step: "city-region-repair-summary", fixed, mode: apply ? "apply" : "dry-run" }));
}

async function repairMissingCityCoordinates() {
  const cities = await prisma.city.findMany({ include: { county: { include: { region: true } } } });
  let fixed = 0;

  for (const city of cities) {
    if (city.lat !== null && city.lng !== null) continue;

    const geo = await lookupCityGeo(city.name);
    await sleep(1100); // be polite to Nominatim's ~1req/sec usage policy
    const resolvedRegionSlug = geo?.countyName ? regionSlugForCounty(normalizeCountyName(geo.countyName)) : undefined;
    const safeGeo = Boolean(geo && resolvedRegionSlug && KNOWN_REGION_SLUGS.has(resolvedRegionSlug));

    console.log(JSON.stringify({
      step: "city-coordinate-repair",
      cityId: city.id,
      cityName: city.name,
      current: { lat: city.lat, lng: city.lng, county: city.county.name, regionSlug: city.county.region.slug },
      suggestion: safeGeo ? { lat: geo!.lat, lng: geo!.lng, countyName: geo!.countyName, regionSlug: resolvedRegionSlug } : null,
      applied: apply && safeGeo,
    }));

    if (!apply || !safeGeo) continue;

    const { county } = await resolveCountyAndRegion(prisma, { geo });
    await prisma.city.update({
      where: { id: city.id },
      data: { lat: geo!.lat, lng: geo!.lng, countyId: county.id },
    });
    publicDataChanged = true;
    fixed += 1;
  }

  console.log(JSON.stringify({ step: "city-coordinate-repair-summary", fixed, mode: apply ? "apply" : "dry-run" }));
}

function duplicateCityKey(city: { name: string; slug: string }) {
  const nameSlug = slugify(city.name);
  const baseSlug = city.slug.replace(/-\d+$/, "");
  return nameSlug && nameSlug === baseSlug ? baseSlug : null;
}

function isDuplicateCityRow(city?: { name: string; slug: string } | null) {
  const key = city ? duplicateCityKey(city) : null;
  return Boolean(key && city?.slug !== key);
}

async function mergeDuplicateCities() {
  const cities = await prisma.city.findMany({ include: { county: { include: { region: true } } }, orderBy: { id: "asc" } });
  const groups = new Map<string, typeof cities>();
  for (const city of cities) {
    const key = duplicateCityKey(city);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(city);
    groups.set(key, group);
  }

  let planned = 0;
  let merged = 0;
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const canonical = group.find((city) => city.slug === key) ?? group[0];
    const duplicates = group.filter((city) => city.id !== canonical.id);

    for (const duplicate of duplicates) {
      planned += 1;
      const [directEventCount, venueEventCount, venueCount] = await Promise.all([
        prisma.event.count({ where: { cityId: duplicate.id } }),
        prisma.event.count({ where: { venue: { cityId: duplicate.id } } }),
        prisma.venue.count({ where: { cityId: duplicate.id } }),
      ]);

      console.log(JSON.stringify({
        step: "city-duplicate-merge",
        key,
        canonical: { cityId: canonical.id, name: canonical.name, slug: canonical.slug },
        duplicate: { cityId: duplicate.id, name: duplicate.name, slug: duplicate.slug },
        directEventCount,
        venueEventCount,
        venueCount,
        applied: apply,
      }));

      if (!apply) continue;

      await prisma.$transaction(async (tx) => {
        await tx.event.updateMany({
          where: { cityId: duplicate.id },
          data: {
            cityName: canonical.name,
            cityId: canonical.id,
            countyId: canonical.countyId,
            regionId: canonical.county.regionId,
          },
        });

        const duplicateVenues = await tx.venue.findMany({ where: { cityId: duplicate.id } });
        for (const venue of duplicateVenues) {
          const existingVenue = await tx.venue.findUnique({
            where: { slug_cityId: { slug: venue.slug, cityId: canonical.id } },
          });

          if (existingVenue) {
            await tx.event.updateMany({
              where: { venueId: venue.id },
              data: {
                venueId: existingVenue.id,
                cityName: canonical.name,
                cityId: canonical.id,
                countyId: canonical.countyId,
                regionId: canonical.county.regionId,
              },
            });
            await tx.venue.delete({ where: { id: venue.id } });
          } else {
            await tx.venue.update({ where: { id: venue.id }, data: { cityId: canonical.id } });
            await tx.event.updateMany({
              where: { venueId: venue.id },
              data: {
                cityName: canonical.name,
                cityId: canonical.id,
                countyId: canonical.countyId,
                regionId: canonical.county.regionId,
              },
            });
          }
        }

        await tx.city.delete({ where: { id: duplicate.id } });
      });
      publicDataChanged = true;
      merged += 1;
    }
  }

  console.log(JSON.stringify({ step: "city-duplicate-merge-summary", planned, merged, mode: apply ? "apply" : "dry-run" }));
}

function buildCanonicalCityResolver<T extends { id: number; name: string; slug: string; county: { region: { slug: string } } }>(cities: T[]) {
  const groups = new Map<string, T[]>();
  for (const city of cities) {
    const key = slugify(city.name);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(city);
    groups.set(key, group);
  }

  const canonicalByKey = new Map<string, T>();
  for (const [key, group] of groups) {
    const canonical = group.find((city) => city.slug === key)
      ?? group.find((city) => KNOWN_REGION_SLUGS.has(city.county.region.slug))
      ?? group[0];
    canonicalByKey.set(key, canonical);
    for (const city of group) canonicalByKey.set(normalize(city.name), canonical);
  }

  return {
    canonicalCity(city: T) {
      return canonicalByKey.get(slugify(city.name)) ?? canonicalByKey.get(normalize(city.name)) ?? city;
    },
    cityByName(name?: string | null) {
      return name ? canonicalByKey.get(slugify(name)) ?? canonicalByKey.get(normalize(name)) : undefined;
    },
  };
}

async function main() {
  await repairBrokenCityRegions();
  await repairMissingCityCoordinates();
  await mergeDuplicateCities();

  const cities = await prisma.city.findMany({ include: { county: { include: { region: true } } } });
  const citiesByLongestName = [...cities].sort((a, b) => b.name.length - a.name.length);
  const cityResolver = buildCanonicalCityResolver(cities);
  const events = await prisma.event.findMany({
    include: { city: true, county: true, region: true, venue: true },
    orderBy: { id: "asc" },
  });

  let inspected = 0;
  let suggested = 0;
  let changed = 0;

  for (const event of events) {
    inspected += 1;
    const missingRegion = !event.regionId || !event.region?.slug || !KNOWN_REGION_SLUGS.has(event.region.slug);
    const haystack = [event.address, missingRegion ? event.venue?.address : null, event.cityName].filter(Boolean).join(", ");
    const cityFromAddressMatch = haystack
      ? citiesByLongestName.find((city) => cityMentionInText(haystack, city.name))
      : undefined;
    const cityFromAddress = cityFromAddressMatch ? cityResolver.canonicalCity(cityFromAddressMatch) : undefined;
    const cityFromCityNameMatch = cityResolver.cityByName(event.cityName);
    const cityFromCityName = cityFromCityNameMatch && KNOWN_REGION_SLUGS.has(cityFromCityNameMatch.county.region.slug)
      ? cityFromCityNameMatch
      : undefined;
    let targetCity = cityFromAddress ?? cityFromCityName;
    const cityMismatch = Boolean(targetCity && event.cityId !== targetCity.id);
    const cityNameMismatch = Boolean(event.city && event.cityName && normalize(event.cityName) !== normalize(event.city.name));
    const duplicateCurrentCity = isDuplicateCityRow(event.city);
    const autoRepairCandidate = Boolean(targetCity && (missingRegion || cityNameMismatch || duplicateCurrentCity));

    if (!cityMismatch && !missingRegion && !cityNameMismatch) continue;
    if (!autoRepairCandidate) {
      console.log(JSON.stringify({
        step: "city-manual-review",
        eventId: event.id,
        title: event.title,
        status: event.status,
        current: {
          cityName: event.cityName,
          cityId: event.cityId,
          city: event.city?.name,
          county: event.county?.name,
          region: event.region?.name,
          regionSlug: event.region?.slug,
          address: event.address,
          venue: event.venue?.name,
          venueCityId: event.venue?.cityId,
          venueAddress: event.venue?.address,
        },
        issues: {
          cityMismatch,
          cityNameMismatch,
          missingRegion,
        },
        suggestion: targetCity ? {
          cityName: targetCity.name,
          cityId: targetCity.id,
          countyId: targetCity.countyId,
          regionId: targetCity.county.regionId,
          regionSlug: targetCity.county.region.slug,
        } : null,
        reason: "valid-region-city-mismatch-needs-human-review",
        applied: false,
      }));
      continue;
    }
    suggested += 1;
    const needsGeocoding = false;

    const suggestion = targetCity
      ? {
          cityName: targetCity.name,
          cityId: targetCity.id,
          countyId: targetCity.countyId,
          regionId: targetCity.county.regionId,
          regionSlug: targetCity.county.region.slug,
        }
      : null;

    console.log(JSON.stringify({
      eventId: event.id,
      title: event.title,
      status: event.status,
      current: {
        cityName: event.cityName,
        cityId: event.cityId,
        city: event.city?.name,
        county: event.county?.name,
        region: event.region?.name,
        regionSlug: event.region?.slug,
        address: event.address,
        venue: event.venue?.name,
        venueCityId: event.venue?.cityId,
        venueAddress: event.venue?.address,
      },
      issues: {
        cityMismatch,
        cityNameMismatch,
        missingRegion,
        duplicateCurrentCity,
        needsGeocoding,
      },
      suggestion,
      geocoded: false,
      applied: apply && Boolean(suggestion),
    }));

    if (apply && suggestion) {
      let venueId: number | undefined;
      if (event.venue?.name) {
        const venueSlug = slugify(event.venue.name);
        const venue = await prisma.venue.upsert({
          where: { slug_cityId: { slug: venueSlug, cityId: suggestion.cityId } },
          update: {
            address: event.address ?? event.venue.address,
            lat: event.lat ?? event.venue.lat,
            lng: event.lng ?? event.venue.lng,
          },
          create: {
            name: event.venue.name,
            slug: venueSlug,
            cityId: suggestion.cityId,
            address: event.address ?? event.venue.address,
            lat: event.lat ?? event.venue.lat,
            lng: event.lng ?? event.venue.lng,
          },
        });
        venueId = venue.id;
      }

      await prisma.event.update({
        where: { id: event.id },
        data: {
          cityName: suggestion.cityName,
          cityId: suggestion.cityId,
          countyId: suggestion.countyId,
          regionId: suggestion.regionId,
          venueId,
        },
      });
      publicDataChanged = true;
      changed += 1;
    }
  }

  console.log(JSON.stringify({ inspected, suggested, changed, mode: apply ? "apply" : "dry-run" }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (publicDataChanged) {
      const cache = new RevalidateService();
      await cache.revalidate("events");
      await cache.revalidate("taxonomy");
    }
    await prisma.$disconnect();
  });
