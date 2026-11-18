import { ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

import type { ChatErrorPayload } from '../chat.types.js';

@Catch(WsException)
export class ChatWsExceptionFilter implements ExceptionFilter<WsException> {
  catch(exception: WsException, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();

    const error: ChatErrorPayload = {
      code: 'VALIDATION_ERROR',
      message: 'Invalid message data',
    };

    client.emit('chat.error', error);
  }
}
