/*
  Warnings:

  - The `status` column on the `Meeting` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."MeetingStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."Meeting" ADD COLUMN     "minutes" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "public"."MeetingStatus" NOT NULL DEFAULT 'SCHEDULED';
