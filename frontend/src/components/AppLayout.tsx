import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/", label: "Home" },
  { to: "/rooms", label: "Play" },
];

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <aside className="flex w-56 flex-col border-r border-slate-800 bg-slate-800 p-4">
        <div className="mb-8 text-lg font-bold tracking-widest">TRANSCENDENCE</div>
        <nav className="flex flex-1 flex-col gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end
              className={({ isActive }) =>
                "rounded-lg px-3 py-2 " +
                (isActive ? "bg-blue-600" : "text-slate-300 hover:bg-slate-800")
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <button className="rounded-lg px-3 py-2 text-left text-slate-300 hover:bg-slate-800">
          Logout
        </button>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}