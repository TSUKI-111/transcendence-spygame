import { useEffect, useState } from "react";
import img from "../assets/vite.svg"
import { useNavigate } from "react-router-dom";

type Room = {
  id: string;
  name: string;
  host: string;
  players: number;
  maxPlayers: number;
};

export default  function RoomsPage() {

    const [mockRooms, setRooms] = useState<Room[]>([
  { id: "1", name: "Test room", host: "aimane", players: 2, maxPlayers: 6 },
]);
    const [state, setState] = useState<"loading" | "error" | "ready">("loading");

    const navigate = useNavigate();
    useEffect(() => {
      async function fetchData(){

        try{
        const response = await fetch("http://localhost:3000/rooms");
      if(!response.ok)
        throw new Error("error fetching") 
    
      const data = await response.json();
      setRooms(data);
      setState("ready");
      }
      catch{
        setState("error");
      }
      }

      fetchData();
    }, []);

    // if (state === "loading") return <p>Loading...</p>;
    // if (state === "error") return <p>Could not load rooms.</p>;
    // if (mockRooms.length === 0) return <p>No rooms yet.</p>;
   return (
    <main>
      <div id="rooms">

        <div id="count-search"> 

        </div>
          <div id="rooms-list" className="flex-col flex-1 gap-2 border space-between"> {mockRooms.map((Room: any) => (
            <div id="room" className="border flex gap-16 m-3" >
              <img src={img} className="flex border" />
              <div className="flex justify-start border flex-col p-3 m-3"> 
                <h2>{Room.name}</h2>
                <p>{Room.host}</p>
              </div>
              <div className="flex gap-16 justify-end ">
                <div className="flex  border justify-center items-center"> 
                  <p> {Room.players} / {Room.maxPlayers}</p>
                  <img /> 
                  <p>{ Room.maxPlayers - Room.players} places left </p>
                </div>
                <button type="button" className="flex  border" onClick={() => navigate(`/lobby/${Room.id}`)}> Join Room</button>
              </div>

            </div>
          ))} 
            
          </div>
        </div>
  

    </main>
  );
    
    }