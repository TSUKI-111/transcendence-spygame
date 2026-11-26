import { useState } from "react";
import type { SubmitEvent } from "react";
import { useNavigate } from "react-router-dom";
import img from "../assets/headquart.webp";
import friendsimg from "../assets/icons/friends.png";

export default function RoomsPage() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("");
  const [players, setPlayers] = useState(6);
  const [code, setCode] = useState("");
  const [isprivate, setIsprivate] = useState(false);

  const handlecheck = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checkedValue = e.target.checked;

    setIsprivate(checkedValue);


  };

  async function handleCreate(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    try{
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: roomName,
          maxPlayers: players,
          is_private: isprivate,
        })
      })
      if(!res.ok) throw new Error("error fetching");
      const room = await res.json();
      navigate(`/lobby/${room.room.id}`, {
  state: { inviteCode: room.inviteCode }
});
    }
    catch{
      console.log("error hee later");
    }
    console.log({ roomName, players });
  }

  function handleJoin(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (code.trim() === "") return;
    navigate(`/lobby/${code.trim()}`);
  }

  let max = 8;
  return (
    <main
      className="min-h-screen flex flex-col bg-cover bg-center bg-no-repeat text-white "
      style={{ backgroundImage: `url(${img})` }}
    >
      <h1 className="flex justify-start ml-6 mt-4 text-3xl font-extrabold ">
        Create or Join a room
      </h1>
      <p className="flex justify-start ml-6 ">
        gather your teammates.Only one of you will be a spy
      </p>
      <div className="flex flex-1 items-center justify-center px-8 py-8">
        <div className="flex w-full max-w-5xl flex-col items-center gap-8 xl:flex-row xl:items-stretch">
          <form
            onSubmit={handleCreate}
            className="flex w-[36%] flex-col gap-4 rounded-2xl border border-violet-500/50 bg-radial from-indigo-950 to-slate-900/90 p-8"
          >
            <div className="flex items-center gap-4">
              <img className="h-14 w-14" src={friendsimg} />
              <div className="flex flex-col">
                <h1 className="flex text-xl font-bold">create room</h1>
                <h2 className="flex text-sm text-slate-300">
                  {" "}
                  share the code with your friends
                </h2>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex flex-1 flex-col gap-1 min-w-0">
                <label className="text-sm text-slate-300">Room Name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3"
                ></input>
              </div>
              <select
                value={players}
                onChange={(e) => setPlayers(Number(e.target.value))}
                className="h-11 self-end rounded-lg border border-slate-700 bg-slate-900 px-3"
              >
                {Array.from({ length: max }, (_, i) => (
                  <option className="bg-slate-800" key={i + 1} value={i + 1}>
                    {i + 1} players
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-row">
            <p className="text-sm text-slate-300">Between 3 and 8 players </p>
              <label>private ?
              <input type="checkbox" checked={isprivate} onChange={handlecheck}></input>
              </label>
              </div>
            <button
              type="submit"
              className="flex h-12 items-center justify-center rounded-xl bg-violet-500 font-semibold"
            >
              click here
            </button>
          </form>
          <form
            onSubmit={handleJoin}
            className="flex w-[32%] flex-col gap-4 rounded-2xl border border-lime-400/60 bg-radial from-[#294029] to-[#1e3026]/90 p-8"
          >
            <h1 className="flex justify-center text-xl font-bold">Join room</h1>
            <h2 className="flex justify-center text-sm text-slate-300">
              enter the code to join a room
            </h2>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-11 rounded-lg border border-slate-600 bg-slate-800 px-3"
            ></input>
            <button
              type="submit"
              className="flex h-12 items-center justify-center rounded-xl bg-lime-300 font-semibold text-slate-900"
            >
              Join room
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
