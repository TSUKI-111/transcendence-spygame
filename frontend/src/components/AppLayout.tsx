import { NavLink, Outlet } from "react-router-dom";
import homeimg from "../assets/icons/home.png";
import roomsimg from "../assets/icons/rooms.png";
import playimg from "../assets/icons/crown.png";

const links = [
  { to: "/", label: "Home", img: homeimg },
  { to: "/play", label: "Play", img: roomsimg },
  { to: "/rooms", label: "Rooms", img: playimg },
];

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <aside className="flex w-56 flex-col border-r border-slate-900 bg-slate-950 p-4">
        <h1 className="text-4xl">
          SPY <span className="text-violet-500"> GAME </span>{" "}
        </h1>
        <nav className="flex flex-1 flex-col gap-1 mt-10">
          {links.map((link) => (
            <div className=" flex flex-row items-center">
              <img src={link.img} className="h-6 w-6"/>
              <NavLink
                key={link.to}
                to={link.to}
                end
                className={({ isActive }) =>
                  "rounded-lg px-3 py-2 my-1 w-full ml-1 " +
                  (isActive
                    ? "bg-blue-600"
                    : "text-slate-300 hover:bg-slate-800")
                }
              >
                {link.label}
              </NavLink>
            </div>
          ))}
        </nav>
        <button className="rounded-lg px-3 py-2 text-left text-slate-300 hover:bg-slate-800">
          Logout
        </button>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
