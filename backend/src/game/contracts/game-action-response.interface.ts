
export type GameActionErrorCode =
    | "UNAUTHORIZED"
    | "GAME_NOT_FOUND"
    | "NOT_GAME_PARTICIPANT"
    | "GAME_NOT_ACTIVE"
    | "PLAYER_NOT_ELIGIBLE"
    | "VOTER_NOT_ELIGIBLE"
    | "INVALID_PHASE"
    | "PHASE_EXPIRED"
    | "INVALID_CLUE"
    | "EMPTY_CLUE"
    | "CLUE_TOO_LONG"
    | "DUPLICATE_CLUE"
    | "CLUE_ALREADY_SUBMITTED"
    | "INVALID_VOTE_REQUEST"
    | "INVALID_VOTE_TARGET"
    | "VOTE_ALREADY_SUBMITTED"
    | "INVALID_REQUEST"
    | "ACTION_UNAVAILABLE"
    | "INTERNAL_ERROR";

export type GameActionResponse =
    |   {
            ok: true;
        }
    |   {
            ok: false;
            error: 
            {
                code: GameActionErrorCode;
                message: string;
            };
        };
