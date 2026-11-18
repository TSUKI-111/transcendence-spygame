import img from "../../assets/spy.png";
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
];

export default function RoleScreen() {
  const me = players.find((player) => player.id === currentuser);
  const half = Math.ceil(players.length / 2);
  const leftPlayers = players.slice(0, half);
  const rightPlayers = players.slice(half);

  const secretWord = "OCEAN";

  return (
    <div>
      <div className="flex justify-between">
        <div className="grid grid-cols-1">
          {leftPlayers.map((player) => (
            <div key={player.id}>
              <img
                src={player.avatarurl}
                className="h-16 w-16 rounded-full object-cover bg-slate-400"
              />
              <p>{player.name}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center justify-center border p-6 w-1/3">
          {me?.detective ? (
            <>
              <p>You are a</p>
              <h2 className="text-3xl">Detective</h2>
              <p>The secret word is</p>
              <p className="text-4xl">{secretWord}</p>
            </>
          ) : (
            <>
              <img src={img} className="w-1/2" />
              <p>You are the</p>
              <h2 className="text-3xl">Spy</h2>
              <p>Listen, observe, stay unnoticed.</p>
            </>
          )}
        </div>
        <div className="grid grid-cols-1">
          {rightPlayers.map((player) => (
            <div key={player.id}>
              <img
                src={player.avatarurl}
                className="h-16 w-16 rounded-full object-cover bg-slate-400"
              />
              <p>{player.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
