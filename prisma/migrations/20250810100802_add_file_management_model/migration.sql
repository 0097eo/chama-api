-- CreateTable
CREATE TABLE "public"."File" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'document',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chamaId" TEXT NOT NULL,
    "uploaderId" TEXT,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "File_publicId_key" ON "public"."File"("publicId");

-- CreateIndex
CREATE INDEX "File_chamaId_idx" ON "public"."File"("chamaId");

-- CreateIndex
CREATE INDEX "File_uploaderId_idx" ON "public"."File"("uploaderId");

-- AddForeignKey
ALTER TABLE "public"."File" ADD CONSTRAINT "File_chamaId_fkey" FOREIGN KEY ("chamaId") REFERENCES "public"."Chama"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."File" ADD CONSTRAINT "File_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
