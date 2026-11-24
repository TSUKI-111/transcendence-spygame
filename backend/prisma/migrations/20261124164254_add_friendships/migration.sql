-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- CreateTable
CREATE TABLE "friendships" (
    "id" SERIAL NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "friendships_requesterId_status_idx" ON "friendships"("requesterId", "status");

-- CreateIndex
CREATE INDEX "friendships_recipientId_status_idx" ON "friendships"("recipientId", "status");

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prevent self-friendship
ALTER TABLE "friendships"
ADD CONSTRAINT "friendships_no_self_request_check"
CHECK ("requesterId" <> "recipientId");

-- Enforce status / acceptedAt consistency
ALTER TABLE "friendships"
ADD CONSTRAINT "friendships_status_acceptedAt_check"
CHECK (
    ("status" = 'PENDING' AND "acceptedAt" IS NULL)
    OR
    ("status" = 'ACCEPTED' AND "acceptedAt" IS NOT NULL)
);

-- Enforce one relationship per unordered pair of users
CREATE UNIQUE INDEX "friendships_unordered_pair_key"
ON "friendships" (
    LEAST("requesterId", "recipientId"),
    GREATEST("requesterId", "recipientId")
);