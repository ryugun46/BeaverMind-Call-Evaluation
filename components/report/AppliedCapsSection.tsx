import React from "react";
import { AppliedCap } from "@/lib/types/evaluation";
import { Scale, CheckCircle2, AlertCircle } from "lucide-react";

interface AppliedCapsSectionProps {
  appliedRules?: AppliedCap[] | null;
}

export function AppliedCapsSection({ appliedRules }: AppliedCapsSectionProps) {
  const hasCaps = appliedRules && appliedRules.length > 0;

  return (
    <section className="bg-white rounded-2xl border border-zinc-200/90 p-5 sm:p-6 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-zinc-500" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-600">
            Scoring Rules Applied
          </h2>
        </div>
        {hasCaps ? (
          <span className="text-[11px] font-mono font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            {appliedRules.length} {appliedRules.length === 1 ? "Rule Active" : "Rules Active"}
          </span>
        ) : (
          <span className="text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Standard Scoring
          </span>
        )}
      </div>

      {!hasCaps ? (
        <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-100 text-xs text-zinc-600 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>
            Standard rubric scoring applied. No guardrails, caps, or zero-floor overrides were triggered for this evaluation run.
          </span>
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {appliedRules.map((cap, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  {cap.label}
                </span>
                <span className="text-[11px] font-mono font-semibold text-zinc-800 bg-white px-2.5 py-0.5 rounded border border-zinc-200 self-start sm:self-auto shadow-2xs">
                  {cap.effect}
                </span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed font-normal">
                {cap.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
