
import { describe, expect, it } from "vitest";
import { toGameActionFailure } from "./game-action-error.js";
import type { GameActionResponse } from "./contracts/game-action-response.interface.ts";

describe("Game action errors", () => {
    it("supports a successful action response", () => {
        const response: GameActionResponse = { ok: true };

        expect(response).toEqual({ ok: true });
    });

    it("preserves known gameplay error codes", () => {
        const response = toGameActionFailure(
            new Error("CLUE_ALREADY_SUBMITTED")
        );

        expect(response).toEqual({
            ok: false,
            error: {
                code: "CLUE_ALREADY_SUBMITTED",
                message: "You already submitted a clue this round.",
            },
        });
    });

    it("translates internal state errors", () => {
        const response = toGameActionFailure(
            new Error("ROUND_CLOSING")
        );

        expect(response).toEqual({
            ok: false,
            error: {
                code: "PHASE_EXPIRED",
                message: "Time has expired.",
            },
        });
    });

    it("does not expose unexpected backend errors", () => {
        const response = toGameActionFailure(
            new Error("Database connection failed: secret details")
        );

        expect(response).toEqual({
            ok: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "Something went wrong. Please try again.",
            },
        });
    });
});
