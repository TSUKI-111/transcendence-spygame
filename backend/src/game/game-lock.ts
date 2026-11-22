import type {Prisma} from "../generated/prisma/client.js";

// Must be called INSIDE a Prisma transaction
export async function lockGame(tx: Prisma.TransactionClient, gameId: string): Promise<void>
{
	await tx.$queryRaw`SELECT "id" FROM "games" WHERE "id" = ${gameId}::uuid FOR NO KEY UPDATE`;
}
