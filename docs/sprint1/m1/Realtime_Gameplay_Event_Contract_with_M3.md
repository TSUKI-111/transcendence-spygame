# M1 — Realtime Gameplay Event Contract with M3

**Sprint 1 — Task 4: Game Engine & Gameplay UI Integration**

**Status:** Proposed by M1 — awaiting M3 confirmation.

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

- Sent to an individual authenticated player after entering an ongoing game or requesting state restoration.
- Provides:
  - Game ID, phase, round number and current deadline.
  - Public participant statuses.
  - Accepted clues from the current round.
  - The requesting player's own role.
  - The requesting player's clue-submission and voting status.
  - The secret word only when the requesting player is an authorized Detective.
- Used for initial state retrieval and reconnection.
- Other players' secret roles and vote choices must not be included.

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
  - `eliminatedPlayerId`: Player ID or null.
  - `eliminatedRole`: `SPY`, `DETECTIVE`, or null.
- An eliminated player's role is revealed only after elimination.
- Individual votes and complete vote totals are not broadcast.
- This event does not require an additional timed results phase.

**Event: `game.player_updated` — Public**

- Sent when a participant's connection or participation status changes.
- Includes:
  - `gameId`
  - `userId`
  - `participationStatus`: `ACTIVE`, `ELIMINATED`, or `DEPARTED`
  - `connectionStatus`: `CONNECTED` or `DISCONNECTED`
- Temporary disconnection does not change an active player's eligibility to receive votes.
- This event does not reveal secret roles.

**Event: `game.ended` — Public**

- Sent after M1 finalizes a game.
- Includes:
  - `gameId`
  - `status`: `FINISHED` or `TERMINATED`
  - `winner`: `DETECTIVES`, `SPY`, or null.
  - `reason`: Termination reason or null.
  - `xpAwards`: Per-player XP awards, when the game finishes normally.
- For `FINISHED`, the event also contains the Spy's identity and secret word for the final revelation.
- For `TERMINATED`, secret roles and the secret word remain hidden, and no victory XP is awarded.
- M3 displays the final result and disables further gameplay inputs.

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

## 5. Action Acknowledgements

- Clue and vote actions use Socket.IO acknowledgements.
- A successful acknowledgement confirms that the server accepted the action.
- A rejected action returns an error code without changing gameplay state.
- Proposed common error codes:
  - `UNAUTHORIZED`
  - `NOT_GAME_PARTICIPANT`
  - `PLAYER_NOT_ELIGIBLE`
  - `INVALID_PHASE`
  - `PHASE_EXPIRED`
  - `ALREADY_SUBMITTED`
  - `INVALID_CLUE`
  - `INVALID_TARGET`
  - `GAME_NOT_ACTIVE`

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
- **M4:** Room start/leave events, room membership and game-result persistence.
- **M5:** WebSocket authentication, secure connections and connection-lifecycle infrastructure.

## 9. Unconfirmed Integration Decisions

| ID | Decision | Proposed Default | Owner | Status |
|---|---|---|---|---|
| E1 | Exact event and action names | Names in this document | M1 + M3 | Open |
| E2 | Public game subscription mechanism | Authorized Socket.IO game room | M1 + M3 + M5 | Open |
| E3 | Private player-state delivery | Authenticated player-specific event | M1 + M3 + M5 | Open |
| E4 | Initial game screen navigation after M4 starts a game | M4 notifies room; M3 retrieves game state | M3 + M4 | Open |
| E5 | Chat phase-eligibility integration | M2 checks M1-authoritative eligibility | M1 + M2 | Open |
| E6 | Reconnection and player-online detection | Authenticated Socket.IO lifecycle | M1 + M5 | Open |
| E7 | Exact error-code format | Common codes above | M1 + M3 | Open |

**Due dates:** To be assigned or updated by the team before integration. No unconfirmed decision is represented as agreed.