import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { KNOWN_REGION_SLUGS, lookupCityGeo } from "../common/croatia-geo";
import { findOrCreateCity, resolveCountyAndRegion } from "../common/city-resolver";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const prisma = new PrismaClient();
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
    const { county } = await resolveCountyAndRegion(prisma, { geo });
    await prisma.city.update({
      where: { id: city.id },
      data: { countyId: county.id, lat: geo?.lat ?? city.lat, lng: geo?.lng ?? city.lng },
    });
    fixed += 1;
  }

  console.log(JSON.stringify({ step: "city-region-repair-summary", fixed, mode: apply ? "apply" : "dry-run" }));
}

async function main() {
  await repairBrokenCityRegions();

  const cities = await prisma.city.findMany({ include: { county: { include: { region: true } } } });
  const citiesByLongestName = [...cities].sort((a, b) => b.name.length - a.name.length);
  const cityByName = new Map(cities.map((city) => [normalize(city.name), city]));
  const events = await prisma.event.findMany({
    include: { city: true, county: true, region: true },
    orderBy: { id: "asc" },
  });

  let inspected = 0;
  let suggested = 0;
  let changed = 0;

  for (const event of events) {
    inspected += 1;
    const haystack = [event.address, event.cityName].filter(Boolean).join(", ");
    const cityFromAddress = haystack
      ? citiesByLongestName.find((city) => cityMentionInText(haystack, city.name))
      : undefined;
    const cityFromCityName = event.cityName ? cityByName.get(normalize(event.cityName)) : undefined;
    let targetCity = cityFromAddress ?? cityFromCityName;
    const cityMismatch = Boolean(targetCity && event.cityId !== targetCity.id);
    const missingRegion = !event.regionId || !event.region?.slug || !KNOWN_REGION_SLUGS.has(event.region.slug);
    const cityNameMismatch = Boolean(event.city && event.cityName && normalize(event.cityName) !== normalize(event.city.name));

    if (!cityMismatch && !missingRegion && !cityNameMismatch) continue;
    suggested += 1;

    // No local City row matches at all (e.g. a small village never seeded) —
    // in --apply mode, resolve it the same way a brand-new event would: live
    // geocode via findOrCreateCity, which also creates the County/Region if
    // needed. Skipped in dry-run to avoid burning geocoding API calls/quota
    // on a preview that might not be applied.
    let geocoded = false;
    if (!targetCity && event.cityName && apply) {
      const created = await findOrCreateCity(prisma, event.cityName);
      targetCity = await prisma.city.findUniqueOrThrow({
        where: { id: created.id },
        include: { county: { include: { region: true } } },
      });
      geocoded = true;
      await sleep(1100); // be polite to Nominatim's ~1req/sec usage policy
    }
    const needsGeocoding = !targetCity && Boolean(event.cityName) && !apply;

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
      },
      issues: {
        cityMismatch,
        cityNameMismatch,
        missingRegion,
        needsGeocoding,
      },
      suggestion,
      geocoded,
      applied: apply && Boolean(suggestion),
    }));

    if (apply && suggestion) {
      await prisma.event.update({
        where: { id: event.id },
        data: {
          cityName: suggestion.cityName,
          cityId: suggestion.cityId,
          countyId: suggestion.countyId,
          regionId: suggestion.regionId,
        },
      });
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
    await prisma.$disconnect();
  });
