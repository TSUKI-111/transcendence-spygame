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
];

const me = players.find((player) => player.id === currentuser);

export default function VoteScreen() {
  type clue = { playerId: number; text: string };
  const clues: clue[] = [
    { playerId: 1, text: "vague" },
    { playerId: 2, text: "bleu" },
    { playerId: 3, text: "transe" },
    { playerId: 4, text: "rhino" },
    { playerId: 5, text: "table" },
  ];

const [selectedId, setSelectedId] = useState<number | null>(1);
  function HandleSelect(id: number){
    setSelectedId(id);
    console.log("click is working id is ",  id );
    

  }
  const total = 60;
  const [time, setTime] = useState(60);

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
    <div className="flex">
      <div className="w-2/3">
        <div id="timer" className=" flex flex-col justify-center ">
          <div className="flex justify-center">
            <img src={ava} />
            <p> Discussion - {time} s</p>
          </div>
          <p className="text-5xl font-mono text-center">{display}</p>
          <div className="h-2 w-full rounded-full bg-slate-700">
            <div
              className="h-2 rounded-full bg-violet-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <h1 className=" justify-center flex text-3xl mt-6">Who do you suspect ? </h1>
          <p className="justify-center flex mb-6"> choose who you think is the spy</p>
          <div className="flex flex-wrap gap-4" id="player-cards">
            {players.map((player) => (
              <button type="button" onClick={() => (HandleSelect(player.id))}
                key={player.id}
                className={
                    "flex w-28 flex-col items-center gap-3 rounded-xl bg-slate-800 p-3" +( player.id === selectedId ? " ring-2 ring-violet-500" : "" )
                }
              >
                <p className="text-sm">{player.name}</p>
                <img
                  src={player.avatarurl}
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-violet-500"
                />
                <p className="w-full truncate rounded-md bg-slate-900 px-2 py-1 text-center text-sm">
                  {clues.find((clue) => clue.playerId === player.id)?.text}
                </p>
              </button>
            ))}
          </div>
          <button type="button" className="p-2 mt-6 mr-4 border rounded-xl bg-violet-500">Submit choice </button> 
        </div>
      </div>
      <div className="w-1/3 h-screen border">
        <h1 className="w-full">chat goes here</h1>
      </div>
    </div>
  );
}
