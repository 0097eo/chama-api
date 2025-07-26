-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CHAMA_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'CHAMA_DELETE';
ALTER TYPE "AuditAction" ADD VALUE 'CHAMA_MEMBER_ADD';
ALTER TYPE "AuditAction" ADD VALUE 'CHAMA_MEMBER_REMOVE';
ALTER TYPE "AuditAction" ADD VALUE 'CHAMA_MEMBER_ROLE_UPDATE';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "chamaId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_chamaId_idx" ON "AuditLog"("chamaId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_chamaId_fkey" FOREIGN KEY ("chamaId") REFERENCES "Chama"("id") ON DELETE CASCADE ON UPDATE CASCADE;
