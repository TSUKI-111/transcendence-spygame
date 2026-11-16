import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import img from "../assets/vite.svg";

type Player = { id: string; name: string; isHost: boolean; ready: boolean ; avatarUrl: string};


function Slot({ player }: { player: Player | null }) {
  if (player === null) {
    return (
      <div className="flex flex-col items-center">
        <div className="h-16 w-16 rounded-full border-2 border-dashed flex items-center justify-center">+</div>
        <p>waiting</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center">
      <img src={player.avatarUrl} className="h-16 w-16 rounded-full object-cover bg-slate-400" />
      <p>{player.name}</p>
      <p>{player.isHost ? "host" : ""}</p>
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
  { id: "3", name: "youssef", isHost: false,ready: false, avatarUrl: img },
]);

const emptySlots = maxPlayers - players.length;

  const host = players.find((player) => player.isHost);
  const slots: (Player | null)[] = [
  ...players,
  ...Array.from({ length: emptySlots }, () => null),
];

  return (
    <main className="p-6">
      <div className="flex flex-1 justify-between">
      <div className="flex flex-col w-2/3">
      <h1 className="text-xl"> {host?.name}'s lobby </h1>

      <div className="flex justify-between">
        <div className="flex border justify-between p-6 m-5">
          <div >
          <p> lobby's code</p>
          <h1> 6kg57fx</h1>
          </div>
          <button type="button" className="flex p-5 border"> copy</button>
        </div>
        <div>
          <p className="flex ">{players.length} / {maxPlayers} players</p>
          <p>3 players minimum required to start the game</p>
        </div>
      </div>
      

      <div className="grid grid-cols-4 gap-4">
  {slots.map((slot, i) => (
    <Slot key={i} player={slot} />
  ))}
</div>
      </div>
      <div className=" flex flex-col border w-1/3">
        <h1 className="flex border"> chat will go here </h1>
        <form>
          <input placeholder="chat here" ></input>
          <button> send</button>
        </form>
      </div>
    </div>     
      <div className="mt-4 flex gap-2">
        <button type="button" className="border p-2" onClick={() => navigate("/rooms")}>
          Leave
        </button>
        <button type="button" className="border p-2" onClick={() => navigate("/game/1")}>
          Start game
        </button>
      </div>
    </main>
  );
}