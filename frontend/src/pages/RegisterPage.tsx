import { useState } from "react"
import { useNavigate } from "react-router-dom";



export default function RegisterPage() {

  const [username, setUsername] = useState("");
  const [email, setMail] = useState("");
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState("");

const navigate = useNavigate();

 async function Handlesubmit(e){
    e.preventDefault();
    console.log(username);
    console.log(email);

    if(pass1 !== pass2)
    {
      setError("nomatch");
      
    }

    setMail("");
    
    navigate("/")
    // try {

    //   const response = await fetch("http://localhost:3000/auth/login", {
        
    //     method: "POST",
    //     headers: { "Content-type": "application/json "},
    //     body: JSON.stringify({username, email, pass1, pass2}),
    //   });
      
    //   if(!response.ok)
    //     {
    //       throw new Error("failed to authenitcate")
    //     }
      
    //   }
    //   catch(error)
    //   {
    //     console.log(error)
    //   }
    
  }

  return (
    <main className="flex flex-col flex-1 justify-center items-center">
      <h1 className="flex flex-1 text-xl bold items-end">Create an account</h1>
      <h2 className="text-sm">Join the agency to show your skills</h2>
      <form onSubmit={(e) => Handlesubmit(e)} className="flex flex-col flex-1 justify-center items-center m-7 p-1 shadow-lg">
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" className="p-3 m-1 rounded-xl border border-slate-700"></input>
        <input type="email" value={email} onChange={(e) => setMail(e.target.value)} placeholder="email address" className="p-3 m-1 rounded-xl border border-slate-700"></input>
        <input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="confirm password" className={"p-3 m-1 rounded-xl border " + (error ? "border-red-500" : "border-slate-700")} ></input>
        <input type="password" value={pass1} onChange={(e) => setPass1(e.target.value)} placeholder="password" className={"p-3 m-1 rounded-xl border " + (error ? "border-red-500" : "border-slate-700")}></input>

        <button type="submit" className="flex justify-center"> Create an account ➡️ </button>
      </form>
    </main>
  )
}