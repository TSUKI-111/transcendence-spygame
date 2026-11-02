# M1 — Final-Result, Completion and Cancellation Contract

**Sprint 1 — Task 3: Game Engine & Rooms Integration**

**Status:** Proposed by M1 — awaiting M4 confirmation.

### Purpose

- M1 determines when a game has reached a final outcome.
- M1 sends the authoritative final result to M4.
- M4 stores game history and applies XP rewards.
- M3 displays the gameplay result using the information M1 permits players to see.
- A game may have only one final outcome.

### Final Game Outcomes

**Normal Completion — `FINISHED`**
- Triggered by a victory through normal voting.
- If the Spy is eliminated, Detectives win.
- If a Detective is eliminated by voting and exactly two active players remain, including the Spy, the Spy wins.
- Detective victory awards +25 XP to every Detective, including previously eliminated Detectives.
- Spy victory awards +40 XP to the Spy.
- The Spy's identity and secret word are revealed to game participants after victory.

**Termination Without Winner — `TERMINATED`**
- Triggered by a permanent Spy departure or insufficient active players following permanent departures.
- `winner` is `null`.
- Every participant receives 0 victory XP.
- The termination reason is recorded.
- Secret roles and the secret word are not revealed to participants through the termination result.

### Final-Result Payload

**Proposed M1 → M4 operation:** `onGameFinalized(result)`

**Example — Detective victory:**

```json
{
  "gameId": "game-456",
  "roomId": "room-123",
  "status": "FINISHED",
  "winner": "DETECTIVES",
  "reason": null,
  "participants": [
    { "userId": "user-101", "role": "SPY", "xpAwarded": 0 },
    { "userId": "user-102", "role": "DETECTIVE", "xpAwarded": 25 },
    { "userId": "user-103", "role": "DETECTIVE", "xpAwarded": 25 }
  ],
  "endedAt": "2026-11-02T12:15:00Z"
}
```

**Example — No-winner termination:**

```json
{
  "gameId": "game-789",
  "roomId": "room-123",
  "status": "TERMINATED",
  "winner": null,
  "reason": "SPY_DEPARTED",
  "participants": [
    { "userId": "user-101", "role": "SPY", "xpAwarded": 0 },
    { "userId": "user-102", "role": "DETECTIVE", "xpAwarded": 0 },
    { "userId": "user-103", "role": "DETECTIVE", "xpAwarded": 0 }
  ],
  "endedAt": "2026-11-02T12:10:00Z"
}
```

**Payload Rules**
- `gameId` and `roomId` identify the game and its room.
- `status` is `FINISHED` or `TERMINATED`.
- `winner` is `DETECTIVES`, `SPY`, or `null`.
- `reason` is `null` for normal victory; proposed termination reasons are `SPY_DEPARTED` and `INSUFFICIENT_PLAYERS`.
- `participants` contains the complete original participant roster with each player's role and calculated victory XP.
- `endedAt` is the authoritative server-generated UTC finalization timestamp.
- The secret word, individual votes, and round clues are not required in M4's minimum final-result payload.
- Role information in this internal payload must not be exposed through unauthorized public responses.

### When a Result Becomes Final

- A result becomes final when M1 successfully commits the transition to `FINISHED` or `TERMINATED`.
- M1 determines and freezes the winner, termination reason, and participant XP awards at that point.
- M1 communicates the result to M4 and the permitted gameplay result to M3.
- After finalization, no gameplay actions or additional rounds are allowed.
- Final outcomes cannot be changed by later disconnects, reconnections, voting requests, or retries.
- M1 must not finalize the same game with two different outcomes.

### M4 Persistence and XP

- M4 stores one final game result per `gameId`.
- M4 applies the XP amounts calculated by M1.
- XP must be awarded at most once per game, even if the final-result notification is received multiple times.
- If result delivery or persistence fails, the same finalized result must remain available for safe retry.
- M1 and M4 must agree on the acknowledgement and retry mechanism.
- M4 updates room state after game completion or termination according to its room lifecycle rules.

### Cancellation and Failed Starts

**Failed Game Start**
- If M1 rejects the start request or cannot complete initialization, M4 receives a start-game error.
- The room must not be left incorrectly locked as an active game.
- No normal final-result payload or victory XP is produced.
- Handling cleanup after partial initialization is an integration detail for M1 and M4.

**Intentional Player Departure**
- Choosing Leave Game permanently removes that player from active gameplay immediately.
- If the Spy leaves, M1 finalizes the game as `TERMINATED`.
- If an active Detective leaves and two or fewer active players remain, M1 finalizes the game as `TERMINATED`.
- Otherwise, the game continues according to Section 2.7.
- If the host leaves, the same gameplay rules apply; M4 handles room ownership and membership.

**Unexpected Disconnection**
- Disconnection alone does not immediately cancel or terminate the game.
- Reconnection is allowed before the current round's resolution begins.
- At round resolution, M1 first processes normal voting and victory conditions.
- If no winner exists, M1 processes players who remain disconnected and applies the no-winner termination rules.

**Administrative Cancellation**
- No additional host/admin Cancel Game operation has been approved.
- If M4 requires administrative cancellation of an ongoing game, its authorization, reason, terminal outcome, and notification contract must be agreed before implementation.
- No extra `CANCELLED` game state is introduced by this proposal.

### Errors and Consistency

- Finalization request for an unknown game → reject.
- Finalization before a valid terminal outcome exists → reject.
- Attempt to change an existing final outcome → reject.
- Duplicate delivery of the same final result → handle idempotently; no additional XP.
- XP amounts inconsistent with the authoritative winner → reject or flag as an integration error.
- Invalid or incomplete result payload → reject and report the error.
- An unsuccessful M4 persistence operation must not change M1's already-finalized outcome.
- Exact error codes and the persistence acknowledgement mechanism remain integration decisions.

### Module Responsibilities

- **M1:** Determines final outcomes, termination reasons, participant results, XP awards, and finalization timing.
- **M4:** Stores game history, applies XP exactly once, and updates room state.
- **M3:** Displays permitted completion, termination, and result information.
- **M2:** Provides authenticated player identities.
- **M5:** Supports secure backend communication and deployment reliability.

### Unconfirmed Integration Decisions

| ID | Decision | Proposed Default | Owner | Status |
|---|---|---|---|---|
| D5.1 | Final-result fields | Minimal payload above | M1 + M4 | Open |
| D5.2 | Result delivery method | Direct NestJS service call | M1 + M4 | Open |
| D5.3 | Result acknowledgement and retry | Same `gameId`, idempotent processing | M1 + M4 | Open |
| D5.4 | Final history and XP persistence | M4 persists one result and awards XP once | M4 | Open |
| D6.1 | Administrative cancellation required? | No additional cancellation operation | M1 + M4 | Open |
| D7.1 | Host departure and room ownership | M1 applies player rules; M4 handles host transfer | M1 + M4 | Open |
| D7.2 | Room cleanup after failure or termination | M4-owned room lifecycle | M4 | Open |

**Due dates:** To be assigned or refreshed by M4. Pending decisions are not represented as confirmed agreements.