import { useState } from "react";
import RoleScreen from "../components/game/RoleScreen";
import ClueScreen from "../components/game/ClueScreen"
import VoteScreen from "../components/game/VoteScreen"
import DiscussionScreen from "../components/game/DiscussionScreen"

import ava from "../assets/vite.svg";


export type Phase = "role" | "clue" | "discussion" | "vote" | "result";
const phases: Phase[] = ["role", "clue", "discussion", "vote", "result"];
const p1 = { id: 1, name: "jhon", detective: true, avatarurl: ava };

export default function GamePage() {
  const [phase, setPhase] = useState<Phase>("role");
  const steps = ["Role", "Clues", "Discussion", "Vote", "Result"];
  const currentStep = phases.indexOf(phase);

  return (
    <main className="p-6">
      <div className="flex gap-2 mb-4">
        {phases.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPhase(p)}
            className={phase === p ? "border p-2 bg-violet-600" : "border p-2"}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex justify-between" id="game header">
        <div className="flex items-center gap-6">
          <h1>
            lobby <span className="font-mono"> F8X334H </span>
          </h1>
          <p>round 1 / 5</p>
        </div>
        <div className="flex flex-1 max-w-xl mx-4">
          {steps.map((step, i) => (
            <div key={step} className="flex-1 last:flex-none">
              <div className="flex items-center">
                <div
                  className={`h-4 w-4 rounded-full ${i <= currentStep ? "bg-violet-500" : "bg-slate-600"}`}
                />
                {i < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 ${i < currentStep ? "bg-violet-500" : "bg-slate-600"}`}
                  />
                )}
              </div>
              <p
                className={`text-sm mt-2 ${i === currentStep ? "text-violet-400" : "text-slate-500"}`}
              >
                {step}
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <img
            src={p1.avatarurl}
            className="h-8 w-8 rounded-full object-cover"
          />
          <span>{p1.name}</span>
        </div>
      </div>

      {phase === "role" && <RoleScreen />}
      {phase === "clue" &&  <ClueScreen />}
      {phase === "discussion" && <DiscussionScreen />}
      {phase === "vote" && <VoteScreen />}
      {phase === "result" && <p>Result screen</p>}
    </main>
  );
}
