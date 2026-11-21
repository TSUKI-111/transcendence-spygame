
import {Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service.js';

import {GameService} from './game.service.js';

@Injectable()
export class GameTimerService implements OnApplicationBootstrap, OnModuleDestroy
{
	private readonly logger = new Logger(GameTimerService.name);

	private timer: ReturnType<typeof setInterval> | null = null;
	private isChecking = false;

	constructor( private readonly prisma: PrismaService, private readonly gameService: GameService,)
	{}

	// Called when the NestJS application has started
	onApplicationBootstrap(): void
	{
		this.logger.log('Game timer service started');

		// Check immediately after startup
		void this.checkExpiredGames();

		// Then check every second
		this.timer = setInterval(() => {void this.checkExpiredGames()}, 1000);
	}

	// Called when NestJS shuts down normally
	onModuleDestroy(): void
	{
		if (this.timer !== null)
		{
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	async checkExpiredGames(): Promise<void>
	{
		// Avoid overlapping checks inside this process
		if (this.isChecking)
		{
			return;
		}

		this.isChecking = true;

		try
		{
			// Find games whose current phase has expired
			const expiredGames = await this.prisma.game.findMany(
			{
				where:
				{
					phase:
					{
						in: ['CLUE_SUBMISSION', 'DISCUSSION', 'VOTING'],
					},
					phaseEndsAt:
					{
						lte: new Date(),
					},
				},
				select:
				{
					id: true,
				},

				orderBy:
				{
					phaseEndsAt: 'asc',
				},
				take: 100,
			});

			// Process each expired game
			for (const game of expiredGames)
			{
				try
				{
					await this.gameService.advancePhaseIfExpired(game.id);
				}
				catch (error)
				{
					// A failed game should not block other games.
					const message = error instanceof Error ? error.message : String(error);
					this.logger.warn(`Could not advance game ${game.id}: ${message}`);
				}
			}
		}
		catch (error)
		{
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error(`Game timer check failed: ${message}`);
		}
		finally
		{
			this.isChecking = false;
		}
	}
}
