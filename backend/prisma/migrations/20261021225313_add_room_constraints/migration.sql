-- This is an empty migration.
ALTER TABLE "rooms"
ADD CONSTRAINT "rooms_maxPlayers_check"
CHECK ("maxPlayers" >= 3 AND "maxPlayers" <= 8);

ALTER TABLE "rooms"
ADD CONSTRAINT "rooms_private_invite_check"
CHECK (
  ("isPrivate" = TRUE AND "inviteCode" IS NOT NULL)
  OR
  ("isPrivate" = FALSE AND "inviteCode" IS NULL)
);