import React from "react";
import { OneThing } from "@/lib/types/evaluation";
import { ArrowRight, Sparkles, Target } from "lucide-react";

interface OneThingCardProps {
  oneThing: OneThing;
}

export function OneThingCard({ oneThing }: OneThingCardProps) {
  const delta = oneThing.potentialScore - oneThing.currentScore;

  return (
    <section className="bg-gradient-to-br from-indigo-900 via-zinc-900 to-zinc-950 text-white rounded-2xl p-6 sm:p-7 shadow-md border border-zinc-800">
      {/* Top Bar: Title & Simple Score Transition */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-indigo-300 block">
              Highest-Impact Opportunity
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">
              The One Thing
            </h2>
          </div>
        </div>

        {/* Simple visual treatment: 72 → 81 (+9 pts) */}
        <div className="inline-flex items-center gap-2 self-start sm:self-auto bg-zinc-800/90 border border-zinc-700/80 px-3.5 py-1.5 rounded-xl font-mono text-xs shadow-inner">
          <span className="text-zinc-400">Score Impact:</span>
          <span className="text-zinc-200 font-semibold">{oneThing.currentScore}</span>
          <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="text-emerald-400 font-bold">{oneThing.potentialScore}</span>
          <span className="text-[11px] font-medium text-emerald-300 bg-emerald-950/80 border border-emerald-800/60 px-1.5 py-0.2 rounded ml-1">
            +{delta > 0 ? delta : 0} pts
          </span>
        </div>
      </div>

      {/* Body: Title & Concise Explanation */}
      <div className="pt-4 space-y-2">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Target className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{oneThing.title}</span>
        </h3>
        <p className="text-sm text-zinc-300 leading-relaxed font-normal">
          {oneThing.explanation}
        </p>
      </div>
    </section>
  );
}
