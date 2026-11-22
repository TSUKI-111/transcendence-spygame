export interface GameFinalResult
{
	gameId: string;
	roomId: string;
	status: "FINISHED" | "TERMINATED";
	winner : "SPY" | "DETECTIVES" | null;
	reason: "SPY_DEPARTED" | "INSUFFICIENT_PLAYERS" | null;
	endedAt: string;
}
