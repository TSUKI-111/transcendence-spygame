import ava from "../../assets/vite.svg";
import { useState } from "react";
import { useEffect } from "react";

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
  { id: 4, name: "emily", detective: false, avatarurl: ava },
  { id: 5, name: "elton", detective: false, avatarurl: ava },
  { id: 6, name: "mark", detective: false, avatarurl: ava },
];

const me = players.find((player) => player.id === currentuser);

export default function DiscussionScreen() {
  type clue = { playerId: number; text: string };
  const clues: clue[] = [
    { playerId: 1, text: "vague" },
    { playerId: 2, text: "bleu" },
    { playerId: 3, text: "transe" },
    { playerId: 4, text: "rhino" },
    { playerId: 5, text: "table" },
    { playerId: 6, text: "spark" },
  ];

  const total = 120;
   const [time, setTime] = useState(total);
 
   useEffect(() => {
     if (time <= 0) return;
 
     const timerId = setInterval(() => {
       setTime((prevTime) => prevTime - 1);
     }, 1000);
 
     return () => clearInterval(timerId);
   }, [time]);
 

  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const percent = (time / total) * 100;
return (
  <div className="flex flex-col gap-6 p-6 text-white xl:flex-row">
    <div className="flex flex-1 flex-col gap-6">
      <div
        id="timer"
        className="flex flex-col items-center gap-3 rounded-2xl border border-violet-500/50 bg-linear-to-b from-indigo-950 to-slate-900 p-6"
      >
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <img src={ava} className="h-6 w-6" />
          <p>Discussion - {total} s</p>
        </div>
        <p className="text-center font-mono text-5xl font-bold">{display}</p>
        <div className="h-2 w-full max-w-md rounded-full bg-slate-700">
          <div
            className="h-2 rounded-full bg-violet-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <h1 className="font-bold">This Round's Clues</h1>
      <div className="flex flex-wrap justify-center gap-4" id="player-cards">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex w-28 flex-col items-center gap-3 rounded-xl bg-slate-800 p-3"
          >
            <p className="text-sm">{player.name}</p>
            <img
              src={player.avatarurl}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-violet-500"
            />
            <p className="w-full truncate rounded-md bg-slate-900 px-2 py-1 text-center text-sm">
              {clues.find((clue) => clue.playerId === player.id)?.text}
            </p>
          </div>
        ))}
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
);
}
