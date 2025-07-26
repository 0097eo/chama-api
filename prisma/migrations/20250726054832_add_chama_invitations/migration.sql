-- CreateTable
CREATE TABLE "ChamaInvitation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "chamaId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "inviterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChamaInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChamaInvitation_code_key" ON "ChamaInvitation"("code");

-- CreateIndex
CREATE INDEX "ChamaInvitation_chamaId_idx" ON "ChamaInvitation"("chamaId");

-- CreateIndex
CREATE INDEX "ChamaInvitation_email_idx" ON "ChamaInvitation"("email");

-- AddForeignKey
ALTER TABLE "ChamaInvitation" ADD CONSTRAINT "ChamaInvitation_chamaId_fkey" FOREIGN KEY ("chamaId") REFERENCES "Chama"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChamaInvitation" ADD CONSTRAINT "ChamaInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
