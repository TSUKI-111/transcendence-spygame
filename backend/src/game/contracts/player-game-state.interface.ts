import type {GamePhase} from "./game-phase.type.ts";
import type {AcceptedClue} from "./clue.interface.ts"
import type {ClientGameResult} from "./client-game-result.interface.ts";

export type GameRole = "SPY" | "DETECTIVE";

// Public information about a game participant
export interface PublicGamePlayer
{
	userId: number;
	participationStatus: "ACTIVE" | "ELIMINATED" | "DEPARTED";
	connectionStatus: "CONNECTED" | "DISCONNECTED";
}

export interface PlayerGameState
{
	gameId: string;
	phase: GamePhase;
	roundNumber: number;
	phaseEndsAt: string | null;
	players: PublicGamePlayer[];
	role: GameRole;
	secretWord?: string;
	clues: AcceptedClue[];
	hasSubmittedClue: boolean;
	hasSubmittedVote: boolean;
	finalResult: ClientGameResult | null;
}
