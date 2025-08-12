-- AlterTable
ALTER TABLE "public"."AuditLog" ADD COLUMN     "contributionId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_contributionId_idx" ON "public"."AuditLog"("contributionId");

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "public"."Contribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
