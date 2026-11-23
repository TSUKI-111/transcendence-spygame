import { useState } from "react";
import ava from "../../assets/vite.svg";
import type { SubmitEvent } from "react";

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
  { id: 3, name: "rose", detective: false, avatarurl: ava },
  { id: 3, name: "rose", detective: false, avatarurl: ava },
];

const me = players.find((player) => player.id === currentuser);

export default function ClueScreen() {
  type clue = { playerId: number; text: string };
  const [typed, setTyped] = useState("");
  const [clues, setClue] = useState<clue[]>([
    { playerId: 1, text: "vague" },
    { playerId: 2, text: "bleu" },
  ]);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!me) return;
    setClue((prevclues) => [...prevclues, { playerId: me?.id, text: typed }]);
    setTyped("");
  }
  const p1 = players.find((player) => player.id === currentuser);
  if (!p1) return <div> issue </div>;
  const myClue = clues.find((clue) => clue.playerId === p1.id)?.text;
return (
  <div className="p-6 text-white">
    <div className="flex flex-col gap-6 xl:flex-row">
      <form
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col gap-4 rounded-2xl border border-violet-500/50 bg-linear-to-b from-indigo-950 to-slate-900 p-8"
      >
        <h1 className="text-xl font-bold">submit your clue</h1>
        <p className="text-sm text-slate-300">
          give a word that relates to the secret word
        </p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="h-14 rounded-lg border border-slate-700 bg-slate-900 px-4 text-xl"
        />
        <button
          type="submit"
          className="h-12 rounded-xl bg-lime-300 font-semibold text-slate-900"
        >
          Send Clue
        </button>
        <p className="text-xs text-slate-400">
          Your clue is only visible to you for now.
        </p>
      </form>

      <div className="flex flex-1 flex-col gap-4 rounded-2xl border border-violet-500/50 bg-linear-to-b from-indigo-950 to-slate-900 p-8">
        <div className="flex items-center justify-between">
          <h1 className="font-bold">clues received :</h1>
          <h1 className="text-xl font-bold">
            {clues.length} / {players.length}
          </h1>
        </div>
        <div id="player-list" className="flex flex-col gap-2">
          <div className="flex items-center gap-3 rounded-lg border border-violet-500 bg-violet-500/20 p-3">
            <img
              src={p1.avatarurl}
              className="h-10 w-10 rounded-full object-cover bg-slate-400"
            />
            <div className="flex-1">
              <p>{p1.name}</p>
              <p className="text-xs text-violet-400">your clue</p>
            </div>
            <p className="w-28 truncate rounded-md bg-slate-900 px-3 py-1 text-center">
              {myClue ?? "waiting..."}
            </p>
          </div>
          {players.map(
            (player) =>
              player !== me && (
                <div
                  key={player.id}
                  className="flex items-center gap-3 rounded-lg bg-slate-900/60 p-3"
                >
                  <img
                    src={player.avatarurl}
                    className="h-10 w-10 rounded-full object-cover bg-slate-400"
                  />
                  <div className="flex-1">
                    <p>{player.name}</p>
                    <p className="text-xs text-slate-400">waiting...</p>
                  </div>
                </div>
              ),
          )}
        </div>
      </div>
    </div>
  </div>
);
}
