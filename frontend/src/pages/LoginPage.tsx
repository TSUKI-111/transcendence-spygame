import { useState } from "react";
import { NavLink } from "react-router-dom";
import type { SubmitEvent } from "react";
import { useNavigate } from "react-router-dom";
import loginimg from "../assets/login-agent.png";
import mailimg from "../assets/icons/email.png"
import passimg from "../assets/icons/password.png"

export default function LoginPage() {
  const [mail, setMail] = useState("");
  const [password, setPass] = useState("");

  const navigate = useNavigate();
  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    navigate("/play");

    console.log("submitted");
    setMail("");
    setPass("");
  }
  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      {/* left saide panel  */}
      <div
        className="flex flex-col justify-between w-1/2 bg-slate-950 bg-cover bg-contain text-white bg-no-repeat"
        style={{ backgroundImage: `url(${loginimg})` }}
      >
        <h1 className="text-4xl">
          SPY <span className="text-violet-500"> GAME </span>{" "}
        </h1>
        <div className="relative max-w-xl flex flex-col mb-16">
          <h1 className="text-6xl font-extrabold leading-tight mt-20 mb-8">
            OBSERVE
            <br /> DISCUSS <br />
            <span className="text-lime-400">UNMASK</span>
          </h1>
          <p>A social deduction game where a spy hides amongst you</p>
          <p className="text-purple-400">
            3 to 8 players | 1 spy | fast and intense games
          </p>
        </div>
      </div>

      
      {/* right side page */}
      <div className="flex flex-1 flex-col items-center justify-center ">
        <div className="flex flex-col border border-slate-700 shadow-lg p-10 rounded-xl">
          <h1 className="flex text-4xl font-extrabold leading-tight mt-6 justify-">
            Welcome back!{" "}
          </h1>
          <h1 className="text-gray-400">
            Reconnect to continue the investigation.
          </h1>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col leading-normal m-2 justify-center rounded-full"
          >
            <div className="flex bg-slate-900 border mb-3 w-full rounded border-slate-700 p-2">
              <img src={mailimg} className=" flex w-6 h-6 items-center mr-2"/>
              <input placeholder="Email"
                value={mail}
                onChange={(e) => {
                  setMail(e.target.value);
                }}
                className="w-full"
              ></input>
            </div>
            <div className="flex bg-slate-900 border mb-3 w-full rounded border-slate-700 p-2">
              <img src={passimg} className=" flex w-6 h-6 mr-2 items-center"/>
              <input placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPass(e.target.value);
                }}
                className="w-full"
              ></input>
            </div>
            <button
              type="submit"
              className="border font-semibold border-slate-900 rounded-xl w-full mt-2 h-10 p-6 flex justify-center items-center shadow-lg bg-violet-500"
            >
              LOGIN
            </button>
            <div className="mt-7 h-0.5 w-full bg-slate-600" />
            <div className="flex flex-row p-1 m-6">
              <p>Not registered yet ? </p>
              <NavLink className="ml-3 text-violet-500" to="/register"> register here !</NavLink>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
