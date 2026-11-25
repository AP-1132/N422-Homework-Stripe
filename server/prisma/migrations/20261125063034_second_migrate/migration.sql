-- DropIndex
DROP INDEX "Registration_stripeSessionId_key";

-- CreateIndex
CREATE INDEX "Registration_stripeSessionId_idx" ON "Registration"("stripeSessionId");
