import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoomGateway } from './room.gateway.js';
import { RoomEventsPublisher } from './events/room-events.publisher.js';
import type { Server } from 'socket.io';

describe('RoomGateway', () => {
  let gateway: RoomGateway;
  let publisher: RoomEventsPublisher;
  let mockServer: {
    to: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    publisher = new RoomEventsPublisher();

    mockServer = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };

    gateway = new RoomGateway(publisher);
    gateway.afterInit(mockServer as unknown as Server);
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
