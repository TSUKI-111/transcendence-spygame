import type {GameFinalResult} from "./game-final-result.interface.ts";

export interface LeaveGameResult
{
	gameId: string;
	roomId: string;
	departedUserId: number;

	// False if the player had already departed
	changed: boolean;

	// Null if the game continues
	finalResult: GameFinalResult | null;
}
