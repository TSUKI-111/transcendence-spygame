import type {AcceptedClue} from "./clue.interface.ts";
import type {GameFinalResult} from "./game-final-result.interface.ts";
import type {GameRole} from "./player-game-state.interface.ts";
import type {RoundOutcome} from "./round-resolution.interface.ts";

export type GameEvent =
	|   {
			name: "game.phase_changed";
			roomId: string;
			payload:
			{
				gameId: string;
				phase: "CLUE_SUBMISSION" | "DISCUSSION" | "VOTING";
				roundNumber: number;
				phaseEndsAt: string;
			};
		}
	|   {
			name: "game.clue_submitted";
			roomId: string;
			payload: AcceptedClue;
		}
	|   {
			name: "game.player_updated";
			roomId: string;
			payload:
			|   {
					gameId: string;
					userId: number;
					participationStatus: "ELIMINATED" | "DEPARTED";
				}
			|   {
					gameId: string;
					userId: number;
					connectionStatus: "CONNECTED" | "DISCONNECTED";
				};
		}
	|   {
			name: "game.round_resolved";
			roomId: string;
			payload:
			{
				gameId: string;
				roundNumber: number;
				outcome: RoundOutcome;
				eliminatedUserId: number | null;
				eliminatedRole: GameRole | null;
			};
		}
	|   {
			name: "game.ended";
			roomId: string;
			payload: GameFinalResult;
		};
