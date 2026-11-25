/*
  Warnings:

  - A unique constraint covering the columns `[paymentIntentId]` on the table `Registration` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Registration" ALTER COLUMN "status" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Registration_paymentIntentId_key" ON "Registration"("paymentIntentId");
