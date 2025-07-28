-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "disbursedAt" TIMESTAMP(3),
ADD COLUMN     "isRestructured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monthlyInstallment" DOUBLE PRECISION,
ADD COLUMN     "repaymentAmount" DOUBLE PRECISION,
ADD COLUMN     "restructureNotes" TEXT;
