import React from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { RedFlagItem } from "@/lib/types/evaluation";

interface RedFlagsCardProps {
  redFlags?: RedFlagItem[] | null;
}

export function RedFlagsCard({ redFlags }: RedFlagsCardProps) {
  const hasFlags = redFlags && redFlags.length > 0;

  if (!hasFlags) {
    return (
      <section className="bg-white rounded-2xl border border-zinc-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2 border-b border-zinc-100 pb-3 mb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500">
            Red Flags
          </h2>
        </div>

        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100/80 text-xs sm:text-sm text-emerald-950">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span className="font-normal leading-relaxed text-emerald-900">
            No material client-relationship red flags were identified from the transcript.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-amber-200/90 p-5 sm:p-6 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-amber-100 pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-700">
            Red Flags ({redFlags.length})
          </h2>
        </div>
        <span className="text-[11px] font-mono font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          Client-Relationship Risk
        </span>
      </div>

      <ul className="space-y-2.5 pt-1">
        {redFlags.map((flag, idx) => (
          <li
            key={idx}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50/40 border border-amber-200/70 text-xs sm:text-sm text-zinc-800 leading-relaxed"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
            <span className="font-normal">
              <strong className="font-semibold text-zinc-900">{flag.title}</strong>
              {flag.explanation && (
                <span className="block mt-0.5 text-zinc-600">{flag.explanation}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
