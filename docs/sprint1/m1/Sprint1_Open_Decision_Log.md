# M1 — Sprint 1 Open Decision Log

**Last planned review:** November 2, 2026 — meeting passed without reviewing these decisions  
**Last updated:** November 5, 2026  
**Status:** Sprint 1 documentation completed — integration decisions pending  
**Purpose:** Track what must be confirmed before implementing and connecting the Game Engine during Sprint 2.

## 1. Confirmed Project Decisions

These decisions are already established and do not need to be discussed again:

- **Project scope:** 15 planned module points; Gamification removed.
- **User ID:** `Int` / TypeScript `number`.
- **Room ID:** UUID / TypeScript `string`.
- **Rooms:** Public/private rooms and invitation codes remain supported.
- **Game Engine:** M1 owns gameplay rules, roles, phases, voting and victory conditions.
- **Room membership:** M4 owns `RoomPlayer` membership and host transfer.
- **Database:** M5 coordinates shared Prisma schema changes and migrations.
- **Game lifecycle:** One match per room, followed by room cleanup.

These decisions do not automatically approve the technical interfaces below.

## 2. Open Integration Decisions

| ID | What Needs Confirmation | Proposed Default | Owner |
|---|---|---|---|
| D4 | Exact `startGame()` request and response | `{ roomId, participantIds }` → `{ gameId, roomId, phase, roundNumber, phaseEndsAt }` | M1 + M4 |
| D4-A | How M4 calls M1 and handles failed/concurrent starts | Internal NestJS service call; one active game per room; failed start leaves room `WAITING` | M1 + M4 |
| D5 | What M1 sends after game completion | `{ gameId, roomId, status, winner, reason, endedAt }` | M1 + M4 |
| D6 | How M4 receives final results and avoids duplicate processing | One internal finalization notification covering `FINISHED` and `TERMINATED` | M1 + M4 |
| D7 | Player departure, host transfer, cancellation and room cleanup | M1 handles game participation; M4 handles room membership and cleanup | M1 + M4 |
| E1 | Exact gameplay WebSocket events and payloads | Six server events and three client actions from Task 4 | M1 + M3 |
| E2 | Private role delivery and state restoration | Authenticated player-specific `game.state` | M1 + M3 + M5 |
| V1 | Shared game and room error codes | Use the proposed codes in Tasks 2–5 | M1 + M3 + M4 |

**Status:** All rows remain **Open** until the affected members confirm them.

**Due:** Before implementing the corresponding shared integration, rather than assigning another unconfirmed meeting date.

## 3. Questions to Check During Sprint 2

### M1 + M4 — Game Engine and Rooms

- [ ] Confirm the exact `startGame()` signature, response and error handling.
- [ ] Confirm how room locking prevents simultaneous game starts.
- [ ] Confirm that failed starts leave the room in `WAITING`.
- [ ] Confirm the finalization notification method and payload.
- [ ] Confirm how M4 handles duplicate finalization notifications.
- [ ] Confirm the proposed temporary room status `FINISHED` for cleanup.
- [ ] Confirm how M4 notifies M1 when someone intentionally leaves an active game.
- [ ] Confirm when room memberships are released and when the room can safely be deleted.
- [ ] Decide whether an additional administrative Cancel Game action is necessary.

**Existing responsibility boundary:** M4 removes the departing player's `RoomPlayer` membership; M1 retains their original game record and marks their game participation `DEPARTED`.

### M1 + M3 — Gameplay Frontend

- [ ] Confirm the six server event names and payloads.
- [ ] Confirm the three client actions and error acknowledgements.
- [ ] Confirm private role and secret-word delivery.
- [ ] Confirm how M3 obtains `gameId` after a room starts.
- [ ] Confirm reconnection using the current authorized `game.state`.

### M1 + M2/M5 — Authentication and Database

- [ ] Confirm how M1 receives the authenticated player ID.
- [ ] Confirm authenticated Socket.IO connection and disconnection notifications.
- [ ] Confirm backend chat eligibility checks during `DISCUSSION`.
- [ ] Confirm M1's `Game` and `GamePlayer` Prisma model requirements with M5.
- [ ] Confirm the `Game`–`Room` relationship and safe deletion behavior.

## 4. Decisions M1 Will Propose

M1 will prepare these Game Engine interfaces without waiting for other members to design them:

- `StartGameRequest` and `StartGameResponse`.
- Game ID creation and initial gameplay phase.
- Final-result payload for both `FINISHED` and `TERMINATED`.
- Gameplay event names and authorized payloads.
- Game Engine validation and error codes.
- Player participation and departure behavior.

Other members need to confirm compatibility where these proposals affect their implementations.

## 5. Decision Tracking Rules

- **Open:** Proposed but not yet confirmed.
- **Approved:** Confirmed by the responsible members.
- **Changed:** A different solution was agreed upon and documented.
- **Blocked:** Integration cannot proceed until a specific issue is resolved.

Each decision should be updated when its integration work begins. Any blocker must have an owner and a new target date.

## 6. Sprint 1 Closure

All M1 Sprint 1 technical documents have been prepared and updated for the simplified 15-point scope.

The November 2 review meeting passed without resolving these integration decisions. Therefore, no outstanding technical contract is being represented as approved.

**Sprint 1 documentation can be pushed to GitHub. The unresolved decisions remain tracked here and will be addressed during Sprint 2 integration.**