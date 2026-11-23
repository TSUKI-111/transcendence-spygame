import { NavLink } from "react-router-dom";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SubmitEvent } from "react";
import regimg from "../assets/register-agent.png";
import userimg from "../assets/icons/user.png";
import mailimg from "../assets/icons/email.png";
import passimg from "../assets/icons/password.png";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [displayname, setDisplayname] = useState("");
  const [email, setMail] = useState("");
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  async function Handlesubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    console.log(username);
    console.log(email);

    if (pass1 !== pass2) {
      setError("nomatch");
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-type": "application/json " },
        credentials: "same-origin",
        body: JSON.stringify({ username,displayName: displayname, email, password: pass1 }),
      });

      if (response.status === 201) {
        navigate("/login");
        return;
      }

      const data = await response.json();
      if (response.status === 409) {
        setError("Username or email already used");
      } else {
        setError(
          Array.isArray(data.message) ? data.message.join(", ") : data.message,
        );
      }
    } catch {
      setError("Could not reach the server"); 
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      {/* left saide panel  */}
      <div
        className="flex flex-col justify-between w-1/2 bg-slate-950 bg-cover bg-contain text-white bg-no-repeat"
        style={{ backgroundImage: `url(${regimg})` }}
      >
        <h1 className="text-4xl">
          SPY <span className="text-violet-500"> GAME </span>{" "}
        </h1>
        <div className="relative max-w-xl flex flex-col mb-16">
          <h1 className="text-6xl font-extrabold leading-tight mt-20 mb-8">
            JOIN <br />
            <span className="text-lime-400">THE AGENCY</span>
          </h1>
          <p className="text-purple-200"> Strangers today. </p>
          <p className="text-purple-200">May become allies tomorrow.</p>
        </div>
      </div>
      {/* register page */}
      <div className="flex flex-1 flex-col items-center justify-center ">
        <div className="flex flex-col border border-slate-700 shadow-lg p-10 rounded-xl">
          <h1 className="flex text-4xl font-extrabold leading-tight mt-6">
            Create an account
          </h1>
          <h1 className="text-gray-400">Join the agency to show your skills</h1>
          <form
            onSubmit={(e) => Handlesubmit(e)}
            className="flex flex-col leading-normal m-2 justify-center rounded-full"
          >
            <div className="flex bg-slate-900 border mb-3 w-full rounded border-slate-700 p-2">
              <img src={userimg} className="flex w-6 h-6 items-center mr-2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="w-full"
              ></input>
            </div>
            <div className="flex bg-slate-900 border mb-3 w-full rounded border-slate-700 p-2">
              <img src={userimg} className="flex w-6 h-6 items-center mr-2" />
              <input
                type="text"
                value={displayname}
                onChange={(e) => setDisplayname(e.target.value)}
                placeholder="displayname"
                className="w-full"
              ></input>
            </div>
            <div className="flex bg-slate-900 border mb-3 w-full rounded border-slate-700 p-2">
              <img src={mailimg} className="flex w-6 h-6 items-center mr-2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setMail(e.target.value)}
                placeholder="email address"
                className="w-full"
              ></input>
            </div>
            <div className="flex bg-slate-900 border mb-3 w-full rounded border-slate-700 p-2">
              <img src={passimg} className="flex w-6 h-6 items-center mr-2" />
              <input
                type="password"
                value={pass1}
                onChange={(e) => setPass1(e.target.value)}
                placeholder="password"
                className={"w-full " + (error ? "border-red-500" : "")}
              ></input>
            </div>
            <div className="flex bg-slate-900 border mb-3 w-full rounded border-slate-700 p-2">
              <img src={passimg} className="flex w-6 h-6 items-center mr-2" />
              <input
                type="password"
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                placeholder="confirm password"
                className={"w-full " + (error ? "border-red-500" : "")}
              ></input>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              className="border font-semibold border-slate-900 rounded-xl w-full mt-2 h-10 p-6 flex justify-center items-center shadow-lg bg-violet-500"
            >
              CREATE ACCOUNT
            </button>
            <div className="mt-7 h-0.5 w-full bg-slate-600" />
            <div className="flex flex-row p-1 m-6">
              <p>Already registered?</p>
              <NavLink className="ml-3 text-violet-500" to="/login">
                {" "}
                login here !
              </NavLink>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
