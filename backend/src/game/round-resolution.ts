import type {GameRole} from "./contracts/player-game-state.interface.ts";
import type {RoundOutcome} from "./contracts/round-resolution.interface.ts";

interface Candidate
{
	id: number;
	userId: number;
	role: GameRole;
}

interface RecordedVote
{
	targetGamePlayerId: number;
}

export function calculateVotingOutcome(candidates: Candidate[], votes: RecordedVote[]):
{
	outcome: RoundOutcome;
	eliminated: Candidate | null;
}
{
	const counts = new Map<number, number>();

	const eligibleIds = new Set(candidates.map(player => player.id));

	// Count votes for still-active candidates.
	for (const vote of votes)
	{
		const targetId = vote.targetGamePlayerId;
		if (!eligibleIds.has(targetId))
		{
			continue;
		}
		counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
	}

	if (counts.size === 0)
	{
		return {
			outcome: "NO_VOTES",
			eliminated: null,
		};
	}

	const highest = Math.max(...counts.values());

	const leaders = [...counts.entries()].filter(([, count]) => count === highest);

	if (leaders.length > 1)
	{
		return {
			outcome: "TIE",
			eliminated: null,
		};
	}

	const eliminated = candidates.find(player => player.id === leaders[0][0]);

	if(!eliminated)
	{
		throw new Error("INVALID_VOTE_TARGET");
	}
	return {
		outcome: "ELIMINATED",
		eliminated,
	};
}
