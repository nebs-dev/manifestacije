/**
 * Empties the disposable E2E database.
 *
 * Run through `pnpm --filter api exec tsx` so that `@prisma/client` resolves
 * from apps/api; the global setup does exactly that. The table list is read
 * from the live schema rather than hardcoded, so a new migration cannot leave
 * stale rows behind and silently break isolation.
 *
 * The guard is repeated here instead of imported: this script is executable on
 * its own, and the one thing it must never do is run against a real database.
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
const parsed = new URL(url);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.port !== "5443" || parsed.pathname !== "/e2e_qa") {
  throw new Error(`reset-db refuses to touch ${parsed.hostname}:${parsed.port}${parsed.pathname}`);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (!tables.length) throw new Error("No tables found — run `prisma migrate deploy` against the E2E database first");

  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  // One statement: CASCADE settles the foreign keys and RESTART IDENTITY makes
  // generated ids repeat from 1, so a failing test reports the same ids twice.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  console.log(`[e2e] truncated ${tables.length} tables in ${parsed.pathname}`);
}

main()
  .catch((error) => {
    console.error(`[e2e] reset failed: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
