import { ForbiddenException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { RoomGateway } from './room.gateway.js';
import { RoomEventsPublisher } from './events/room-events.publisher.js';
import type { RoomsService } from './rooms.service.js';
import type { WsSessionAuthService } from '../auth/ws-session-auth.service.js';
import type { Server, Socket } from 'socket.io';

describe('RoomGateway', () => {
  let gateway: RoomGateway;
  let publisher: RoomEventsPublisher;

  let verifyPlayerMembership: ReturnType<typeof vi.fn>;
  let authenticate: ReturnType<typeof vi.fn>;

  let mockServer: {
    use: ReturnType<typeof vi.fn>;
    to: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    publisher = new RoomEventsPublisher();

    verifyPlayerMembership = vi.fn().mockResolvedValue(undefined);
    authenticate = vi.fn().mockResolvedValue(undefined);

    mockServer = {
      use: vi.fn(),
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };

    const roomsService = {
      verifyPlayerMembership,
    } as unknown as RoomsService;

    const wsAuth = {
      authenticate,
    } as unknown as WsSessionAuthService;

    gateway = new RoomGateway(publisher, roomsService, wsAuth);
    gateway.afterInit(mockServer as unknown as Server);
  });

  it('should register the WebSocket authentication middleware', async () => {
    expect(mockServer.use).toHaveBeenCalledTimes(1);

    const middleware = mockServer.use.mock.calls[0][0] as (
      socket: Socket,
      next: (error?: Error) => void,
    ) => void;

    const socket = {} as Socket;

    await new Promise<void>((resolve, reject) => {
      middleware(socket, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    expect(authenticate).toHaveBeenCalledWith(socket);
  });

  it('should verify membership and join the room', async () => {
    const roomId = 'd1636ac8-350e-4488-a9f1-5ee7167dc35b';

    const client = {
      data: { user: { id: 42 } },
      join: vi.fn().mockResolvedValue(undefined),
    } as unknown as Socket;

    await gateway.handleJoinRoom({ roomId }, client);

    expect(verifyPlayerMembership).toHaveBeenCalledWith(roomId, 42);
    expect(client.join).toHaveBeenCalledWith(roomId);
  });

  it('should reject a socket without an authenticated user', async () => {
    const client = {
      data: {},
      join: vi.fn(),
    } as unknown as Socket;

    await expect(
      gateway.handleJoinRoom(
        { roomId: 'd1636ac8-350e-4488-a9f1-5ee7167dc35b' },
        client,
      ),
    ).rejects.toThrow('Connexion requise');

    expect(verifyPlayerMembership).not.toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('should reject a user who is not a room member', async () => {
    verifyPlayerMembership.mockRejectedValueOnce(
      new ForbiddenException('You are not a member of this room'),
    );

    const client = {
      data: { user: { id: 42 } },
      join: vi.fn(),
    } as unknown as Socket;

    await expect(
      gateway.handleJoinRoom(
        { roomId: 'd1636ac8-350e-4488-a9f1-5ee7167dc35b' },
        client,
      ),
    ).rejects.toThrow('Accès refusé à cette room');

    expect(client.join).not.toHaveBeenCalled();
  });

  it('should emit room.player_joined to the correct room', () => {
    const payload = {
      roomId: 'room-123',
      player: {
        id: 42,
        username: 'player42',
        displayName: 'Player 42',
      },
    };

    publisher.publishPlayerJoined(payload);

    expect(mockServer.to).toHaveBeenCalledWith('room-123');
    expect(mockServer.emit).toHaveBeenCalledWith('room.player_joined', payload);
  });

  it('should emit room.player_left to the correct room', () => {
    const payload = {
      roomId: 'room-123',
      playerId: 42,
    };

    publisher.publishPlayerLeft(payload);

    expect(mockServer.to).toHaveBeenCalledWith('room-123');
    expect(mockServer.emit).toHaveBeenCalledWith('room.player_left', payload);
  });

  it('should emit room.host_changed to the correct room', () => {
    const payload = {
      roomId: 'room-123',
      previousHostId: 10,
      newHostId: 20,
    };

    publisher.publishHostChanged(payload);

    expect(mockServer.to).toHaveBeenCalledWith('room-123');
    expect(mockServer.emit).toHaveBeenCalledWith('room.host_changed', payload);
  });

  it('should unsubscribe from room events on module destroy', () => {
    const emitSpy = vi.spyOn(mockServer, 'emit');

    gateway.onModuleDestroy();

    publisher.publishPlayerLeft({
      roomId: 'room-123',
      playerId: 42,
    });

    expect(emitSpy).not.toHaveBeenCalled();
  });
});
