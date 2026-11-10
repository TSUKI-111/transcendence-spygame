export type Room = {
  id: number;
  name: string;
  maxPlayers: number;
  status: "waiting" | "playing";
  players: number;
};

export const mockRooms: Room[] = [
  {
    id: 1,
    name: "Rookie Arena",
    maxPlayers: 4,
    status: "waiting",
    players: 4
  },
  {
    id: 2,
    name: "Champions League",
    maxPlayers: 4,
    status: "playing",
    players: 4
  },
  {
    id: 3,
    name: "Training Room",
    maxPlayers: 2,
    status: "waiting",
    players: 1
  }
];