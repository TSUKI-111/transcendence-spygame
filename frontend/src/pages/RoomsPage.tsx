import { useEffect, useState } from "react";
import img from "../assets/vite.svg";
import { useNavigate } from "react-router-dom";

type Room = {
  id: string;
  name: string;
  host: string;
  players: number;
  maxPlayers: number;
};

export default function RoomsPage() {
  const [mockRooms, setRooms] = useState<Room[]>([
    { id: "1", name: "Test room", host: "aimane", players: 2, maxPlayers: 6 },
    {
      id: "2",
      name: "Soirée espions",
      host: "sara",
      players: 5,
      maxPlayers: 8,
    },
    {
      id: "3",
      name: "Night shift",
      host: "youssef",
      players: 3,
      maxPlayers: 4,
    },
    {
      id: "4",
      name: "A very long room name that should be cut",
      host: "rose",
      players: 1,
      maxPlayers: 8,
    },
  ]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");

  const navigate = useNavigate();
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("http://localhost:3000/rooms");
        if (!response.ok) throw new Error("error fetching");

        const data = await response.json();
        setRooms(data);
        setState("ready");
      } catch {
        setState("error");
      }
    }

    fetchData();
  }, []);

  // if (state === "loading") return <p>Loading...</p>;
  // if (state === "error") return <p>Could not load rooms.</p>;
  // if (mockRooms.length === 0) return <p>No rooms yet.</p>;
  return (
    <main className="flex flex-col gap-4 p-8 text-white">
      <div>
        <h1 className="text-3xl font-extrabold">Join a room</h1>
        <p className="text-sm text-slate-300">
          Pick an available room and join the game
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {mockRooms.map((room) => (
          <div
            key={room.id}
            className="flex items-center w-full gap-4 rounded-2xl border border-violet-500/50 bg-linear-to-b from-indigo-950 to-slate-900 p-4"
          >
            <img src={img} className="h-14 w-14 shrink-0" />

            <div className="min-w-0 flex-1">
              <h2 className="truncate font-bold">{room.name}</h2>
              <p className="text-sm text-slate-300">{room.host}</p>
            </div>

            <div className="flex shrink-0 flex-col items-center">
              <p className="text-xl font-bold">
                {room.players} / {room.maxPlayers}
              </p>
              <p className="text-sm text-slate-300">
                {room.maxPlayers - room.players} places left
              </p>
            </div>

            <button
              type="button"
              className="h-12 shrink-0 rounded-xl bg-violet-500 px-6 font-semibold"
              onClick={() => navigate(`/lobby/${room.id}`)}
            >
              Join Room
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
