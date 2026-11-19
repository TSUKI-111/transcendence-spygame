import img from "../../assets/spy-role.png"
import ava from "../../assets/vite.svg";

type player = {
  id: number;
  name: string;
  detective: boolean;
  avatarurl: string;
};

const currentuser = 3;

const players: player[] = [
  { id: 1, name: "jhon", detective: true, avatarurl: ava },
  { id: 2, name: "ellie", detective: true, avatarurl: ava },
  { id: 3, name: "rose", detective: false, avatarurl: ava },
  { id: 4, name: "glen", detective: false, avatarurl: ava },
];

export default function RoleScreen() {
  const me = players.find((player) => player.id === currentuser);
  const half = Math.ceil(players.length / 2);
  const leftPlayers = players.slice(0, half);
  const rightPlayers = players.slice(half);

  const secretWord = "OCEAN";

 return (
  <div className="flex items-center justify-between gap-6 p-6 text-white">
    <div className="flex flex-col gap-6">
      {leftPlayers.map((player) => (
        <div key={player.id} className="flex w-24 flex-col items-center gap-1">
          <img
            src={player.avatarurl}
            className={`h-16 w-16 rounded-full bg-slate-400 object-cover ring-2 ${player.id === currentuser ? "ring-lime-300" : "ring-violet-500"}`}
          />
          <p className="text-sm font-semibold">{player.name}</p>
          <p className="text-xs text-lime-300">{player.id === currentuser ? "you" : ""}</p>
        </div>
      ))}
    </div>

    <div
      className={`flex max-w-2xl flex-1 items-center justify-center gap-6 rounded-2xl border p-8 ${
        me?.detective
          ? "border-lime-400/60 bg-linear-to-b from-[#294029] to-[#1e3026]"
          : "border-violet-500/50 bg-linear-to-b from-indigo-950 to-slate-900"
      }`}
    >
      {me?.detective ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-slate-300">You are a</p>
          <h2 className="text-5xl font-extrabold text-lime-300">Detective</h2>
          <p className="text-sm text-slate-300">The secret word is</p>
          <p className="rounded-xl border border-lime-400/60 px-6 py-2 text-4xl font-bold">
            {secretWord}
          </p>
        </div>
      ) : (
        <>
          <img src={img} className="w-1/3" />
          <div className="flex flex-col gap-3">
            <p className="text-slate-300">You are the</p>
            <h2 className="text-5xl font-extrabold text-violet-400">Spy</h2>
            <p className="text-sm text-slate-300">Listen, observe, stay unnoticed.</p>
            <button type="button" className="h-12 rounded-xl bg-violet-500 font-semibold">
              I understand
            </button>
          </div>
        </>
      )}
    </div>

    <div className="flex flex-col gap-6">
      {rightPlayers.map((player) => (
        <div key={player.id} className="flex w-24 flex-col items-center gap-1">
          <img
            src={player.avatarurl}
            className={`h-16 w-16 rounded-full bg-slate-400 object-cover ring-2 ${player.id === currentuser ? "ring-lime-300" : "ring-violet-500"}`}
          />
          <p className="text-sm font-semibold">{player.name}</p>
          <p className="text-xs text-lime-300">{player.id === currentuser ? "you" : ""}</p>
        </div>
      ))}
    </div>
  </div>
);
}
