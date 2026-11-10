import { useState }from "react"
import { NavLink } from "react-router-dom";
export default function LoginPage() {

  const [mail, setMail] = useState("");
  const [password, setPass] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    console.log("submitted");
    setMail("");
    setPass("");
    
  }
  return (

    <main>
      <h1 className="flex justify-center"> login </h1>
    <form onSubmit={handleSubmit} className="flex flex-col leading-normal m-2 justify-center rounded-full">
      <label >mail</label>
      <input value={mail} onChange={(e)=> {setMail(e.target.value)}} className="bg-gray-500"></input>

      <label >password</label>
      <input type="password" value={password} onChange={(e)=> {setPass(e.target.value)}} className="bg-gray-500"></input>

      <button type="submit">submit</button>
      <div className="flex flex-row p-1 m-6">
      <p>not registered yet ? </p>
      <NavLink to="/register">  register here !</NavLink>
      </ div>
    </form>
    </main>
  );
}