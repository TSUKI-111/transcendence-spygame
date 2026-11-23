**Game Engine & Gameplay UI Integration**

**Status:** M1–M3 data contracts agreed.
**Implementation:** M1 GameService contracts implemented and tested.
**Pending:** WebSocket Gateway integration and frontend delivery.

## 1. Purpose and Scope

- M1 provides authoritative game state and gameplay events.
- M3 displays game information and sends player actions.
- Socket.IO is the proposed realtime transport.
- Only authenticated game participants can access gameplay events.
- Public events are shared with authorized game participants.
- Private data is delivered only to the authenticated player entitled to receive it.
- The server validates all gameplay actions; frontend checks are for user experience only.

## 2. Game Phases

- `ROLE_ASSIGNMENT`: Automatic initial role assignment; no timer or player interaction.
- `CLUE_SUBMISSION`: Shared 60-second clue phase.
- `DISCUSSION`: Shared 120-second discussion phase.
- `VOTING`: Shared 30-second voting phase.
- `FINISHED`: Terminal state with a winner.
- `TERMINATED`: Terminal state without a winner.

- `ROLE_ASSIGNMENT` occurs once at game initialization.
- M3 does not need a separate role-confirmation screen or acknowledgement.
- `ROUND_RESOLUTION` is an automatic backend operation, not a persistent phase.
- Only `CLUE_SUBMISSION`, `DISCUSSION`, and `VOTING` have gameplay deadlines.

## 3. Server-to-Client Events


**Event: `game.state` — Private**

- Contains the requesting player's authorized Game Engine state.
- Used when entering the Game Page or restoring state.
- Backend source: `GameService.getPlayerState()`.

**Payload fields:**

- `gameId`: Game identifier.
- `phase`: Current GamePhase.
- `roundNumber`: Current round.
- `phaseEndsAt`: ISO deadline or null.
- `players`: Public participant information:
  - `userId`
  - `participationStatus`: ACTIVE, ELIMINATED, DEPARTED
  - `connectionStatus`: CONNECTED, DISCONNECTED
- `role`: Requesting player's own role (SPY or DETECTIVE).
- `secretWord?`: Only included for the requesting Detective.
- `clues`: Accepted clues from the current round.
- `hasSubmittedClue`: Whether the player submitted a clue.
- `hasSubmittedVote`: Whether the player voted this round.
- `finalResult`: ClientGameResult or null.

**Security:**

- Other players' secret roles are never included in `players`.
- Individual vote choices are never included.
- The Spy does not receive `secretWord` during gameplay.
- After FINISHED, `finalResult` contains the final revelation.
- After TERMINATED, `finalResult.revelation` is null.

**Implementation status:**

- The GameService state and privacy rules are implemented.
- Socket.IO delivery is pending Gateway integration.

**Event: `game.phase_changed` — Public**

- Sent when the current game phase changes.
- Includes:
  - `gameId`
  - `phase`
  - `roundNumber`
  - `phaseEndsAt`
- `phaseEndsAt` is null for untimed states.
- M3 uses the deadline to display a countdown locally.
- M1 remains authoritative for accepting actions and advancing phases.
- No per-second countdown event is required.

**Event: `game.clue_submitted` — Public**

- Sent immediately after M1 accepts a clue.
- Includes:
  - `gameId`
  - `roundNumber`
  - `userId`
  - `clue`
- The clue is shown with its author's username, obtained through the existing user/player display data.
- Eliminated observers may receive the public clue event.
- Invalid clues produce no public event.

**Event: `game.round_resolved` — Public**

- Sent after voting is resolved.
- Includes:
  - `gameId`
  - `roundNumber`
  - `outcome`: `ELIMINATED`, `TIE`, or `NO_VOTES`
  - `eliminatedUserId`: Eliminated user's ID or null.
  - `eliminatedRole`: `SPY`, `DETECTIVE`, or null.
- An eliminated player's role is revealed only after elimination.
- Individual votes and complete vote totals are not broadcast.
- This event does not require an additional timed results phase.

**Event: `game.player_updated` — Public**

- Sent when a player's connection or participation status changes.
- Always includes:
  - `gameId`
  - `userId`

**Connection update:**
- `connectionStatus`: CONNECTED or DISCONNECTED.

**Participation update:**
- `participationStatus`: ELIMINATED or DEPARTED.

- Each event contains the status field that changed.
- A temporarily disconnected player remains an eligible voting target.
- No secret roles are revealed by this event.

**Event: `game.ended` — Public**

- Published by M1 after game finalization.
- Existing internal payload: `GameFinalResult`.

**Fields:**
- `gameId`
- `roomId`
- `status`: FINISHED or TERMINATED
- `winner`: SPY, DETECTIVES, or null
- `reason`: SPY_DEPARTED, INSUFFICIENT_PLAYERS, or null
- `endedAt`: ISO timestamp

**Final revelation:**

- M1 also provides a frontend-specific `ClientGameResult`
  through the authorized private player state.

- When `status` is FINISHED:
  - `revelation.spyUserId`: Spy's user ID.
  - `revelation.secretWord`: The secret word.

- When `status` is TERMINATED:
  - `winner` is null.
  - `revelation` is null.
  - No new secret information is revealed.

**Frontend behavior:**

- M3 displays the final result and disables gameplay actions.
- An authorized participant can retrieve `finalResult`
  through `GameService.getPlayerState()`.
- The Gateway will later handle delivery through `game.get_state`.
- The existing internal `game.ended` event does not yet
  include the frontend revelation payload.

**Implementation status:**

- Internal game.ended event: Implemented.
- ClientGameResult generation: Implemented and tested.
- WebSocket delivery of the final result: Pending.

## 4. Client-to-Server Actions

**Action: `game.get_state`**

- Input: `gameId`
- M1 authenticates the requester and verifies participation.
- M1 responds with a private `game.state` event.
- Used when the gameplay screen opens or an authorized player reconnects.

**Action: `game.submit_clue`**

- Input: `gameId`, `clue`
- M1 validates:
  - Authenticated, active, connected participant.
  - Current phase is `CLUE_SUBMISSION`.
  - Submission occurs before the phase deadline.
  - No previously accepted clue from the same player in the current round.
  - Nonempty clue, at most 100 characters.
  - No case-insensitive duplicate within the current round.
- On success:
  - Record the clue.
  - Acknowledge the submitting player.
  - Broadcast `game.clue_submitted`.
- On failure: Return a private validation error.

**Action: `game.submit_vote`**

- Input: `gameId`, `targetId`
- M1 validates:
  - Authenticated, active, connected voter.
  - Current phase is `VOTING`.
  - Submission occurs before the voting deadline.
  - Target is an active, non-eliminated participant.
  - The voter has not already voted during this round.
- Self-voting is allowed.
- On success:
  - Record the vote.
  - Acknowledge the voter privately.
- On failure: Return a private validation error.
- Vote choices and intermediate vote counts are never broadcast.

**Identity Rule**

- The backend obtains the acting user's ID from the authenticated Socket.IO connection.
- M3 does not supply a trusted voter or clue-author ID.
- Client-supplied user IDs cannot be used to impersonate other players.

## 5. Action Acknowledgements and Errors

**Agreed response format**

Success:

```json
{
  "ok": true
}
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "CLUE_ALREADY_SUBMITTED",
    "message": "You already submitted a clue this round."
  }
}
```

**Types:**

- `GameActionResponse`
- `GameActionErrorCode`

**Supported client error codes:**

- `UNAUTHORIZED`
- `GAME_NOT_FOUND`
- `NOT_GAME_PARTICIPANT`
- `GAME_NOT_ACTIVE`
- `PLAYER_NOT_ELIGIBLE`
- `VOTER_NOT_ELIGIBLE`
- `INVALID_PHASE`
- `PHASE_EXPIRED`
- `INVALID_CLUE`
- `EMPTY_CLUE`
- `CLUE_TOO_LONG`
- `DUPLICATE_CLUE`
- `CLUE_ALREADY_SUBMITTED`
- `INVALID_VOTE_REQUEST`
- `INVALID_VOTE_TARGET`
- `VOTE_ALREADY_SUBMITTED`
- `INVALID_REQUEST`
- `ACTION_UNAVAILABLE`
- `INTERNAL_ERROR`

**Error handling:**

- The Game Engine keeps its existing validation errors.
- `toGameActionFailure()` maps errors into safe client responses.
- Unexpected internal errors return `INTERNAL_ERROR`.
- Internal database details are never exposed to the frontend.
- M3 displays the returned error message.
- Failed actions must not create accepted clues or votes.

**Implementation status:**

- Response types: Implemented.
- Error mapper: Implemented and tested.
- Socket.IO acknowledgement delivery: Pending Gateway integration.

## 6. Reconnection and State Restoration

- An unexpected disconnection updates the player's connection status immediately.
- Gameplay phases and timers continue normally.
- M3 reconnects through authenticated Socket.IO.
- M3 requests `game.get_state` to restore the current gameplay screen.
- M1 returns only the data authorized for that player.
- Reconnection is permitted before the current round's resolution begins.
- Previously accepted clues and votes remain valid.
- Reconnection does not restart timers or allow additional actions.
- No separate reconnection countdown or event-replay system is required.
- `game.state` restores `hasSubmittedClue` and `hasSubmittedVote`.
- Previously submitted votes remain private.
- `getPlayerState()` can retrieve the final result after game completion.
- FINISHED games include final revelation in `finalResult`.
- TERMINATED games do not include final revelation.
- State restoration does not restart timers or create a new round.

## 7. Event Ordering and Synchronization

- M1 updates authoritative game state before publishing its corresponding event.
- When the game starts, M3 can obtain the current phase and private role information using `game.get_state`.
- Clue events are broadcast immediately after accepted submissions.
- At voting resolution:
  - M1 calculates the voting outcome.
  - M1 applies elimination and departure rules.
  - M1 emits the round outcome and relevant player-status updates.
  - M1 emits either the next `game.phase_changed` event or a terminal `game.ended` event.
- Late or duplicate gameplay actions are rejected by the backend.
- A reconnecting client uses `game.get_state` rather than requiring all earlier events to be replayed.

## 8. Cross-Module Responsibilities

- **M1:** Authoritative game state, event payloads, private role information, gameplay validation and phase transitions.
- **M3:** WebSocket client integration, game-state display, countdowns, input controls, action acknowledgements and result screens.
- **M2:** Authenticated identity and existing room chat functionality, including backend discussion eligibility enforcement.
- **M4:** Room start/leave events, room membership, and room-state updates and safe cleanup after game finalization.
- **M5:** WebSocket authentication, secure connections and connection-lifecycle infrastructure.

## 9. Integration Decisions and Pending Work

| ID | Decision | Proposed Default | Owner | Status |
|---|---|---|---|---|
| E1 | Event/action names and payload fields | Names in this document | M1 + M3 | Agreed M1–M3 |
| E2 | Authorized public Socket.IO room | Authorized Socket.IO game room | M1 + M3 + M5 | Pending Gateway |
| E3 | Private game.state delivery| Authenticated player-specific event | M1 + M3 + M5 | Pending Gateway |
| E4 | Navigation after M4 starts a game | M4 notifies room; M3 retrieves game state | M3 + M4 | Pending M3/M4 integration |
| E5 | Chat phase eligibility | M2 checks M1-authoritative eligibility | M1 + M2 | Pending M1/M2 integration |
| E6 | WebSocket reconnection lifecycle | Authenticated Socket.IO lifecycle | M1 + M5 | Pending Gateway |
| E7 | Action response and error format | Common codes above | M1 + M3 | Implemented and agreed M1–M3 |

**Due dates:** M1's frontend-facing Game Engine data contracts are finalized.

Remaining integration decisions concern Socket.IO delivery,
room navigation, chat eligibility, and connection lifecycle.

No Gateway or frontend delivery is claimed as implemented.
