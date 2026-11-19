import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import img from "../assets/detectives-victory.png";
// import img from "../assets/spy_side_panel_2.png"

export default function HomePage() {
  const navigate = useNavigate();
  return (
    <div
      className="flex flex-col min-h-screen bg-slate-950 text-white bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${img})` }}
    >
      <div className="flex justify-between">
        <h1 className="text-4xl">
          
          SPY <span className="text-violet-500"> GAME </span>{" "}
        </h1>
        <div>
          <button
            id="login"
            className="mr-3 border rounded-xl w-30 mt-2 h-10"
            onClick={() => navigate("/login")}
            type="button"
          >
          
            login
          </button>
          <button
            id="register"
            className="ml-3 border rounded-xl w-30 mt-2 h-10 shadow-lg bg-violet-500"
            onClick={() => navigate("/register")}
            type="button"
          >
            
            register
          </button>
        </div>
      </div>
      <div className="relative max-w-xl">
        <h1 className="text-6xl font-extrabold leading-tight mt-20 mb-8">
          EVERY WORD <br /> CAN MAKE YOU <br />
          <span className="text-lime-400">THE SUSPECT</span>
        </h1>
        <p>A social deduction game where a spy hides amongst you</p>
        <p className="text-purple-400">
          3 to 8 players | 1 spy | fast and intense games
        </p>
      </div>
      <div className="grid grid-cols-3 m-2 p-3 mt-6 justify-between flex-1 items-end mb-20">
        <div className=" p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 ">
          <h1 className=" flex font-extrabold justify-center"> Clues </h1>
          <p className="flex justify-center "> find the secret word</p>
        </div>
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 ">
          <h1 className="flex font-extrabold justify-center"> Discussion </h1>
          <p className="flex justify-center "> Analyse other players </p>
        </div>
        <div className=" p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
          <h1 className="flex font-extrabold justify-center "> Vote </h1>
          <p className="flex justify-center "> find the spy before he wins </p>
        </div>
      </div>
    </div>
  );
}
