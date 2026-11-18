import { useState } from "react";
import img from "../../assets/spy.png";
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
    <div>
      <div className="flex border justify-between shadow-xl p-6 m-6">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col justify-between w-1/2 p-6 m-6"
        >
          <h1 className="justify-between">submit your clue</h1>
          <p className="justify-between ">
            give a word that relates to the secret word
          </p>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="border justify-between p-6 m-6"
          />
          <button type="submit" className="border justify-between p-6 m-6">
            Send Clue
          </button>
        </form>
        <div className="border w-1/2">
          <div className="flex justify-between">
            <h1>clues received :</h1>
            <h1 className="text-xl">
              {clues.length} / {players.length}
            </h1>
          </div>
          <div id="player list">
            {
              <div className="flex items-center gap-3 rounded-lg border border-violet-500 p-3 m-2">
                <img
                  src={p1.avatarurl}
                  className="h-10 w-10 rounded-full object-cover bg-slate-400"
                />
                <div className="flex-1">
                  <p>{p1.name}</p>
                  <p className="text-xs text-violet-400">your clue</p>
                </div>
                <p className="w-28 truncate rounded-md bg-slate-600 px-3 py-1 text-center">
                  {myClue ?? "waiting..."}
                </p>
              </div>
            }
            {players.map(
              (player) =>
                player !== me && (
                  <div className="flex items-center gap-3 rounded-lg border-b border-violet-500 p-3 m-2">
                    <img
                      src={player.avatarurl}
                      className="h-10 w-10 rounded-full object-cover bg-slate-400"
                    />
                    <div className="flex-1">
                      <p>{player.name}</p>
                      <p className="text-xs text-violet-400">waiting...</p>
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
