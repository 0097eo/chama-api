/*
  Warnings:

  - You are about to drop the column `userId` on the `Notification` table. All the data in the column will be lost.
  - Added the required column `membershipId` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropIndex
DROP INDEX "public"."Notification_userId_idx";

-- AlterTable
ALTER TABLE "public"."Notification" DROP COLUMN "userId",
ADD COLUMN     "membershipId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Notification_membershipId_idx" ON "public"."Notification"("membershipId");

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
