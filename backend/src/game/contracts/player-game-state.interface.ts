import type {GamePhase} from "./game-phase.type.ts";
import type {AcceptedClue} from "./clue.interface.ts"

export type GameRole = "SPY" | "DETECTIVE";

export interface PlayerGameState
{
	gameId: string;
	phase: GamePhase;
	roundNumber: number;
	phaseEndsAt: string | null;
	role: GameRole;
	secretWord?: string;
	clues: AcceptedClue[];
	hasSubmittedClue: boolean;
}
