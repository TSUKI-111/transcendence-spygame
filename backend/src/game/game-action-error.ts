import type {GameActionErrorCode, GameActionResponse} from "./contracts/game-action-response.interface.ts";

// Messages that the frontend is allowed to display
const ERROR_MESSAGES: Record<GameActionErrorCode, string> = 
{
    UNAUTHORIZED: "Please log in again.",
    GAME_NOT_FOUND: "Game not found.",
    NOT_GAME_PARTICIPANT: "You are not part of this game.",
    GAME_NOT_ACTIVE: "This game is no longer active.",
    PLAYER_NOT_ELIGIBLE: "You cannot perform this action.",
    VOTER_NOT_ELIGIBLE: "You cannot vote right now.",
    INVALID_PHASE: "This action is unavailable in the current phase.",
    PHASE_EXPIRED: "Time has expired.",
    INVALID_CLUE: "Invalid clue.",
    EMPTY_CLUE: "Please enter a clue.",
    CLUE_TOO_LONG: "Maximum 100 characters.",
    DUPLICATE_CLUE: "This clue was already submitted this round.",
    CLUE_ALREADY_SUBMITTED: "You already submitted a clue this round.",
    INVALID_VOTE_REQUEST: "Invalid vote request.",
    INVALID_VOTE_TARGET: "Select an eligible player.",
    VOTE_ALREADY_SUBMITTED: "You already voted this round.",
    INVALID_REQUEST: "Invalid request.",
    ACTION_UNAVAILABLE: "The game state changed. Please refresh.",
    INTERNAL_ERROR: "Something went wrong. Please try again.",
};

// Translate backend-only errors into safe frontend codes
const ERROR_ALIASES: Record<string, GameActionErrorCode> =
{
    INVALID_START_REQUEST: "INVALID_REQUEST",
    INVALID_PLAYER_REQUEST: "INVALID_REQUEST",
    INVALID_PLAYER_COUNT: "INVALID_REQUEST",
    DUPLICATE_PLAYERS: "INVALID_REQUEST",
    GAME_ALREADY_ACTIVE: "ACTION_UNAVAILABLE",
    PLAYER_NOT_ACTIVE: "PLAYER_NOT_ELIGIBLE",
    CONNECTION_STATE_CHANGED: "ACTION_UNAVAILABLE",
    PLAYER_STATE_CHANGED: "ACTION_UNAVAILABLE",
    GAME_STATE_CHANGED: "ACTION_UNAVAILABLE",
    ROUND_ALREADY_RESOLVED: "ACTION_UNAVAILABLE",
    ROUND_CLOSING: "PHASE_EXPIRED",
    PHASE_NOT_EXPIRED: "ACTION_UNAVAILABLE",
    ROUND_NOT_FOUND: "INTERNAL_ERROR",
    INVALID_TIMESTAMP: "INTERNAL_ERROR",
    INVALID_FINAL_STATE: "INTERNAL_ERROR",
};

export function toGameActionFailure(error: unknown): GameActionResponse
{
    const rawCode = error instanceof Error ? error.message : "";
    let code: GameActionErrorCode = "INTERNAL_ERROR";

    if (Object.prototype.hasOwnProperty.call(ERROR_ALIASES, rawCode)) 
    {
        code = ERROR_ALIASES[rawCode];
    }
    else if (Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, rawCode))
    {
        code = rawCode as GameActionErrorCode;
    }

    return {
        ok: false,
        error:
        {
            code,
            message: ERROR_MESSAGES[code],
        },
    };
}