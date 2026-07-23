import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { KNOWN_REGION_SLUGS } from "../common/croatia-geo";

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

async function main() {
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
    const targetCity = cityFromAddress ?? cityFromCityName;
    const cityMismatch = Boolean(targetCity && event.cityId !== targetCity.id);
    const missingRegion = !event.regionId || !event.region?.slug || !KNOWN_REGION_SLUGS.has(event.region.slug);
    const cityNameMismatch = Boolean(event.city && event.cityName && normalize(event.cityName) !== normalize(event.city.name));

    if (!cityMismatch && !missingRegion && !cityNameMismatch) continue;
    suggested += 1;

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
      },
      suggestion,
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
