-- DropForeignKey
ALTER TABLE "public"."AuditLog" DROP CONSTRAINT "AuditLog_targetId_fkey";

-- AlterTable
ALTER TABLE "public"."AuditLog" ALTER COLUMN "targetId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
