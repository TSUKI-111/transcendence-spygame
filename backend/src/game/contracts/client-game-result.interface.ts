export type ClientGameResult = 
    |   {
            gameId: string;
            status: "FINISHED";
            winner: "DETECTIVES" | "SPY";
            reason: null;
            endedAt: string;
            revelation: 
            {
                spyUserId: number;
                secretWord: string;
            };
        }
    |   {
            gameId: string;
            status: "TERMINATED";
            winner: null;
            reason: "SPY_DEPARTED" | "INSUFFICIENT_PLAYERS";
            endedAt: string;
            revelation: null;
        };