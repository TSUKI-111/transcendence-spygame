-- CreateEnum
CREATE TYPE "GamePhase" AS ENUM ('ROLE_ASSIGNMENT', 'CLUE_SUBMISSION', 'DISCUSSION', 'VOTING', 'FINISHED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "GameWinner" AS ENUM ('SPY', 'DETECTIVES');

-- CreateEnum
CREATE TYPE "TerminationReason" AS ENUM ('SPY_DEPARTED', 'INSUFFICIENT_PLAYERS');

-- CreateEnum
CREATE TYPE "GameRole" AS ENUM ('SPY', 'DETECTIVE');

-- CreateEnum
CREATE TYPE "ParticipationStatus" AS ENUM ('ACTIVE', 'ELIMINATED', 'DEPARTED');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "RoundOutcome" AS ENUM ('ELIMINATED', 'TIE', 'NO_VOTES');

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "phase" "GamePhase" NOT NULL,
    "currentRoundNumber" INTEGER NOT NULL,
    "secretWord" TEXT NOT NULL,
    "phaseEndsAt" TIMESTAMP(3),
    "winner" "GameWinner",
    "terminationReason" "TerminationReason",
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_players" (
    "id" SERIAL NOT NULL,
    "gameId" UUID NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "GameRole" NOT NULL,
    "participationStatus" "ParticipationStatus" NOT NULL,
    "connectionStatus" "ConnectionStatus" NOT NULL,

    CONSTRAINT "game_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_rounds" (
    "id" SERIAL NOT NULL,
    "gameId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "outcome" "RoundOutcome",
    "eliminatedGamePlayerId" INTEGER,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "game_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clues" (
    "id" SERIAL NOT NULL,
    "roundId" INTEGER NOT NULL,
    "authorGamePlayerId" INTEGER NOT NULL,
    "text" VARCHAR(100) NOT NULL,
    "normalizedText" VARCHAR(100) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" SERIAL NOT NULL,
    "roundId" INTEGER NOT NULL,
    "voterGamePlayerId" INTEGER NOT NULL,
    "targetGamePlayerId" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "games_roomId_key" ON "games"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "game_players_gameId_userId_key" ON "game_players"("gameId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "game_rounds_gameId_number_key" ON "game_rounds"("gameId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "clues_roundId_authorGamePlayerId_key" ON "clues"("roundId", "authorGamePlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "clues_roundId_normalizedText_key" ON "clues"("roundId", "normalizedText");

-- CreateIndex
CREATE UNIQUE INDEX "votes_roundId_voterGamePlayerId_key" ON "votes"("roundId", "voterGamePlayerId");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_eliminatedGamePlayerId_fkey" FOREIGN KEY ("eliminatedGamePlayerId") REFERENCES "game_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clues" ADD CONSTRAINT "clues_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "game_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clues" ADD CONSTRAINT "clues_authorGamePlayerId_fkey" FOREIGN KEY ("authorGamePlayerId") REFERENCES "game_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "game_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_voterGamePlayerId_fkey" FOREIGN KEY ("voterGamePlayerId") REFERENCES "game_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_targetGamePlayerId_fkey" FOREIGN KEY ("targetGamePlayerId") REFERENCES "game_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
