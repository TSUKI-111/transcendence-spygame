import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import img from "../assets/vite.svg";
import crownimg from "../assets/icons/crown.png";

type Player = {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  avatarUrl: string;
};

function Slot({ player }: { player: Player | null }) {
  if (player === null) {
    return (
      <div className="flex w-24 flex-col items-center gap-1">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-slate-600 text-slate-400">
          +
        </div>
        <p className="text-xs text-slate-400">waiting</p>
      </div>
    );
  }
  return (
    <div className="flex w-24 flex-col items-center gap-1">
      <img
        src={player.avatarUrl}
        className={`h-20 w-20 rounded-full bg-slate-400 object-cover ring-2 ${player.isHost ? "ring-lime-300" : "ring-violet-500"}`}
      />
      <p className="text-sm font-semibold">{player.name}</p>
      <p className="text-xs text-lime-300">{player.isHost ? "host" : ""}</p>
    </div>
  );
}

export default function LobbyPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const maxPlayers = 8;

  const [players] = useState<Player[]>([
    { id: "1", name: "aimane", isHost: true, ready: false, avatarUrl: img },
    { id: "2", name: "sara", isHost: false, ready: false, avatarUrl: img },
    { id: "3", name: "youssef", isHost: false, ready: false, avatarUrl: img },
  ]);

  const emptySlots = maxPlayers - players.length;

  const host = players.find((player) => player.isHost);
  const slots: (Player | null)[] = [
    ...players,
    ...Array.from({ length: emptySlots }, () => null),
  ];

  return (
  <main className="flex flex-col gap-6 p-8 text-white">
    <div className="flex flex-col gap-6 xl:flex-row">
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex items-center gap-3">
          <img src={crownimg} className="h-10 w-10" />
          <h1 className="text-2xl font-bold">{host?.name}'s lobby</h1>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 rounded-xl border border-violet-500/50 bg-slate-900 px-4 py-2">
            <div>
              <p className="text-xs text-slate-300">lobby's code</p>
              <p className="font-mono text-lg">6kg57fx</p>
            </div>
            <button type="button" className="h-10 rounded-lg border border-slate-700 px-3 text-sm">
              copy
            </button>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">{players.length} / {maxPlayers} players</p>
            <p className="text-sm text-slate-300">3 players minimum required to start the game</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="flex justify-center gap-16">
            {slots.slice(0, 3).map((slot, i) => (
              <Slot key={i} player={slot} />
            ))}
          </div>
          <div className="flex justify-center gap-12">
            {slots.slice(3).map((slot, i) => (
              <Slot key={i + 3} player={slot} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col gap-4 rounded-2xl border border-violet-500/50 bg-linear-to-b from-indigo-950 to-slate-900 p-4 xl:w-1/3">
        <h1 className="font-bold">Room chat</h1>
        <p className="flex-1 text-sm text-slate-300">chat will go here</p>
        <form className="flex gap-2">
          <input
            placeholder="chat here"
            className="h-11 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3"
          ></input>
          <button className="h-11 rounded-lg bg-violet-500 px-4 font-semibold"> send</button>
        </form>
      </div>
    </div>

    <div className="flex gap-4">
      <button
        type="button"
        className="h-12 flex-1 rounded-xl border border-red-500/50 font-semibold text-red-400"
        onClick={() => navigate("/rooms")}
      >
        Leave
      </button>
      <button
        type="button"
        className="h-12 flex-1 rounded-xl bg-lime-300 font-semibold text-slate-900"
        onClick={() => navigate("/game/1")}
      >
        Start game
      </button>
    </div>
  </main>
);
}
