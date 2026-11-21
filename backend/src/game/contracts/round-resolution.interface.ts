import type {GameRole} from "./player-game-state.interface.ts";
import type {GameFinalResult} from "./game-final-result.interface.ts";

export type RoundOutcome = "ELIMINATED" | "TIE" | "NO_VOTES";

export interface RoundResolutionResult 
{
    gameId: string;
    roomId: string;
    roundNumber: number;
    outcome: RoundOutcome | null;
    eliminatedUserId: number | null;
    eliminatedRole: GameRole | null;
    departedUserIds: number[];
    nextPhase: "CLUE_SUBMISSION" | "FINISHED" | "TERMINATED";
    phaseEndsAt: string | null;
    finalResult: GameFinalResult | null;
}