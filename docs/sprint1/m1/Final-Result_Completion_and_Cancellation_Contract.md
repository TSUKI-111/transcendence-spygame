# M1 — Final-Result, Completion and Cancellation Contract

**Sprint 1 — Task 3: Game Engine & Rooms Integration**  
**Status:** Updated for the team-approved simplified scope — exact M1/M4 integration interface awaiting confirmation.

## Purpose

- M1 determines when a game reaches its final outcome and reports that outcome to M4.
- M4 handles the affected room's status and safe cleanup after the game ends.
- M3 displays only the final information players are authorized to see.
- Each game has one immutable final outcome.
- The project no longer includes XP, levels, leaderboards, or player-facing match history.

## Final Game Outcomes

**Normal Completion — `FINISHED`**
- Triggered by victory through normal voting.
- If the Spy is eliminated through voting, Detectives win.
- If a Detective is eliminated by voting and exactly two active players remain, including the Spy, the Spy wins.
- The Spy's identity and secret word are revealed to game participants after normal victory.

**Termination Without a Winner — `TERMINATED`**
- Triggered by permanent Spy departure or insufficient active players following permanent departures.
- `winner` is `null`; the termination reason is recorded.
- The secret word and otherwise-hidden Spy identity are not revealed to players.

## Final-Result Payload

**Proposed M1 → M4 operation:** `onGameFinalized(result)` — an internal service/callback call, not a finalized API.

**Example — Detective victory:**

```json
{
  "gameId": "game-456",
  "roomId": "a8c2b50e-9f33-4d8b-8117-28d9a2b6e573",
  "status": "FINISHED",
  "winner": "DETECTIVES",
  "reason": null,
  "endedAt": "2026-11-05T12:15:00Z"
}
```

**Example — No-winner termination:**

```json
{
  "gameId": "game-789",
  "roomId": "a8c2b50e-9f33-4d8b-8117-28d9a2b6e573",
  "status": "TERMINATED",
  "winner": null,
  "reason": "SPY_DEPARTED",
  "endedAt": "2026-11-05T12:10:00Z"
}
```

**Payload Rules**
- `gameId`: Unique game identifier owned by M1.
- `roomId`: Identifier of the associated M4 room; included so M4 knows which room to update or clean up.
- `status`: `FINISHED` or `TERMINATED`.
- `winner`: `DETECTIVES`, `SPY`, or `null`.
- `reason`: `null` for a normal victory. Proposed no-winner reasons are `SPY_DEPARTED` and `INSUFFICIENT_PLAYERS`.
- `endedAt`: Server-generated UTC timestamp of authoritative game finalization.
- The minimum M4 notification does **not** include XP awards, private roles, secret words, individual votes, or clues. M1 retains the fixed participant roster internally for gameplay correctness.
- Actual ID types and delivery method must match the team's shared backend interfaces.

## When a Result Becomes Final

- M1 finalizes the result when it commits the game to `FINISHED` or `TERMINATED`.
- At that moment M1 freezes the status, winner or termination reason, and finalization time.
- M1 notifies M4 with the same authoritative result and sends the permitted outcome to M3.
- No further gameplay actions or rounds are allowed.
- Later disconnects, reconnections, leave actions, and repeated notifications cannot change the finalized outcome.

## M4 Room Status and Safe Cleanup

- M4 updates the room status after receiving the authoritative final notification.
- Under the agreed simplified **one-match-per-room** scope, the room does not start a second match.
- M4 may clean up an empty room only after M1's game is terminal and the necessary game/room database references have been handled safely.
- M4 owns room membership, host ownership, room status, and deletion policy; M1 does not delete rooms.
- M1 and M4 must agree whether room cleanup requires an acknowledgement or additional status lookup.
- Repeated delivery of the same result for a `gameId` must not repeat cleanup or create conflicting room state.
- If notification or room cleanup fails, M1's finalized outcome remains unchanged and the same notification can be retried safely.
- No player-facing match-history storage or XP persistence is required by this simplified contract.

## Cancellation and Failed Starts

**Failed Game Start**
- If M1 rejects initialization, it returns a start-game error; no normal final-result notification is produced.
- The room must not remain incorrectly marked as hosting a playable game.
- M4 is expected to keep or restore its waiting-room state, subject to the agreed room status contract.
- Partial-start cleanup is an M1/M4 integration detail.

**Intentional Player Departure**
- A Leave Game action causes immediate permanent game departure.
- If the Spy intentionally leaves, M1 enters `TERMINATED` immediately.
- If an active Detective leaves and two or fewer active players remain, M1 enters `TERMINATED` immediately.
- Otherwise, gameplay continues according to Game Rules Section 2.7.
- The host obeys the same gameplay rules; M4 manages room membership and host ownership.
- M4 must notify M1 of an authenticated intentional departure. The proposed notification and its exact payload are not yet agreed.

**Unexpected Disconnection**
- Disconnection alone does not immediately terminate the game.
- Reconnection is permitted before the current round's resolution begins.
- At round resolution M1 resolves voting and any normal victory first; only if no winner exists does M1 process players who remain disconnected and apply termination rules.

**Administrative Cancellation**
- No separate host/admin Cancel Game operation has been approved.
- If M4 needs administrative cancellation, M1/M4 must agree on its authorization, terminal outcome, reason, and notification before implementation.
- No new `CANCELLED` state is added by this contract.

## Errors and Consistency

- Finalization for an unknown game → reject.
- Finalization without a valid terminal condition → reject.
- Attempt to change an existing final outcome → reject.
- Duplicate delivery of the identical final result → handle idempotently (no duplicate cleanup).
- Missing or inconsistent `gameId`, `roomId`, status, winner, or termination reason → reject or report an integration error.
- Failed notification or cleanup must not undo M1's committed outcome.
- Exact error codes and acknowledgement/retry behavior remain integration decisions.

## Module Responsibilities

- **M1:** Final outcome, winner/termination reason, finalization timing, authoritative game state, and final notification.
- **M4:** Room status, membership, host ownership, and safe end-of-game room cleanup.
- **M3:** Player-facing completion and termination screens, with correct secret visibility.
- **M2:** Authenticated player identities.
- **M5:** Secure backend communication and deployment support.

## Unconfirmed Integration Decisions

| ID | Decision | Proposed Default | Owner | Status |
|---|---|---|---|---|
| D5.1 | Final-result fields | Minimal six-field payload above | M1 + M4 | Open |
| D5.2 | Result notification method | Internal `onGameFinalized(result)` service/callback | M1 + M4 | Open |
| D5.3 | Acknowledgement and retry behavior | Retry the identical result using `gameId`; safe repeated processing | M1 + M4 | Open |
| D5.4 | Room state after a game ends | One match per room; mark finished/closed and clean up safely | M4 + M1 | Open |
| D6.1 | Administrative cancellation required? | No additional cancellation operation unless agreed | M1 + M4 | Open |
| D7.1 | Host/player departure notification and membership behavior | M4 sends authenticated departure; M1 updates gameplay; M4 owns membership | M1 + M4 | Open |
| D7.2 | When an empty room may be deleted | Only after terminal game result and safe database-reference handling | M4 + M1 | Open |

**Due dates:** M4/team to confirm or update in the central Sprint 1 decision log before integration. The interface details above are proposals, not claims of approval.
