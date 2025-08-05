/*
  Warnings:

  - A unique constraint covering the columns `[mpesaB2CRequestId]` on the table `Loan` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "mpesaB2CRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Loan_mpesaB2CRequestId_key" ON "Loan"("mpesaB2CRequestId");
