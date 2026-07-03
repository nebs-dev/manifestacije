/*
  Warnings:

  - You are about to drop the column `imageCredit` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `imageSourceUrl` on the `Event` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Event" DROP COLUMN "imageCredit",
DROP COLUMN "imageSourceUrl";
