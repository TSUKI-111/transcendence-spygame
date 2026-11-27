# M5 Handoff — Spy Game WebSocket Gateway, Connection Lifecycle & Action Security

**Project:** ft_transcendence — Spy Game  
**Repository:** https://github.com/TSUKI-111/transcendence-spygame  
**Prepared by:** M1 (Game Engine owner)  
**Assignee:** M5 (Technical Lead)  
**Prepared:** November 24, 2026 · **Updated:** November 27, 2026  
**Scope:** Delegated **Tasks 2, 3 and 4**. Task 2 includes **public `game.*` Socket.IO event broadcasting** under the new architecture.  
**Status:** Assigned for implementation **after M1 completes and merges Task 1**.

## 1. Ownership and start condition

M5 is responsible for **Task 2 — Game WebSocket Gateway**, **Task 3 — Socket disconnection/reconnection**, and **Task 4 — Gameplay socket actions and security**. M1 remains owner of game rules and `GameService`, and will handle **Task 1 (public realtime events)**, **Task 5 (chat eligibility)**, **Task 6 (Rooms integration verification)**, **Task 7 (final-result delivery rules)**, **Task 8 (end-to-end multiplayer verification)**, and **Task 9 (final review)**. Changes to gameplay rules must be agreed with M1; changes to Rooms must be coordinated with M4.

**Dependency: do not start implementing Tasks 2–4 until M1's Task 1 event-contract changes are merged into `main`.** M5 may read this document and plan beforehand. Task 1 will separate gameplay events from Rooms, remove legacy `room.game_*` forwarding, add `room.game_started`, and finalize the canonical gameplay event names/payloads. M5 must adopt that merged contract rather than define competing events.

## 2. Branch and Git workflow

Use **two separate sequential branches**, not a shared working branch:

| Who | Work | Branch | PR target |
|---|---|---|---|
| M1 (first) | Task 1 — public event alignment and game-start notification | `feature/m1-realtime-events` | `main` |
| M5 (second) | Tasks 2–4 — gateway, socket lifecycle, security | `feature/m5-game-websocket` | `main` |

M1 creates, tests, pushes and merges the Task 1 PR first. **Only after that merge**, M5 runs from the repository root:

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/m5-game-websocket
```

M5 implements the assigned work on this branch, makes focused commits (gateway actions, connection lifecycle, security/tests), pushes, and opens a PR into `main`:

```bash
git status --short
git diff --check
git push -u origin feature/m5-game-websocket
```

Do not commit directly to `main`, force-push shared branches, or mix M1's Tasks 1/5/6/7/8 into M5's PR. Before merging, M1 reviews gameplay behavior and M4 reviews any Rooms-related changes. If `main` moves while the work is in progress, fetch and integrate it carefully before the PR; do not overwrite teammate changes.

**Suggested document path inside the repository:** `docs/m1/M5_Game_WebSocket_Gateway_Handoff.md` (M1 can add this in the Task 1 PR).

## 3. Existing code to reuse — do not rewrite

| Existing code on `main` | Purpose |
|---|---|
| `backend/src/game/game.service.ts` | `getPlayerState`, `submitClue`, `submitVote`, `markDisconnected`, `reconnectPlayer`; authoritative game rules |
| `backend/src/game/game.module.ts` | Registers `GameService`, `GameTimerService` and `GameEventsService` |
| `backend/src/game/contracts/player-game-state.interface.ts` | Private snapshot including role, word when authorized, statuses, clues, vote status, `finalResult` |
| `backend/src/game/contracts/game-action-response.interface.ts` | `{ ok: true }` or `{ ok: false, error: { code, message } }` |
| `backend/src/game/game-action-error.ts` | `toGameActionFailure(error)` for safe, stable client errors |
| `backend/src/auth/ws-session-auth.service.ts` | `WsSessionAuthService`: validates session cookie and allowed Origin; sets `socket.data.user` |
| `backend/src/auth/auth.module.ts` | Exports `WsSessionAuthService` |
| `backend/src/rooms/room.gateway.ts` | Existing Socket.IO default-namespace gateway, connection authentication middleware and authenticated `room.join` |
| `backend/src/game/game-events.service.ts` | Internal `GameEventsService.subscribe(...)` and event publication; M5 subscribes for gameplay Socket.IO delivery |
| `backend/src/game/contracts/game-event.type.ts` | **Canonical internal gameplay event types**; use their payload fields for `game.*` broadcasts |
| `backend/src/rooms/rooms.service.ts` | Room membership/start/leave and the remaining `game.ended` listener for room finalization; Task 1 removes four gameplay forwarding handlers |
| `backend/src/rooms/events/room-events.publisher.ts` | Room-only events, including `room.game_started` and `room.finished` after Task 1 |
| `backend/src/rooms/events/room-events.types.ts` | Room-only Socket.IO payload types; no legacy `room.game_*` gameplay events after Task 1 |

**Architecture after M1's Task 1 merge:** `GameService` → internal `GameEventsService` → **M5's `GameGateway`** → authorized players receive public `game.*` events. Separately, M4's `RoomsService` listens to the internal `game.ended` event **only** to finalize the Room and emits `room.finished`. M4 also emits `room.game_started` after a successful start. The former forwarding path `GameEventsService` → `RoomsService` → `room.game_*` is **removed by M1 in Task 1**. M5 MUST implement the public gameplay broadcaster, without bringing back the old `room.game_*` names or creating a second duplicate broadcaster.

**No competing Socket.IO connections:** Use the same existing default Socket.IO namespace/server and M2's session-authenticated sockets. Reuse established room membership/routing, but authorize game-specific state and recipient scope against the actual game roster. As of the reviewed remote `main`, `GameGateway` did not yet exist; M1's local Task 1 changes must land in `main` before M5 begins.

## 4. Task 2 — Implement the authenticated Game WebSocket Gateway

**Deliverable:** `backend/src/game/game.gateway.ts`, registered as a provider in `GameModule`, plus focused DTOs/types, **public gameplay event subscription/broadcasting**, and `game.gateway.spec.ts`. If injecting `WsSessionAuthService`, import `AuthModule` in `GameModule` (it already exports that service); do not instantiate authentication providers manually. Use NestJS `@WebSocketGateway()` / `@SubscribeMessage()`, Socket.IO and the **existing default namespace** unless Task 1 explicitly changes the architecture. Do not introduce another Socket.IO server or an unrelated port/namespace.

Implement exactly these client actions:

| Client → server | Payload | Backend operation | Private acknowledgement / response |
|---|---|---|---|
| `game.get_state` | `{ "gameId": "uuid" }` | `getPlayerState(gameId, authenticatedUserId)` | Emit `game.state` **only to requesting socket** and acknowledge `{ "ok": true }` |
| `game.submit_clue` | `{ "gameId": "uuid", "clue": "ocean" }` | `submitClue(gameId, authenticatedUserId, clue)` | `{ "ok": true }`; `GameService` publishes internal event, and **GameGateway emits `game.clue_submitted` publicly** |
| `game.submit_vote` | `{ "gameId": "uuid", "targetId": 42 }` | `submitVote(gameId, authenticatedUserId, targetId)` | `{ "ok": true }`; **never** publicly broadcast the vote or selected target |

`targetId` is the **target user's numeric `User.id`**, not the internal `GamePlayer.id`. Use server-authoritative time; never accept a client-provided `nowMs`, `userId`, `role`, or `secretWord`. All validation must happen on the server. `room.join` is already handled by M4 and must not be duplicated casually. Ensure `game.get_state` and later reconnection do not rely on a forged room ID: validate against `GameService` and the authenticated user's original game participation.

**Private `game.state`** returns the existing `PlayerGameState` shape: `gameId`, `phase`, `roundNumber`, `phaseEndsAt`, `players` (only public status fields), the **requester's own** `role`, optional `secretWord` (Detectives only while playing), `clues`, `hasSubmittedClue`, `hasSubmittedVote` and `finalResult`. `finalResult.revelation` is permitted **only after `FINISHED`**, never after `TERMINATED`.

**Action acknowledgement example:**

```json
{ "ok": false, "error": { "code": "CLUE_ALREADY_SUBMITTED", "message": "You already submitted a clue this round." } }
```

Use `toGameActionFailure()` for game-service exceptions and safe responses for authentication / malformed payloads. Do not leak stack traces, DB errors, vote targets, secret words or other players' roles in failures. The Gateway should be thin: authenticate, validate message shape, invoke existing service, deliver response; **do not copy game rules into it**.

**Acceptance:** An authenticated game participant can request a correct private snapshot, submit one valid clue and one valid vote through Socket.IO. Invalid requests fail cleanly; accepted clues reach the correct authorized participants through **`GameGateway`'s `game.clue_submitted` broadcast**; individual votes remain private. All five public `game.*` events below must be routed exactly once, independently of the frontend's actions.

### Task 2B — Broadcast public gameplay events (required, not optional)

Subscribe to `GameEventsService` and broadcast the following **exact** Socket.IO names (the legacy `room.game_*` events have been removed by M1's Task 1):

| Internal event emitted by M1 | Public Socket.IO event from GameGateway | Fields/visibility |
|---|---|---|
| `game.phase_changed` | `game.phase_changed` | `gameId`, `phase`, `roundNumber`, `phaseEndsAt`; initial phase and subsequent transitions |
| `game.clue_submitted` | `game.clue_submitted` | `gameId`, `roundNumber`, `userId`, `clue`; accepted clues only |
| `game.round_resolved` | `game.round_resolved` | `gameId`, `roundNumber`, `outcome`, `eliminatedUserId`, `eliminatedRole`; only the eliminated role is public |
| `game.player_updated` | `game.player_updated` | `gameId`, `userId`, plus **one changed status** (`participationStatus` or `connectionStatus`) |
| `game.ended` | `game.ended` | `gameId`, `roomId`, `status`, `winner`, `reason`, `endedAt`; **no secret word, roles list, or individual votes** |

`game.state` is **not** a public broadcast: send the authorized `PlayerGameState` privately to the requesting socket after `game.get_state` or authorized restoration. `game.ended`'s `GameFinalResult` contains a safe public outcome only. For a `FINISHED` game's Spy/word revelation, clients obtain `PlayerGameState.finalResult` after authorization. `TERMINATED` has `revelation: null`.

**Room events remain M4's responsibility:** `room.game_started`, `room.finished`, `room.player_joined`, `room.player_left`, `room.host_changed`. Do not replace them or re-emit them as `game.*` duplicates. `room.game_started` carries the new `gameId` to lobby sockets so M3 can enter the game and request private state. `room.finished` is the room lifecycle notification and may coexist with `game.ended` because they describe different module responsibilities.

**Implementation expectations:**

- Register one gameplay event subscription on the server side and unsubscribe during shutdown; avoid duplicate registrations and emissions.
- Ensure only sockets authorized for that active game receive public gameplay events. A Socket.IO room name is a routing mechanism, **not proof of authorization**; reuse M4's authenticated membership flow and game roster as appropriate.
- The same default Socket.IO namespace/server must be shared with M4's existing RoomGateway; no new port, namespace, or duplicated authentication middleware.
- Do not invent a per-second timer event. `phaseEndsAt` is authoritative and M3 draws countdowns locally.
- Keep private role/word delivery strictly separate from public events.
- Ensure `game.ended` broadcasts even for a termination triggered by disconnection/departure (not just by an explicit client action).
- Do not duplicate `room.game_started` when the first `game.phase_changed` is delivered. Both events are expected and have different purposes.
- **Start ordering:** `GameService.startGame()` currently publishes the initial internal `game.phase_changed` before `RoomsService.startRoom()` can publish `room.game_started`. Client code must tolerate this order and use the authoritative `gameId`/state snapshot rather than assuming `room.game_started` arrives first.


## 5. Task 3 — Connect socket disconnect/reconnect lifecycle

**Deliverable:** Socket connection/presence logic integrated with `GameGateway`, or a small dedicated connection helper/service, plus tests.

- Track each authenticated user's **active sockets per active game**; do not confuse membership in a lobby with actively observing/participating in a specific game. Bind `(gameId, userId)` only after authorization against the Game Engine. Use M4's `room.game_started` notification and the authorized game subscription to associate existing room connections as the game begins; do not rely exclusively on a later `game.get_state` request or silently miss disconnects for players who never open the game screen.
- When the **last** active game socket for a player disconnects unexpectedly, call `GameService.markDisconnected(gameId, userId)`; do not call `leaveGame()` for a network loss.
- When a valid participant reconnects before current-round resolution, call `GameService.reconnectPlayer(gameId, userId)` to mark them connected and restore their authorized state privately. Reuse the current deadlines, previously accepted clues and vote status; do not reset a round or timer.
- A player with two tabs must **stay connected** when just one tab closes. Multiple socket joins, repeated reconnects and duplicate disconnect callbacks must be safe and idempotent.
- A participant who intentionally selects **Leave Room/Game** follows M4's existing `leaveRoom()` → `GameService.leaveGame()` path; do not treat that as a temporary socket loss. Remove their game presence bookkeeping safely.
- A permanently `DEPARTED` player cannot rejoin active gameplay. If a game is already `FINISHED` or `TERMINATED`, retrieve the permitted final snapshot via `getPlayerState()` instead of trying to change the terminal game's connection status.
- A disconnection never stops the server timer. The Game Engine handles permanent departure at the agreed round-resolution boundary.
- `socket.data.user` comes from M2's session-authenticated connection. Do not invent another token, cookie or user-ID validation flow.

**Important Socket.IO integration detail:** M4's `RoomGateway.afterInit()` already installs `server.use(...)` using `WsSessionAuthService`. Multiple gateways on the same namespace must not accidentally register conflicting authentication middleware or expose an unauthenticated path. Confirm middleware setup and lifecycle order through an actual socket integration test. M2's Origin/cookie checks must remain enforced.

**Acceptance:** Last-socket disconnect marks the active participant disconnected; reconnect before the round ends restores the same private state; a second live tab prevents false disconnection; late reconnect cannot resurrect departed gameplay; no duplicate transition or premature termination occurs.

## 6. Task 4 — Harden gameplay socket actions and security

**Deliverables:** Defensive payload validation, secure authorization of every action, safe acknowledgement mapping, and adversarial tests.

- Authenticate each request using trusted `socket.data.user.id` (`number`, safe positive integer), populated by M2's session validation; no client-selected acting `userId`.
- Reject unauthenticated users and users outside the requested game. No private state or room/game secrets should be sent before authorization succeeds.
- Validate `gameId` as a valid UUID/string according to the existing schema; clue must be a string within the existing 100-character rule; vote target must be a valid numeric user ID. Reject extra privileged fields rather than trusting them.
- Call the existing GameService for authoritative phase, deadline, participation, connection status, duplicate clue and duplicate vote checks; do not rely on disabled frontend buttons.
- Ensure an eliminated/departed player cannot submit clues or votes and a disconnected player cannot act until properly reconnected.
- Preserve vote privacy. No broadcasts of `targetId`, the vote table, or full vote counts. No public message may contain the secret word or uneliminated roles.
- Map service errors using `toGameActionFailure` and consistent `GameActionResponse`. Unknown internal errors → `INTERNAL_ERROR` without sensitive details; server logs may retain appropriate diagnostics without credentials.
- Validate session and cross-origin behavior using the existing `WsSessionAuthService`; do not weaken HTTPS Origin enforcement or cookie security to make local tests pass.

**Acceptance:** Forged identity, invalid/extra payloads, unauthorized state requests, action after deadline, duplicate submissions, eliminated/disconnected actions and cross-game interference all fail safely without writing to the database or disclosing private data.

## 7. Tests M5 must deliver

Create Gateway unit tests and at least one real Socket.IO integration/e2e path (using the project's existing test conventions and an **isolated** PostgreSQL test database when persistence is needed):

1. Valid and invalid authenticated session, Origin and cookie handling.
2. Nonparticipant cannot call `game.get_state`; Spy never sees active secret word or other roles.
3. Private state delivered to **only** the requester, not all sockets in a room.
4. Clue action accepted once, with exactly one **public `game.clue_submitted`** event from GameGateway; invalid or late clue has no event.
5. Vote action accepted once; no public vote-target leakage.
6. Proper `GameActionResponse` for invalid phase, expired timer, duplicate clue/vote, wrong target and unknown errors.
7. Socket disconnect/reconnect with one tab and two tabs; no duplicate status events; last-socket-only disconnection.
8. Reconnect before and after round resolution; original player role and deadline preserved; permanent departure not undone.
9. Terminal `FINISHED`/`TERMINATED` state retrieval does not mutate a completed game; terminate reveals no secrets.
10. Existing RoomGateway's `room.join`, `room.game_started`, and `room.finished` work after the new Gateway is registered. All five `game.*` public events are routed exactly once; the removed `room.game_*` forwarding is not resurrected.

Suggested commands (run from `backend/`, with the project's approved Node 22 toolchain and test DB):

```bash
npm ci
npm run build
npm test -- game.gateway.spec.ts
npm test
```

Additional integration/e2e commands depend on the test file name/config; report the exact commands and whether any DB integration tests were **skipped**. Do not treat skipped tests as passes. No new CI pipeline or schema migration is required for these gateway-only tasks unless an actual necessity is discovered and approved.

## 8. Boundaries and integration handoff

**M5 does not implement:** game rules, role assignment, word selection, phase timers, vote resolution, Prisma Game models/migrations, M4's room start/leave behavior, M2's chat rules, frontend React UI, or M1's Task 1 public event naming. **M5 DOES implement the public `game.*` Socket.IO broadcast layer** after M1 has removed M4's old forwarding. Keep unrelated `room.*` broadcasts owned by M4.

**M1 provides before M5 begins:** merged Task 1 PR that removes four old M4 gameplay forwarding handlers/types, implements `room.game_started`, and documents canonical `game.*` names/payloads plus authorized observer/final-state access. **M5 reports immediately** if an agreed contract cannot be implemented securely as written; don't silently change public event names or gameplay rules.

**M5 completion handoff to M1:** PR URL, changed-file summary, supported socket actions with request/ack examples, presence design, tests with exact results, known limitations, and any required M1/M3/M4 follow-up. M1 remains responsible for Tasks 5–8 and the final multiplayer verification, coordinating shared changes with M5.

## 9. Other M1 tasks — context for M5 (not delegated)

These tasks remain **M1's responsibility**. M5 does **not** need to implement them; this summary explains where his Gateway work fits and what he should avoid duplicating.

| Task | What M1 will do | Why M5 should know |
|---|---|---|
| **1 — Realtime event integration** *(before M5 starts)* | Remove four M4 gameplay-event forwarders and their `room.game_*` types/methods, retain M4 room lifecycle events, add `room.game_started`, and finalize `game.*` payload contracts. | **You must implement the five public `game.*` broadcasts** in GameGateway. Do not restore the obsolete `room.game_*` pipeline. |
| **5 — Discussion chat eligibility** | Ensure only `ACTIVE`, `CONNECTED` game participants can send chat messages during the valid `DISCUSSION` deadline, coordinating changes with the Rooms/Chat owner. | Socket presence and disconnect updates must reach GameService reliably; chat authorization will rely on that state. |
| **6 — Game ↔ Rooms integration** | Verify start, leave, host departure, finished/terminated room state, membership behavior and recovery from missed finalization. | Do not replace M4's `room.join` or `leaveRoom()`; distinguish intentional leave from network disconnect. |
| **7 — Final-result delivery and restoration** | Specify who may see the result and how authorized participants recover it, including final Spy/word revelation only on `FINISHED`. | Your Gateway must safely return `getPlayerState()` privately; do not include secret revelation in a generic room-wide event. |
| **8 — Complete multiplayer integration tests** | Test the whole flow with real users/sockets: clues, chat, voting, ties, departures, reconnects, room cleanup and final results. | Deliver focused Gateway tests and a working socket setup so M1 can run full end-to-end scenarios. |
| **9 — Final integration review** | Recheck contracts, documentation, build/tests and a browser multiplayer game; review and merge integration PRs. | Provide a clear PR, exact commands/results, and any remaining limitations for review. |

**Work sequence:** M1 completes **Task 1** → M1 merges it into `main` → M5 creates `feature/m5-game-websocket` and implements **Tasks 2–4** → M1 coordinates **Tasks 5–8** and the **final review**. M1 can work on independent parts of Tasks 5–8 while M5 implements the Gateway, but shared files/contracts require coordination.

## 10. Definition of done

- [ ] M1 Task 1 merged; M5 branch created from latest `main`.
- [ ] `GameGateway` registered and safely shares existing Socket.IO infrastructure; subscribes/unsubscribes to `GameEventsService`.
- [ ] Three actions authenticated, validated, and acknowledged.
- [ ] `game.state` delivered privately and role/word/vote privacy proven.
- [ ] All five public `game.*` events broadcast exactly once by GameGateway; no legacy `room.game_*` forwarding remains.
- [ ] M4 `room.game_started` and `room.finished` remain intact and are not duplicated by GameGateway.
- [ ] Last-socket disconnect and authorized reconnect work, including multi-tab behavior.
- [ ] Intentional departure and terminal games do not incorrectly reconnect.
- [ ] Error mapper used; no leakage of internal errors or data.
- [ ] Build, unit tests, and real integration tests pass; skips disclosed.
- [ ] M1 reviews PR and accepts gameplay integration before merge.

**Ready for implementation only after M1's Task 1 event PR merges into `main`.**
