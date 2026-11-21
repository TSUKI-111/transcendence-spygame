import {Injectable, Logger} from '@nestjs/common';

import type {GameEvent} from './contracts/game-event.type.ts';

type GameEventListener = (event: GameEvent) => void | Promise<void>;

@Injectable()
export class GameEventsService
{
    private readonly logger = new Logger(GameEventsService.name);

    private readonly listeners = new Set<GameEventListener>();

    // Other backend components can subscribe to game events.
    subscribe(listener: GameEventListener): () => void
    {
        this.listeners.add(listener);
        
        // Return a function that removes this subscription.
        return () => 
        {
            this.listeners.delete(listener);
        };
    }

    // Publish an event to registered listeners.
    async publish(event: GameEvent): Promise<void>
    {
        for (const listener of this.listeners)
        {
            try
            {
                await listener(event);
            }
            catch (error)
            {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error(`Listener failed for ${event.name}: ${message}`);
            }
        }
    }
}