# M1 — Game Rules

## 1 Player Requirements

**Players and Lobby**
- The game supports **3–8 players**.
- A room cannot contain more than **8 players**.
- Only the room host can start a game.
- Once a game starts, no additional players can join its room until the game ends.

**Game Initialization**
- M4 provides M1 with the list of participating user IDs.
- Before starting a game, M1 validates:
  - The participant count is between 3 and 8.
  - No duplicate user IDs exist.
  - No other active game exists for the same room.
- The Game Engine randomly selects **exactly one Spy**.
- All remaining players become **Detectives**.
- Roles remain unchanged throughout the game.
- The initial participant roster remains fixed for the game, while player participation and connection status may change.

**Player Participation**
- Player participation status is tracked separately from connection status:
  - **Participation:** `ACTIVE`, `ELIMINATED`, or `DEPARTED`.
  - **Connection:** `CONNECTED` or `DISCONNECTED`.
- Only active, connected participants can perform gameplay actions during the appropriate phase.
- Active but disconnected players remain eligible voting targets until round resolution.
- Eliminated or permanently departed players cannot perform gameplay actions.
- Eliminations and departures do not erase historical participation records.
- Elimination and victory rules are defined in Section 2.6.
- Disconnection and reconnection rules are defined in Section 2.7.


## 2 Secret Word

**Secret Word Selection**
- The Game Engine (M1) randomly selects **one secret word** from a predefined backend word list when a game starts.
- The word list is maintained in the backend code; no dedicated database table is required.
- The selected secret word remains unchanged throughout all rounds of the same game.

**Secret Word Distribution and Security**
- Every player receives their assigned role privately when the game starts.
- Only Detectives receive the secret word during active gameplay.
- The Spy never receives the secret word during active gameplay.
- The backend must not expose the secret word to the Spy or unauthorized clients through public events, API responses, or game-state updates while the game is active.

**Reconnection**
- Reconnecting players retain their original roles.
- An authorized Detective receives the same secret word after reconnection.
- A reconnecting Spy does not receive the secret word.
- Reconnection behavior follows Section 2.7.

**End-of-Game Revelation**
- After a normal game victory, the Spy's identity and the secret word are revealed to all game participants, including the Spy.
- If the game terminates without a winner, the Spy's identity and secret word remain hidden.


## 3 Clues (Relations)

**Clue Submission Rules**
- Each active, non-eliminated player can submit **one accepted clue per round**.
- Clues can be single words or phrases.
- Clues cannot exceed **100 characters**.
- Empty or whitespace-only clues are rejected.
- Leading and trailing whitespace is removed before validation.
- Duplicate clues are rejected case-insensitively within the **current round only**.
- A clue used in a previous round can be reused in a new round.
- Players may submit the exact secret word as a clue.
- Accepted clues cannot be edited, deleted, or resubmitted.

**Clue Submission Phase**
- All eligible players can submit clues **simultaneously**, without a turn order.
- The Clue Submission phase has one shared **60-second timer**.
- The Game Engine (M1) controls the timer on the backend.
- Players may submit their clues at any time before the deadline.
- The phase continues for the full 60 seconds, even if all players submit early.
- Players who fail to submit before the deadline contribute no clue for that round.
- When the timer expires:
  - No additional clues are accepted.
  - The game automatically transitions to the `DISCUSSION` phase.

**Clue Visibility**
- Accepted clues are revealed **immediately** to all current game participants, including eliminated observers and the Spy.
- Each clue is displayed with the username of the player who submitted it.
- Players can view previously accepted clues while the Clue Submission phase is active.
- Accepted clues remain visible during the Discussion phase.
- Receiving public clue updates does not grant eliminated players permission to submit clues or participate in gameplay.

**Clue Validation**
- Before accepting a clue, the Game Engine verifies that:
  - The game is in the `CLUE_SUBMISSION` phase.
  - The submitting player belongs to the current game and is eligible to participate.
  - The player has not already submitted an accepted clue in the current round.
  - The clue is valid and does not exceed 100 characters.
  - The clue is not a duplicate of another accepted clue in the current round, ignoring capitalization.
  - The 60-second deadline has not expired.
- Invalid or late submissions are rejected without modifying the game state.
- If two players submit identical clues simultaneously, only one submission can be accepted.
- Accepted clues are associated with their author, game, and round.

**Disconnection and Reconnection**
- Player disconnections do not pause or reset the 60-second timer.
- A player who reconnects before the deadline may submit a clue if they have not already submitted one.
- Previously accepted clues remain recorded after disconnection.
- Other reconnection behavior follows Section 2.7.

**Sprint 1 Integration**
- **M1:** Manages the clue phase, timer, validation, accepted clues, and transition to Discussion.
- **M3:** Displays clue input, submitted clues, the countdown, and validation feedback.
- M1 and M3 agree on the realtime events needed for clue submission, immediate clue visibility, and phase transitions.


## 4 Discussion Phase

**Discussion Rules**
- Discussion begins automatically when the **60-second Clue Submission phase** ends.
- The Discussion phase lasts **120 seconds (2 minutes)**.
- Active, non-eliminated players, including the Spy, can participate using the existing room text chat.
- Eliminated players can observe the discussion but cannot send messages.
- All accepted clues from the current round remain visible during Discussion.

**Discussion Timer and Transition**
- The Game Engine (M1) controls one **120-second deadline** on the backend.
- M3 displays the remaining time using the deadline provided by M1.
- Players cannot pause, reset, or extend the Discussion phase.
- When the deadline expires:
  - Discussion ends automatically.
  - The game transitions to the `VOTING` phase.

**Participation and Reconnection**
- The backend accepts discussion messages only from eligible players while the `DISCUSSION` phase is active.
- Disconnections do not pause or reset the Discussion timer.
- Reconnecting players return to the current phase according to Section 2.7.

**Implementation Responsibilities**
- **M1:** Manages the Discussion phase, deadline, player eligibility, and transition to Voting.
- **M2:** Provides the existing room chat, message handling, and backend enforcement of discussion eligibility.
- **M3:** Displays the chat, submitted clues, countdown, and phase updates.


## 5 Voting Phase

**Voting Rules**
- Voting begins automatically after the **120-second Discussion phase** ends.
- Each active, non-eliminated player can submit **one vote per round**.
- Players may vote for any active, non-eliminated participant, including themselves.
- Temporarily disconnected players remain valid voting targets until round resolution.
- Accepted votes cannot be changed, cancelled, or submitted again.
- Votes remain private during the Voting phase.
- Each player receives private confirmation when their vote is accepted.

**Voting Timer**
- The Voting phase has one shared **30-second deadline**, controlled by the Game Engine (M1) on the backend.
- M3 displays the countdown using the deadline provided by M1.
- Voting continues for the full 30 seconds, even if all eligible players vote early.
- Players who do not vote before the deadline are considered to have abstained.
- When the deadline expires:
  - No additional votes are accepted.
  - M1 performs round resolution automatically; `ROUND_RESOLUTION` is a backend operation, not a persistent game phase.

**Vote Validation and Results**
- Before accepting a vote, M1 verifies that:
  - The game is in the `VOTING` phase.
  - The voter belongs to the game and is eligible to vote.
  - The target is an active, non-eliminated participant.
  - The voter has not already voted in the current round.
  - The voting deadline has not expired.
- Invalid, duplicate, or late votes are rejected.
- Concurrent requests cannot create multiple accepted votes from the same player in one round.
- At round resolution, votes cast by or targeting players who **permanently departed before Voting ended** are excluded from counting.
- Temporary disconnection alone does not invalidate previously accepted votes.
- M1 counts the remaining valid votes and determines the outcome according to Section 2.6.
- After voting ends, players receive a **simple voting outcome**:
  - The eliminated player, if one exists.
  - A tie, if no player is eliminated due to equal highest vote counts.
  - No votes, if no valid votes remain.
- Individual voter choices remain private.

**Disconnection and Reconnection**
- Player disconnections do not pause or reset the Voting timer.
- Previously accepted votes remain valid after temporary disconnection.
- A reconnecting player may vote if the deadline has not expired and they have not already voted.
- Other disconnection and reconnection behavior follows Section 2.7.

**Implementation Responsibilities**
- **M1:** Manages the Voting phase, deadline, vote validation, counting, and transition to Round Resolution.
- **M3:** Displays the voting interface, countdown, private vote confirmation, and voting outcome.

## 6 Elimination and Victory

**Elimination Rules**
- After the 30-second Voting phase ends, the Game Engine (M1) counts valid votes and determines the outcome.
- The player receiving the **unique highest number of votes** is eliminated; an absolute majority is not required.
- If voting ends in a tie or with zero valid votes, no player is eliminated.
- Eliminated players cannot participate in further gameplay but may continue observing.
- The eliminated player's role is revealed to all game participants.

**Victory Conditions**
- **Detective Victory:** If the Spy is eliminated through voting, the Detectives win.
- **Spy Victory:** If voting eliminates a Detective and leaves exactly **two active, non-eliminated players**, including the Spy, the Spy wins.
- If neither victory condition is met, M1 checks permanent departures before starting another round.

**Round Resolution Order**
- When Voting ends, M1 performs the following operations in order:
  1. Count valid votes and resolve any elimination.
  2. Check for a normal Detective or Spy victory.
  3. If a winner exists, finalize the game as `FINISHED`.
  4. Otherwise, process players who remain disconnected according to Section 2.7.
  5. If permanent departures trigger a no-winner condition, finalize the game as `TERMINATED`.
  6. Otherwise, start the next round.
- Round resolution is an automatic backend operation without a separate timer or player interaction.

**Game Continuation**
- Every new round begins with a shared **60-second Clue Submission phase**, as defined in Section 2.3.
- Player roles and the secret word remain unchanged throughout the game.
- Eliminated and permanently departed players cannot participate in subsequent rounds.

**Game Completion**
- A normal victory places the game in the `FINISHED` state.
- M1 finalizes the game outcome only once and rejects further gameplay actions.
- The Spy's identity and secret word are revealed after a normal victory, according to Section 2.2.
- M1 sends the authoritative final result, including `gameId`, `roomId`, status, and winner or termination reason, to M4; M3 receives only the gameplay information it is allowed to display.
- M4 handles room status and cleanup after finalization and may retain the minimal result data required for consistency. Duplicate final-result notifications must not cause repeated cleanup.
- Disconnection, intentional departure, and termination without a winner follow Section 2.7.

**Implementation Responsibilities**
- **M1:** Vote resolution, elimination, victory conditions, and game finalization.
- **M3:** Displays elimination results, revealed roles, new rounds, and final game results.
- **M4:** Handles room lifecycle after a final result and any minimal internal result storage needed for consistency.

## 7 Disconnection and Reconnection

**Unexpected Disconnection**
- When a player disconnects unexpectedly, the backend immediately marks their connection status as `DISCONNECTED`.
- The player remains part of the ongoing game until the current round ends.
- All gameplay phases and timers continue normally without pausing or resetting.
- Other players are notified of the disconnected player's status.
- A temporarily disconnected, non-eliminated player remains eligible to receive votes.

**Reconnection**
- A disconnected player may reconnect to the same game **before round resolution begins**.
- Reconnection requires the player's original authenticated user identity.
- The Game Engine (M1) restores:
  - The player's original role and participation status.
  - The current round, phase, and deadline.
  - Previously accepted clues and voting status.
  - The secret word, only if the player is an authorized Detective.
- Reconnection does not restart timers, restore expired submission opportunities, or allow duplicate clues or votes.
- No separate reconnection timer is required.

**Permanent Departure**
- At round resolution, M1 first processes normal voting, elimination, and victory conditions according to Section 2.6.
- If voting produces a winner, the game finishes normally.
- If no winner is found, players who remain disconnected are marked as permanently departed.
- M1 then applies the following rules:
  - **Spy departure:** The game terminates without a winner.
  - **Active Detective departure:** The game continues if more than two active players remain, including the Spy.
  - **Insufficient players:** If two or fewer active players remain, the game terminates without a winner.
  - **Previously eliminated player:** Departure does not affect the active player count or cause termination.
- If the game can continue after processing departures, the next round begins.
- Permanently departed players cannot rejoin the ongoing game.
- Historical participation records remain preserved.

**Intentional Departure**
- Choosing **Leave Game** causes immediate permanent departure, without waiting for round resolution.
- If the Spy intentionally leaves, the game terminates immediately without a winner.
- If an active Detective intentionally leaves:
  - The game terminates without a winner if two or fewer active players remain.
  - Otherwise, the game continues.
- Votes involving players who permanently departed before Voting ended are excluded at round resolution, according to Section 2.5.
- The room host follows the same gameplay rules as every other player.

**Game State and Responsibilities**
- M1 manages player connection status, game-state restoration, permanent departures, and termination decisions.
- M3 displays connection-status changes and restores the gameplay interface after reconnection.
- M4 manages room membership, host ownership, and post-game room cleanup under the agreed one-match-per-room policy.
- M5 provides authenticated WebSocket connections and connection lifecycle support.
- The backend processes permanent departures and final game outcomes only once.
- A finished or terminated game cannot return to active gameplay.