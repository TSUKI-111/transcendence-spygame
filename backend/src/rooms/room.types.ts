export type RoomStatus = 'WAITING' | 'IN_GAME';

export type RoomPlayer = {
    id: number,
    name: string,
}

export type Room = {
    id: string,
    name: string,
    host: RoomPlayer,
    players: RoomPlayer[],
    max_players: number,
    status: RoomStatus,
    is_private: boolean,
    createdAt: Date,
}