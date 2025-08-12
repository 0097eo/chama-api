-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."AuditAction" ADD VALUE 'LOAN_APPLY';
ALTER TYPE "public"."AuditAction" ADD VALUE 'LOAN_APPROVE';
ALTER TYPE "public"."AuditAction" ADD VALUE 'LOAN_REJECT';
ALTER TYPE "public"."AuditAction" ADD VALUE 'LOAN_DISBURSE';
ALTER TYPE "public"."AuditAction" ADD VALUE 'LOAN_REPAYMENT';
ALTER TYPE "public"."AuditAction" ADD VALUE 'LOAN_RESTRUCTURE';

-- AlterTable
ALTER TABLE "public"."AuditLog" ADD COLUMN     "loanId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "public"."Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
