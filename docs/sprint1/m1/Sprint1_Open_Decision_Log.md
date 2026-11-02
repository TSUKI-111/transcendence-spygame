# M1 — Sprint 1 Open Decision Log

**Review meeting:** November 2, 2026 — 2:00 PM (Morocco time)  
**Status:** Pending team review  
**Purpose:** Record unresolved integration decisions with accountable owners and target due dates.

| ID | Open Decision | Proposed Default | Owner | Proposed Due |
|---|---|---|---|---|
| D4 | Start-game fields | `roomId` + `participantIds` | M1 + M4 | Nov 2, 2:00 PM |
| D4-A | Start invocation, duplicate starts and room locking | Trusted NestJS call; one active game per room | M1 + M4 | Nov 2, 2:00 PM |
| D5 | Final-result payload and timing | Task 3 payload, sent after M1 finalization | M1 + M4 | Nov 2, 2:00 PM |
| D6 | Completion reporting and XP retry behavior | M1 notifies M4; `gameId` prevents duplicate rewards | M1 + M4 | Nov 2, 2:00 PM |
| D7 | Host leaving, empty room and administrative cancellation | Normal departure rules; M4 owns room lifecycle; no separate cancellation by default | M1 + M4 | Nov 2, 2:00 PM |
| E1 | Gameplay phase and event names/payloads | Six states, six server events, three client actions | M1 + M3 | Nov 2, 2:00 PM |
| E2 | Private role delivery and reconnection snapshots | Authenticated, player-specific `game.state` | M1 + M3, with M5 | Nov 2, 2:00 PM |
| V1 | Shared error-code names | Codes proposed in Tasks 2–5 | M1 + M3 + M4 | Nov 2, 2:00 PM |

## Additional Implementation Dependencies

- **M2:** Confirm actual user ID type and authenticated identity source before implementation.
- **M5:** Confirm authenticated WebSocket identity and connection-status support before implementation.
- **M2/M1:** Confirm backend enforcement of discussion-chat eligibility.
- **M4/M5/M1:** Confirm shared Prisma schema ownership and migration coordination.

These are implementation dependencies to confirm before integration, not additional M1 Sprint 1 approvals. Any unresolved blocker must be assigned an owner and updated due date by the team.

## Decision Handling

- Every decision remains **Open** until the relevant members confirm it.
- During the meeting, update each decision to **Approved**, **Changed**, or **Blocked**.
- If blocked, record the agreed temporary assumption, accountable owner and a new due date before closing the sprint.
- The proposed due dates above are review targets, not confirmed commitments.

## Sprint 1 Closure

All M1 technical drafts are prepared. Remaining cross-module approvals are M1–M3 and M1–M4 contract reviews. Any unresolved item must remain visible in this decision log rather than being treated as approved.