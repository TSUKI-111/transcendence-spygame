import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-800 p-6 text-white">
      <div className="w-full max-w-md rounded-xl shadow-lg border border-slate-800 bg-slate-900 p-8">
        <Outlet />
      </div>
    </div>
  );
}