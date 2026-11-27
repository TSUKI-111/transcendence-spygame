import { useEffect, useState } from "react";
import img from "../assets/vite.svg";
import { useNavigate } from "react-router-dom";

type Room = {
  id: string;
  name: string;
  host: { id: number; displayName: string };
  playersCount: number;
  maxPlayers: number;
  status: string;
  isPrivate: boolean;
  createdAt: string;
};

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");

  const navigate = useNavigate();

  async function joinRoom(roomId: string) {
  try {
    const response = await fetch(`/api/rooms/${roomId}/join`, {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to join room");
    }

    navigate(`/lobby/${roomId}`);
  } catch (error) {
    console.error("Join room failed:", error);
  }
}

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/rooms");
        if (!response.ok) throw new Error("error fetching");
        setRooms(await response.json());
        setState("ready");
      } catch {
        setState("error");
      }
    }

    fetchData();
  }, []);

  if (state === "loading") return <p>Loading...</p>;
  if (state === "error") return <p>Could not load rooms.</p>;
  if (rooms.length === 0) return <p>No rooms yet.</p>;
  return (
    <main className="flex flex-col gap-4 p-8 text-white">
      <div>
        <h1 className="text-3xl font-extrabold">Join a room</h1>
        <p className="text-sm text-slate-300">
          Pick an available room and join the game
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="flex items-center w-full gap-4 rounded-2xl border border-violet-500/50 bg-linear-to-b from-indigo-950 to-slate-900 p-4"
          >
            <img src={img} className="h-14 w-14 shrink-0" />

            <div className="min-w-0 flex-1">
              <h2 className="truncate font-bold">{room.name}</h2>
              <p className="text-sm text-slate-300">{room.host.displayName}</p>
            </div>

            <div className="flex shrink-0 flex-col items-center">
              <p className="text-xl font-bold">
                {room.playersCount} / {room.maxPlayers}
              </p>
              <p className="text-sm text-slate-300">
                {room.maxPlayers - room.playersCount} places left
              </p>
            </div>

            <button
              type="button"
              className="h-12 shrink-0 rounded-xl bg-violet-500 px-6 font-semibold"
              onClick={() => joinRoom(room.id)}
            >
              Join Room
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
