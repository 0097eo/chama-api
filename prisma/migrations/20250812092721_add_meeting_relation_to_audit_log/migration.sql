-- AlterTable
ALTER TABLE "public"."AuditLog" ADD COLUMN     "meetingId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_loanId_idx" ON "public"."AuditLog"("loanId");

-- CreateIndex
CREATE INDEX "AuditLog_meetingId_idx" ON "public"."AuditLog"("meetingId");

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "public"."Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
