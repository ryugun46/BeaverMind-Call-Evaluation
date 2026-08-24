import React from "react";
import { EvidenceItem } from "@/lib/types/evaluation";
import { Quote, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface EvidenceListProps {
  evidence: EvidenceItem[];
  className?: string;
}

export function EvidenceList({ evidence, className }: EvidenceListProps) {
  const hasEvidence = evidence && evidence.length > 0;

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-zinc-500">
        <Quote className="w-3.5 h-3.5 text-zinc-400" />
        <span>Transcript Evidence {hasEvidence ? `(${evidence.length})` : ""}</span>
      </div>

      {!hasEvidence ? (
        <div className="p-3.5 rounded-xl bg-zinc-50 border border-dashed border-zinc-200 text-xs text-zinc-500 flex items-start gap-2 italic">
          <AlertCircle className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5 not-italic" />
          <span>Required behavior was not present in the transcript.</span>
        </div>
      ) : (
        <div className="space-y-2.5">
          {evidence.map((item, idx) => {
            const isRepOrCoach =
              item.speaker.toLowerCase().includes("rep") ||
              item.speaker.toLowerCase().includes("coach") ||
              item.speaker.toLowerCase().includes("sarah") ||
              item.speaker.toLowerCase().includes("marcus");

            return (
              <div
                key={idx}
                className="bg-zinc-50/90 border border-zinc-200/90 rounded-xl p-4 text-xs transition-colors space-y-2"
              >
                {/* Speaker Attribution Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-mono text-[11px] font-bold px-2 py-0.5 rounded-md",
                        isRepOrCoach
                          ? "bg-blue-100/80 text-blue-900 border border-blue-200"
                          : "bg-emerald-100/80 text-emerald-900 border border-emerald-200"
                      )}
                    >
                      {item.speaker}
                    </span>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 font-medium">
                      {item.timestamp
                        ? `Verbatim Quote · ${item.timestamp}`
                        : item.turnIndex !== undefined
                          ? `Verbatim Quote · Turn ${item.turnIndex + 1}`
                          : "Verbatim Quote"}
                    </span>
                  </div>
                  <Quote className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                </div>

                {/* Verbatim Quote Body with Strong Callout Styling */}
                <blockquote className="pl-3 border-l-2 border-zinc-400 text-zinc-900 font-mono text-xs sm:text-[12.5px] leading-relaxed italic bg-white/60 p-2.5 rounded-r-lg">
                  {'"'}{item.quote}{'"'}
                </blockquote>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
