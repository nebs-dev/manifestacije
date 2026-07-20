import { PrismaClient, EmailContactSyncStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ResendContactsService } from "../contacts/resend-contacts.service";

/**
 * Idempotent retry for EmailContact rows stuck at syncStatus=FAILED.
 * Safe to run repeatedly — each row is re-synced individually and moves to
 * SYNCED/UNSUBSCRIBED on success or stays FAILED with an updated syncError.
 *
 * Usage: pnpm --filter api contacts:retry-failed
 */
async function main() {
  const prisma = new PrismaClient();
  const contacts = new ResendContactsService(prisma as unknown as PrismaService);

  const failed = await prisma.emailContact.findMany({
    where: { syncStatus: EmailContactSyncStatus.FAILED },
    select: { id: true, email: true },
  });

  console.log(`contacts:retry-failed — found ${failed.length} failed contact(s)`);

  let retried = 0;
  let stillFailed = 0;
  for (const row of failed) {
    const result = await contacts.retryFailedContact(row.id);
    if (result?.syncStatus === EmailContactSyncStatus.FAILED) {
      stillFailed++;
    } else {
      retried++;
    }
  }

  console.log(`contacts:retry-failed — recovered=${retried} still_failed=${stillFailed}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("contacts:retry-failed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
