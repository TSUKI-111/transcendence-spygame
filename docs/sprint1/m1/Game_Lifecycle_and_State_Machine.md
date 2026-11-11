# M1 — Game Lifecycle and State Machine

**Sprint 1 — Task 1: Game Engine & Rules**

## 1. Scope

- M1 manages the authoritative game lifecycle, role assignment, gameplay phases, deadlines, rounds, eliminations, victories, and termination decisions.
- M4 manages the room and lobby before a game starts and receives final results afterward.
- The lifecycle follows the finalized Game Rules, Sections 2.1–2.7.

## 2. Game States

- `ROLE_ASSIGNMENT`: Automatically assigns one Spy, the remaining Detective roles, and the secret word.
- `CLUE_SUBMISSION`: Players submit clues simultaneously during a 60-second deadline.
- `DISCUSSION`: Eligible players discuss using the existing room chat for 120 seconds.
- `VOTING`: Eligible players submit private votes during a 30-second deadline.
- `FINISHED`: The game has ended with a Detective or Spy victory.
- `TERMINATED`: The game has ended without a winner.

**State Design**
- `ROLE_ASSIGNMENT` is the initial game phase and occurs once per game.
- `ROLE_ASSIGNMENT` has no timer and requires no player interaction.
- `ROUND_RESOLUTION` is an automatic backend operation, not a separate game state.
- Disconnection and reconnection change player connection status without changing the current gameplay phase.
- `FINISHED` and `TERMINATED` are terminal states and cannot return to active gameplay.

## 3. Game Initialization and Role Assignment

- M4 provides M1 with a trusted start-game request containing the room identifier and participating user IDs.
- M1 validates:
  - Between 3 and 8 participants.
  - No duplicate participant IDs.
  - No other active game for the same room.
- If validation fails, M1 rejects the request without creating an active game.
- If validation succeeds, M1:
  - Creates a unique `gameId`, links it to the provided `roomId`, and records the fixed participant roster.
  - Enters `ROLE_ASSIGNMENT`.
  - Randomly selects exactly one Spy.
  - Assigns Detective roles to all remaining participants.
  - Selects one secret word from the predefined backend word list.
  - Prepares private role information for every participant; only Detectives receive the word.
  - Initializes Round 1.
  - Automatically enters `CLUE_SUBMISSION` and starts its 60-second deadline.
- After role assignment completes, M1 returns `gameId`, `roomId`, `CLUE_SUBMISSION`, round number, and the first phase deadline to M4 through the proposed start-game contract.
- No role-confirmation timer or player acknowledgement is required.
- M4 remains responsible for room membership and host authorization.

## 4. Gameplay Transitions

**ROLE_ASSIGNMENT → CLUE_SUBMISSION**
- Trigger: Role assignment, secret-word selection, and initial game-state preparation complete successfully.
- M1 begins Round 1 and starts the 60-second Clue Submission deadline.
- This transition occurs only once per game.

**CLUE_SUBMISSION → DISCUSSION**
- Trigger: The shared 60-second clue deadline expires.
- M1 stops accepting clues and starts the 120-second Discussion phase.

**DISCUSSION → VOTING**
- Trigger: The shared 120-second discussion deadline expires.
- M1 ends discussion eligibility and starts the 30-second Voting phase.

**VOTING → Round Resolution**
- Trigger: The shared 30-second voting deadline expires.
- M1 stops accepting votes and immediately resolves the round.
- No additional timer or player interaction is required.

**Round Resolution → New Round**
- Trigger: Voting produces no winner, and permanent-departure checks allow the game to continue.
- M1 increments the round number and resets round-specific clues and votes.
- Roles and the secret word remain unchanged.
- The new round starts directly in `CLUE_SUBMISSION` with another 60-second deadline.

## 5. Round Resolution

- M1 excludes votes involving players who permanently departed before Voting ended.
- M1 counts the remaining valid votes.
- The player with the unique highest number of votes is eliminated.
- If there is a tie or no valid vote, nobody is eliminated.
- An eliminated player's role is revealed to game participants.
- M1 checks the victory conditions:
  - Spy eliminated through voting → Detectives win.
  - Detective eliminated through voting, leaving exactly two active players including the Spy → Spy wins.
- If voting produces a winner, the game enters `FINISHED`.
- Otherwise, M1 processes players who remain disconnected:
  - Spy permanently departs → `TERMINATED`.
  - Detective departures leave two or fewer active players → `TERMINATED`.
  - Otherwise → Next round.
- Departure of a previously eliminated player does not change the active player count.

## 6. Disconnection and Reconnection

- An unexpected disconnection immediately changes the player's connection status to `DISCONNECTED`.
- The game remains in its current phase and all deadlines continue normally.
- Temporarily disconnected active players remain valid voting targets.
- An authenticated player may reconnect before the current round's resolution begins.
- Reconnection restores the player's authorized game state without resetting phase deadlines or accepted actions.
- Players still disconnected at round resolution are processed as permanently departed if voting has not already produced a winner.
- No separate reconnection timer is required.

**Intentional Departure**
- Choosing Leave Game causes immediate permanent departure.
- If the Spy intentionally leaves, the game enters `TERMINATED`.
- If an active Detective leaves and two or fewer active players remain, the game enters `TERMINATED`.
- Otherwise, gameplay continues in the current phase.
- The host follows the same gameplay departure rules; M4 handles room ownership.
- M4 must inform M1 which game and authenticated player intentionally left. M1 updates game participation; M4 owns room membership and host transfer. The exact internal method and room-membership policy are still to be agreed.

## 7. Terminal States

**FINISHED**
- Reached after a normal voting victory.
- The Spy's identity and secret word are revealed to game participants.
- Further gameplay actions are rejected.

**TERMINATED**
- Reached when an approved no-winner departure condition occurs.
- The termination reason is recorded.
- The secret word and otherwise-hidden Spy identity are not revealed.
- Further gameplay actions are rejected.

**Finalization**
- M1 finalizes each game outcome only once.
- M1 sends an authoritative final result to M4 containing the `gameId`, `roomId`, terminal status (`FINISHED` or `TERMINATED`), winner or termination reason, and finalization time; M3 receives only the public gameplay result.
- M4 handles room status and safe cleanup after finalization. The exact callback/service method and any minimal terminal-result storage are integration decisions; full match-history and progression features are out of scope.
- A separate administrative Cancel Game operation remains an open decision with M4.
- Terminal states cannot transition back to active gameplay.

## 8. Invalid Transitions and Actions

- Start request with fewer than 3 or more than 8 participants → reject.
- Duplicate participant IDs or existing active game for the room → reject.
- Failed role assignment or initialization → do not start gameplay; report initialization failure.
- Clue submitted outside `CLUE_SUBMISSION` → reject.
- Discussion message outside `DISCUSSION` → reject through backend chat eligibility enforcement.
- Vote submitted outside `VOTING` → reject.
- Gameplay action submitted during `ROLE_ASSIGNMENT` → reject.
- Expired, duplicate, or unauthorized gameplay actions → reject.
- Gameplay action after `FINISHED` or `TERMINATED` → reject.
- Duplicate phase transitions or finalization attempts must not modify an already completed outcome.

## 9. Cross-Module Responsibilities

- **M1:** Game initialization, role assignment, secret word, phases, deadlines, voting, elimination, departures, victories, termination, and authoritative final-result reporting.
- **M2:** User authentication and room chat, including backend discussion eligibility enforcement.
- **M3:** Gameplay UI, private role display, countdowns, clues, voting, reconnection interface, and final results.
- **M4:** Room membership, host authorization, game-start integration, host ownership, and post-game room status/cleanup.
- **M5:** WebSocket authentication, connection infrastructure, and security support.

## 10. Sprint 1 Integration Dependencies

- **M1 ↔ M4:** Agree on the start-game request and confirmation, intentional Leave Game notification, completion/termination reporting, final-result payload, and safe room cleanup.
- **M1 ↔ M3:** Agree on phase names, deadlines, private role delivery, gameplay events, and state restoration.
- **M1 ↔ M2/M5:** Confirm how authenticated user IDs and connection events reach the Game Engine.
- **Open decision:** Define whether M4 needs administrative cancellation behavior beyond the existing no-winner termination rules.
