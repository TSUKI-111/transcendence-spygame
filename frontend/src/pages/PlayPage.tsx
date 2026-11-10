import { useState } from "react";


export default function RoomsPage() {

  let max = 8;
  const [players, setPlayers] = useState("0");
  return (
    <main className="flex flex-col flex-1 p-8 gap-4">

      <h1 className="flex justify-center text-3xl font-bold">Create or Join a room</h1>

      <div className="flex flex-1 items-center gap-36 p-16 m-16 justify-center h-full">
        <form className="flex flex-col p-2 border ">
            <h1 className="text-xl flex justify-center">create room</h1>
            <h2 className="flex justify-center text-sm"> share the code with your friends</h2>

            <div className="flex m-2">
              <input type="text" className=" flex m-2 border"></input>
              <select value={players} onChange={(e) => setPlayers(e.target.value)} className="flex m-2 border">
              {Array.from({ length : max}, (_,i) =>(
                <option className="bg-slate-800" key={i + 1} value={i + 1} >
                {i + 1}
                </option>
              ))}

              </select>

            </div>
            <button type="submit" className="flex border border-slate-800 justify-center"> click here </button>
        </form>
        <form className="flex flex-col p-2 border ">
          <h1 className="text-xl flex justify-center">Join room</h1>
          <h2 className="flex justify-center text-sm"> enter the code to join a room</h2>
          <input type="text" className="border m-2"></input>
          <button className="flex m-2 border border-slate-800"> Join room</button>
        </form>
      </div>

    </main>
  );
}