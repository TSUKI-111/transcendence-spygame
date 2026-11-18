export interface StartGameRequest
{
	roomId: string;
	participantIds: number[];
}

export interface StartGameResponse
{
	gameId: string;
	roomId: string;
	phase: "CLUE_SUBMISSION";
	roundNumber: number;
	phaseEndsAt: string;
}
