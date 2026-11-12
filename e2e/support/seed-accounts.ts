/**
 * Creates the pool of synthetic accounts the suite leases from, and writes a
 * manifest the tests read.
 *
 * Why a pool instead of registering through the UI in each test: POST
 * /api/auth/register and /api/auth/login are throttled to 10 requests a minute
 * per client IP (LOGIN_THROTTLE in auth.controller.ts), and every test here
 * arrives from 127.0.0.1. A suite that logged in for each test would start
 * failing with 429 as it grew — and that throttle is a feature worth keeping,
 * so the tests work around it rather than weakening it. Sessions are minted
 * from the signing secret instead (support/jwt.ts); the real login and
 * registration forms are still exercised, once each, by organizer-auth.spec.ts.
 *
 * Run through `pnpm --filter api exec tsx` so @prisma/client and bcryptjs
 * resolve from apps/api.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL ?? "";
const parsed = new URL(url);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.port !== "5443" || parsed.pathname !== "/e2e_qa") {
  throw new Error(`seed-accounts refuses to touch ${parsed.hostname}:${parsed.port}${parsed.pathname}`);
}

const POOL_SIZE = Number(process.env.E2E_ORGANIZER_POOL ?? 10);
const adminEmail = process.env.SEED_ADMIN_EMAIL!;
const organizerPassword = process.env.E2E_ORGANIZER_PASSWORD!;
const manifestPath = process.env.E2E_ACCOUNTS_FILE!;

const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
  if (admin.role !== "ADMIN") throw new Error(`${adminEmail} is not an ADMIN — did prisma:seed run?`);

  const passwordHash = await bcrypt.hash(organizerPassword, 10);
  const organizers = [];
  for (let index = 1; index <= POOL_SIZE; index += 1) {
    const name = `E2E organizator ${index}`;
    const slug = `e2e-organizator-${index}`;
    const email = `e2e-organizer-${index}@manifestacije.test`;
    const organizer = await prisma.organizer.upsert({
      where: { slug },
      update: { name, email, status: "CLAIMED" },
      create: { name, slug, email, status: "CLAIMED" },
    });
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, name, role: "ORGANIZER", organizerId: organizer.id },
      create: { email, passwordHash, name, role: "ORGANIZER", organizerId: organizer.id },
    });
    organizers.push({
      userId: user.id,
      email: user.email,
      name,
      authVersion: user.authVersion,
      organizerId: organizer.id,
      organizerName: name,
      organizerSlug: slug,
    });
  }

  // An unclaimed organizer (no linked User) for the claim/forgot-password path.
  const unclaimedSlug = "e2e-nepreuzeti-organizator";
  const unclaimed = await prisma.organizer.upsert({
    where: { slug: unclaimedSlug },
    update: { name: "E2E nepreuzeti organizator", email: "e2e-unclaimed@manifestacije.test" },
    create: { name: "E2E nepreuzeti organizator", slug: unclaimedSlug, email: "e2e-unclaimed@manifestacije.test" },
  });

  const reference = {
    categories: await prisma.category.findMany({ select: { id: true, slug: true, name: true }, orderBy: { sortOrder: "asc" } }),
    cities: await prisma.city.findMany({ select: { id: true, slug: true, name: true }, take: 5, orderBy: { name: "asc" } }),
  };

  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        runId: randomBytes(4).toString("hex"),
        admin: { userId: admin.id, email: admin.email, authVersion: admin.authVersion },
        organizers,
        unclaimed: { organizerId: unclaimed.id, slug: unclaimedSlug, email: unclaimed.email },
        reference,
      },
      null,
      2
    )
  );
  console.log(`[e2e] ${organizers.length} organizer accounts + 1 unclaimed organizer ready`);
}

main()
  .catch((error) => {
    console.error(`[e2e] seed-accounts failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
