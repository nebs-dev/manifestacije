import { PrismaClient, EventStatus, EventSourceKind, OrganizerStatus, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function main() {
  const regions = [
    "Slavonija i Baranja",
    "Zagreb i okolica",
    "Dalmacija",
    "Istra i Kvarner",
    "Središnja Hrvatska",
    "Lika i Gorski kotar",
    "Međimurje i Zagorje"
  ];
  for (const [sortOrder, name] of regions.entries()) {
    await prisma.region.upsert({
      where: { slug: slug(name) },
      update: { name, sortOrder },
      create: { name, slug: slug(name), sortOrder }
    });
  }

  const slavonija = await prisma.region.findUniqueOrThrow({ where: { slug: "slavonija-i-baranja" } });
  const zagrebRegion = await prisma.region.findUniqueOrThrow({ where: { slug: "zagreb-i-okolica" } });
  const countyRows = [
    ["Osječko-baranjska", "osjecko-baranjska", slavonija.id],
    ["Vukovarsko-srijemska", "vukovarsko-srijemska", slavonija.id],
    ["Grad Zagreb", "grad-zagreb", zagrebRegion.id]
  ] as const;
  for (const [name, countySlug, regionId] of countyRows) {
    await prisma.county.upsert({
      where: { slug: countySlug },
      update: { name, regionId },
      create: { name, slug: countySlug, regionId }
    });
  }

  const osCounty = await prisma.county.findUniqueOrThrow({ where: { slug: "osjecko-baranjska" } });
  const vuCounty = await prisma.county.findUniqueOrThrow({ where: { slug: "vukovarsko-srijemska" } });
  const zgCounty = await prisma.county.findUniqueOrThrow({ where: { slug: "grad-zagreb" } });
  const cities = [
    ["Osijek", osCounty.id, 45.555, 18.695],
    ["Zagreb", zgCounty.id, 45.815, 15.982],
    ["Đakovo", osCounty.id, 45.309, 18.410],
    ["Vukovar", vuCounty.id, 45.351, 19.003],
    ["Vinkovci", vuCounty.id, 45.288, 18.804],
    ["Našice", osCounty.id, 45.488, 18.087],
    ["Valpovo", osCounty.id, 45.660, 18.418],
    ["Beli Manastir", osCounty.id, 45.771, 18.603]
  ] as const;
  for (const [name, countyId, lat, lng] of cities) {
    await prisma.city.upsert({
      where: { slug: slug(name) },
      update: { name, countyId, lat, lng },
      create: { name, slug: slug(name), countyId, lat, lng }
    });
  }

  const categories = [
    "Glazba",
    "Kultura",
    "Djeca i obitelj",
    "Sport",
    "Outdoor",
    "Hrana i vino",
    "Radionice",
    "Sajmovi",
    "Humanitarno",
    "Noćni život",
    "Edukacija",
    "Udruge",
    "Tradicija i folklor",
    "Ostalo"
  ];
  for (const [sortOrder, name] of categories.entries()) {
    await prisma.category.upsert({
      where: { slug: slug(name) },
      update: { name, sortOrder },
      create: { name, slug: slug(name), sortOrder }
    });
  }

  const organizerNames = [
    "TZ Osijek",
    "Kulturni centar Osijek",
    "Udruga Slama",
    "Sportski savez Osijek",
    "Baranjski vinari",
    "Grad Đakovo",
    "Vukovar events",
    "Vinkovačke jeseni",
    "Našička scena",
    "Valpovačko ljeto"
  ];
  for (const name of organizerNames) {
    await prisma.organizer.upsert({
      where: { slug: slug(name) },
      update: { name },
      create: { name, slug: slug(name), email: `${slug(name)}@example.com`, status: OrganizerStatus.VERIFIED }
    });
  }

  const adminHash = await bcrypt.hash("admin1234", 10);
  await prisma.user.upsert({
    where: { email: "admin@manifestacije.test" },
    update: { passwordHash: adminHash, role: UserRole.ADMIN, name: "Admin" },
    create: { email: "admin@manifestacije.test", passwordHash: adminHash, role: UserRole.ADMIN, name: "Admin" }
  });

  const cityRows = await prisma.city.findMany({ include: { county: { include: { region: true } } } });
  const categoryRows = await prisma.category.findMany();
  const organizerRows = await prisma.organizer.findMany();
  const baseDate = new Date();
  baseDate.setHours(18, 0, 0, 0);

  for (let i = 0; i < 30; i++) {
    const city = cityRows[i % cityRows.length];
    const category = categoryRows[i % categoryRows.length];
    const organizer = organizerRows[i % organizerRows.length];
    const startsAt = new Date(baseDate);
    startsAt.setDate(baseDate.getDate() + i);
    const title = `${category.name} u ${city.name} ${i + 1}`;
    const venue = await prisma.venue.upsert({
      where: { slug_cityId: { slug: slug(`${city.name} centar`), cityId: city.id } },
      update: {},
      create: {
        name: `${city.name} centar`,
        slug: slug(`${city.name} centar`),
        cityId: city.id,
        address: "Trg 1"
      }
    });
    await prisma.event.upsert({
      where: { slug: slug(title) },
      update: {},
      create: {
        title,
        slug: slug(title),
        description: `Primjer manifestacije u ${city.name}. Program je seed podatak za razvoj MVP-a.`,
        shortDescription: `Seed događaj u ${city.name}.`,
        status: i < 24 ? EventStatus.PUBLISHED : EventStatus.PENDING_REVIEW,
        organizerId: organizer.id,
        venueId: venue.id,
        cityId: city.id,
        countyId: city.countyId,
        regionId: city.county.regionId,
        categoryId: category.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000),
        isAllDay: false,
        isFree: i % 3 !== 0,
        priceText: i % 3 === 0 ? "5 EUR" : null,
        sourceUrl: `https://example.com/event-${i + 1}`,
        sourceType: EventSourceKind.IMPORTED,
        extractionConfidence: 0.9,
        publishedAt: i < 24 ? new Date() : null
      }
    });
  }
}

main()
  .finally(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
