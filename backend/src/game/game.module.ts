import {Module} from "@nestjs/common";

import {GameService} from "./game.service.js";
import {GameTimerService} from "./game-timer.service.js";
import {GameEventsService} from "./game-events.service.js";

@Module(
{
	providers: [GameService, GameTimerService, GameEventsService],
	exports: [GameService, GameEventsService]
})

export class GameModule {}
