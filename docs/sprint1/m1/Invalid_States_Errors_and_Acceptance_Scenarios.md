# M1 — Invalid States, Errors and Acceptance Scenarios

**Sprint 1 — Task 5: Game Engine & Rules**

**Status:** Drafted by M1 — integration error codes awaiting M4/M3 confirmation.

## 1. Scope

- M1 validates game-start conditions, lifecycle transitions, and final game outcomes.
- M1 rejects invalid operations without corrupting the current game state.
- M4 handles room-related validation and errors.
- M3 displays appropriate error feedback.
- Individual clue and vote validation rules remain defined in Sections 2.3, 2.5, and the Task 4 realtime contract.

## 2. Invalid Game Starts

| Condition | Proposed Error Code | Owner |
|---|---|---|
| Missing or malformed start-game request | `INVALID_START_REQUEST` | M1 |
| Fewer than 3 or more than 8 participants | `INVALID_PLAYER_COUNT` | M1 |
| Duplicate participant IDs | `DUPLICATE_PLAYERS` | M1 |
| Another active game already exists for the room | `GAME_ALREADY_ACTIVE` | M1 |
| Role assignment or initial game creation fails | `GAME_INITIALIZATION_FAILED` | M1 |
| Room does not exist | `ROOM_NOT_FOUND` | M4 |
| Requester is not the room host | `NOT_ROOM_HOST` | M4 |
| Room is unavailable for starting | `ROOM_NOT_AVAILABLE` | M4 |
| Participant list is not valid for the room | `ROOM_MEMBERSHIP_INVALID` | M4 |

**Expected behavior**
- M4 validates room membership and host authorization before calling M1.
- M1 validates the trusted participant list and prevents duplicate active games.
- If a start request is rejected, no playable game is created.
- If initialization fails during `ROLE_ASSIGNMENT`, no partially initialized game may remain active.
- M4 must not announce a successful game start until M1 confirms initialization.
- Failed initialization does not produce a normal final-result notification or leave the room permanently locked.

## 3. Invalid Game State Transitions

**Allowed transitions**

- `ROLE_ASSIGNMENT` → `CLUE_SUBMISSION`
- `CLUE_SUBMISSION` → `DISCUSSION`
- `DISCUSSION` → `VOTING`
- `VOTING` → automatic round resolution
- Round resolution → `CLUE_SUBMISSION` for a new round
- Round resolution → `FINISHED` or `TERMINATED` according to game rules
- An approved immediate departure condition may transition an active game to `TERMINATED`

**Invalid transitions**
- Skipping or reversing gameplay phases.
- Starting a new round before the previous round is resolved.
- Running `ROLE_ASSIGNMENT` again in a later round.
- Starting gameplay before initialization succeeds.
- Returning from `FINISHED` or `TERMINATED` to an active phase.
- Changing a previously finalized outcome.

**Proposed errors**
- `INVALID_PHASE`: An operation is not allowed in the current phase.
- `INVALID_STATE_TRANSITION`: An attempted lifecycle transition is not permitted.
- `GAME_NOT_ACTIVE`: Gameplay is requested after a game has ended or before it is ready.

**Expected behavior**
- The backend alone controls phase transitions.
- Gameplay deadlines remain authoritative.
- Invalid transitions do not alter the game, round number, or deadlines.
- A phase transition must be applied only once.

## 4. Invalid Completion and Termination

| Condition | Proposed Error Code | Expected Behavior |
|---|---|---|
| Finalization references an unknown game | `GAME_NOT_FOUND` | Reject |
| Finalization is attempted without a valid terminal outcome | `INVALID_FINALIZATION` | Reject |
| A finalized winner or termination reason is changed | `GAME_ALREADY_FINALIZED` | Reject conflicting operation |
| An identical final-result notification is retried | No error required | Handle idempotently; do not repeat room cleanup or change the outcome |
| M4 receives an incomplete or inconsistent final result | `INVALID_RESULT_PAYLOAD` | Reject and report integration error |

**Expected behavior**
- Only M1's authoritative rules may determine a game's final outcome.
- `FINISHED` requires a valid voting victory.
- `TERMINATED` requires an approved no-winner termination condition.
- A final game outcome cannot be modified once committed.
- M1 reports each finalized outcome to M4 using the agreed final-result contract.
- M4 updates the room state and performs safe cleanup according to the agreed one-match-per-room lifecycle; it must not delete a room before the outcome is finalized and required references are handled.
- If final-result delivery or acknowledgement fails, M1 retains the same finalized outcome for safe retry.
- Duplicate notifications must not cause duplicate room cleanup.

## 5. Departure and Reconnection Edge Cases

- Unexpected disconnection does not immediately terminate a game.
- A disconnected player may reconnect before round resolution begins.
- A temporarily disconnected active player remains a valid voting target.
- A player who remains disconnected at resolution becomes permanently departed if voting has not already produced a winner.
- A permanently departed player cannot resume the current game.
- Intentional departure is applied immediately.
- Host departure follows normal gameplay departure rules; M4 manages room ownership.
- If permanent departures trigger a no-winner condition, M1 enters `TERMINATED`.
- Once a game ends, subsequent disconnects, reconnections, or leave requests cannot change its outcome.

## 6. Error Response Format

**Proposed common response:**

```json
{
  "code": "GAME_ALREADY_ACTIVE",
  "message": "An active game already exists for this room."
}
```

- `code`: Stable identifier used by M3/M4.
- `message`: Human-readable explanation.
- Exact error codes and HTTP mappings must be agreed before implementation.
- Errors must not expose secret roles, the secret word, or private votes.

## 7. Minimum Acceptance Scenarios

| ID | Scenario | Expected Result |
|---|---|---|
| A1 | Start with 2 participants | Reject: `INVALID_PLAYER_COUNT` |
| A2 | Start with 9 participants | Reject: `INVALID_PLAYER_COUNT` |
| A3 | Start with duplicate user IDs | Reject: `DUPLICATE_PLAYERS` |
| A4 | Two simultaneous start requests for the same room | At most one game is created; other request rejected or safely recognized as duplicate |
| A5 | Role assignment or game initialization fails | No playable game; M4 receives start failure |
| A6 | Attempt to skip from `CLUE_SUBMISSION` directly to `VOTING` | Reject invalid transition |
| A7 | Valid phase deadline expires | Advance exactly once to the correct phase |
| A8 | Round ends in a tie, with sufficient eligible players | Begin next round without elimination |
| A9 | Spy is eliminated through voting | Enter `FINISHED`; Detectives win |
| A10 | Spy permanently departs without a voting winner | Enter `TERMINATED`; no winner |
| A11 | Disconnected player reconnects before round resolution | Restore authorized state without restarting deadlines |
| A12 | Player tries to resume after permanent departure | Reject participation |
| A13 | Identical final-result notification is delivered twice | Same final outcome; room update/cleanup handled only once |
| A14 | Attempt to change an already finalized winner | Reject; preserve original result |
| A15 | M4 cannot acknowledge or complete final-result handling | Preserve M1's finalized outcome for safe retry; do not corrupt room/game state |
| A16 | Gameplay action is received after `FINISHED` or `TERMINATED` | Reject; game remains terminal |

## 8. Responsibilities

- **M1:** Game-start validation, lifecycle transition validation, finalization, authoritative outcomes, and game-level errors.
- **M4:** Room validation, host authorization, room availability, final-result handling, room-state updates, and safe cleanup.
- **M3:** Error display and correct UI behavior after rejected gameplay operations.
- **M2:** Authenticated user identity.
- **M5:** Transport security and infrastructure support.

## 9. Unconfirmed Integration Decisions

| ID | Decision | Proposed Default | Owner | Status |
|---|---|---|---|---|
| V1 | Exact shared error codes | Use codes in Tasks 2, 4 and 5 | M1 + M3 + M4 | Open |
| V2 | Start-game concurrency protection | At most one active game per room | M1 + M4 | Open |
| V3 | Initialization failure recovery | No partially active game; safe room recovery | M1 + M4 | Open |
| V4 | Final-result notification acknowledgement and retry | Retry the same finalized result by `gameId`; handle room updates once | M1 + M4 | Open |
| V5 | Administrative cancellation behavior | Not implemented unless approved | M1 + M4 | Open |

**Due dates:** M4 to assign or refresh before integration. These proposed decisions do not represent confirmed team agreements.
