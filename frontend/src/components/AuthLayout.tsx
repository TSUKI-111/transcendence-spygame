import { Outlet } from "react-router-dom";

import img from "../assets/spy.png"

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-slate-800">
      <img src={img} className="w-1/2"/>
      <div className="flex flex-1 items-center justify-center text-white border border-slate-900 shadow-lg">
        <div className="flex border border-slate-700 leading-relaxed text-justify font-semibold text-xl p-12 shadow-lg rounded-md p-12 m-12">
          <Outlet />
        </div>
      </div>
    </div>
  );
}