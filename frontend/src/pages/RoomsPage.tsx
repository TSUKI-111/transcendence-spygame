import img from "../assets/vite.svg"

export default async function RoomsPage() {

  try{

    const response = await fetch("http://localhost:3000/rooms");
    if(!response.ok)
      throw new Error("error fetching") 
    
    const mockRooms = await response.json();
   return (
    <main>
      <div id="rooms">

        <div id="count-search"> 

        </div>
          <div id="rooms-list" className="flex-col flex-1 gap-2 border space-between"> {mockRooms.map((Room) => (
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
                <button type="button" className="flex  border"> Join Room</button>
              </div>

            </div>
          ))} 
            
          </div>
        </div>
  

    </main>
  );
    
    }
    
  catch{
    console.error("could not fetch");
  }
 
}