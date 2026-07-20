import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ResendContactsService } from "../contacts/resend-contacts.service";

/**
 * Idempotent backfill for organizers with real evidence of engagement
 * (a linked ORGANIZER-role User, or CLAIMED/VERIFIED/TRUSTED status) —
 * never for organizers that merely exist, have events, or were created by
 * an admin/parser import. Safe to run repeatedly.
 *
 * Usage: pnpm --filter api contacts:backfill-engaged-organizers [--dry-run]
 */
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();
  const contacts = new ResendContactsService(prisma as unknown as PrismaService);

  console.log(`contacts:backfill-engaged-organizers — starting${dryRun ? " (dry run)" : ""}`);

  const stats = await contacts.backfillExistingEngagedOrganizers({ dryRun });

  console.log("contacts:backfill-engaged-organizers — done");
  console.log(`  scanned:                ${stats.scanned}`);
  console.log(`  eligible:               ${stats.eligible}`);
  console.log(`  created:                ${stats.created}`);
  console.log(`  updated:                ${stats.updated}`);
  console.log(`  already synced:         ${stats.alreadySynced}`);
  console.log(`  skipped unengaged:      ${stats.skippedUnengaged}`);
  console.log(`  unsubscribed preserved: ${stats.unsubscribedPreserved}`);
  console.log(`  failed:                 ${stats.failed}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("contacts:backfill-engaged-organizers failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
