import { RevalidateService } from "../admin/revalidate.service";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { ResendContactsService } from "../contacts/resend-contacts.service";
import { OrganizerClaimService } from "../organizer-claims/organizer-claim.service";

/**
 * Sends claim invitations to UNCLAIMED organizers with a usable email and no
 * already-active invite. Never run automatically during deploy/seed — this
 * is a deliberate manual command only. Does not add recipients to Resend
 * Contacts; that only happens once they complete the claim.
 *
 * Usage: pnpm --filter api claims:invite-unclaimed-organizers [--dry-run] [--limit=N]
 */
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 50;

  const prisma = new PrismaClient();
  const email = new EmailService();
  const contacts = new ResendContactsService(prisma as unknown as PrismaService);
  const claims = new OrganizerClaimService(prisma as unknown as PrismaService, email, contacts, new RevalidateService());

  console.log(`claims:invite-unclaimed-organizers — starting${dryRun ? " (dry run)" : ""} (limit=${limit})`);

  const stats = await claims.bulkInviteUnclaimedOrganizers({ dryRun, limit });

  console.log("claims:invite-unclaimed-organizers — done");
  console.log(`  scanned:              ${stats.scanned}`);
  console.log(`  eligible:             ${stats.eligible}`);
  console.log(`  invited:              ${stats.invited}`);
  console.log(`  active invite skipped:${stats.activeInviteSkipped}`);
  console.log(`  missing/invalid email:${stats.missingEmail}`);
  console.log(`  already claimed:      ${stats.alreadyClaimed}`);
  console.log(`  failed:               ${stats.failed}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("claims:invite-unclaimed-organizers failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
