-- CreateEnum
CREATE TYPE "OrganizerClaimStatus" AS ENUM ('PENDING', 'EMAIL_VERIFICATION_SENT', 'NEEDS_ADMIN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED', 'EXPIRED');

-- CreateTable
CREATE TABLE "OrganizerClaim" (
    "id" SERIAL NOT NULL,
    "organizerId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT,
    "status" "OrganizerClaimStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "internalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizerClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerClaim_tokenHash_key" ON "OrganizerClaim"("tokenHash");

-- CreateIndex
CREATE INDEX "OrganizerClaim_organizerId_idx" ON "OrganizerClaim"("organizerId");

-- CreateIndex
CREATE INDEX "OrganizerClaim_email_idx" ON "OrganizerClaim"("email");

-- CreateIndex
CREATE INDEX "OrganizerClaim_status_idx" ON "OrganizerClaim"("status");

-- AddForeignKey
ALTER TABLE "OrganizerClaim" ADD CONSTRAINT "OrganizerClaim_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
