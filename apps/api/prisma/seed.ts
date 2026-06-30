import { PrismaClient, EventStatus, EventSourceKind, OrganizerStatus, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@manifestacije.test";
const adminPassword = process.env.SEED_ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "admin1234");
const seedDemoData = process.env.SEED_DEMO_DATA !== "false";

if (!adminPassword) {
  throw new Error("SEED_ADMIN_PASSWORD must be set when running seed in production");
}

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
    ["Brodsko-posavska", "brodsko-posavska", slavonija.id],
    ["Požeško-slavonska", "pozesko-slavonska", slavonija.id],
    ["Virovitičko-podravska", "viroviticko-podravska", slavonija.id],
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
  const bpCounty = await prisma.county.findUniqueOrThrow({ where: { slug: "brodsko-posavska" } });
  const psCounty = await prisma.county.findUniqueOrThrow({ where: { slug: "pozesko-slavonska" } });
  const vpCounty = await prisma.county.findUniqueOrThrow({ where: { slug: "viroviticko-podravska" } });
  const zgCounty = await prisma.county.findUniqueOrThrow({ where: { slug: "grad-zagreb" } });
  const cities = [
    ["Osijek", osCounty.id, 45.555, 18.695],
    ["Zagreb", zgCounty.id, 45.815, 15.982],
    ["Đakovo", osCounty.id, 45.309, 18.410],
    ["Vukovar", vuCounty.id, 45.351, 19.003],
    ["Vinkovci", vuCounty.id, 45.288, 18.804],
    ["Našice", osCounty.id, 45.488, 18.087],
    ["Valpovo", osCounty.id, 45.660, 18.418],
    ["Beli Manastir", osCounty.id, 45.771, 18.603],
    ["Donji Miholjac", osCounty.id, 45.761, 18.167],
    ["Erdut", osCounty.id, 45.526, 19.061],
    ["Čepin", osCounty.id, 45.523, 18.563],
    ["Belišće", osCounty.id, 45.681, 18.405],
    ["Darda", osCounty.id, 45.628, 18.699],
    ["Bilje", osCounty.id, 45.607, 18.744],
    ["Bizovac", osCounty.id, 45.592, 18.458],
    ["Kneževi Vinogradi", osCounty.id, 45.750, 18.733],
    ["Batina", osCounty.id, 45.850, 18.850],
    ["Aljmaš", osCounty.id, 45.530, 18.950],
    ["Petrijevci", osCounty.id, 45.612, 18.535],
    ["Sarvaš", osCounty.id, 45.534, 18.837],
    ["Tenja", osCounty.id, 45.498, 18.747],
    ["Antunovac", osCounty.id, 45.490, 18.676],
    ["Višnjevac", osCounty.id, 45.568, 18.613],
    ["Karanac", osCounty.id, 45.760, 18.684],
    ["Zmajevac", osCounty.id, 45.801, 18.804],
    ["Ilok", vuCounty.id, 45.222, 19.376],
    ["Županja", vuCounty.id, 45.077, 18.697],
    ["Otok", vuCounty.id, 45.146, 18.883],
    ["Tovarnik", vuCounty.id, 45.165, 19.153],
    ["Nuštar", vuCounty.id, 45.332, 18.842],
    ["Borovo", vuCounty.id, 45.376, 18.966],
    ["Slavonski Brod", bpCounty.id, 45.160, 18.015],
    ["Nova Gradiška", bpCounty.id, 45.256, 17.383],
    ["Slavonski Šamac", bpCounty.id, 45.066, 18.488],
    ["Požega", psCounty.id, 45.331, 17.674],
    ["Pakrac", psCounty.id, 45.436, 17.188],
    ["Lipik", psCounty.id, 45.412, 17.152],
    ["Pleternica", psCounty.id, 45.288, 17.806],
    ["Kutjevo", psCounty.id, 45.426, 17.883],
    ["Virovitica", vpCounty.id, 45.832, 17.383],
    ["Slatina", vpCounty.id, 45.704, 17.703],
    ["Orahovica", vpCounty.id, 45.541, 17.884],
    ["Pitomača", vpCounty.id, 45.950, 17.233]
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

  const adminHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash, role: UserRole.ADMIN, name: "Admin" },
    create: { email: adminEmail, passwordHash: adminHash, role: UserRole.ADMIN, name: "Admin" }
  });

  if (!seedDemoData) return;

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
