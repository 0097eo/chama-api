/*
  Warnings:

  - Added the required column `paymentMethod` to the `LoanPayment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LoanPayment" ADD COLUMN     "paymentMethod" TEXT NOT NULL;
