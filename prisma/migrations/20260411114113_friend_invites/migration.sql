-- CreateTable
CREATE TABLE "FriendInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "inviterUserId" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FriendInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FriendInvite_token_key" ON "FriendInvite"("token");

-- CreateIndex
CREATE INDEX "FriendInvite_inviteeEmail_idx" ON "FriendInvite"("inviteeEmail");

-- CreateIndex
CREATE UNIQUE INDEX "FriendInvite_inviterUserId_inviteeEmail_key" ON "FriendInvite"("inviterUserId", "inviteeEmail");

-- AddForeignKey
ALTER TABLE "FriendInvite" ADD CONSTRAINT "FriendInvite_inviterUserId_fkey" FOREIGN KEY ("inviterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
