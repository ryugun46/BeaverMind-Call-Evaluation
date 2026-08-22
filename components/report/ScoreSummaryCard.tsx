import React from "react";
import { EvaluationRun } from "@/lib/types/evaluation";
import { PerformanceBandBadge } from "@/components/ui/PerformanceBandBadge";
import { formatPerformanceBand } from "@/lib/utils/formatters";
import { User, Building2, Clock, FileText, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ScoreSummaryCardProps {
  evaluation: EvaluationRun;
}

export function ScoreSummaryCard({ evaluation }: ScoreSummaryCardProps) {
  const {
    totalScore = 0,
    maxPossible = 100,
    normalizedScore = totalScore,
    performanceBand,
    metadata,
    dimensions,
  } = evaluation;

  const isNormalized = maxPossible !== null && maxPossible !== 100;
  const rawScore = totalScore ?? 0;
  const rawMax = maxPossible ?? 100;
  const displayScore = isNormalized ? normalizedScore ?? rawScore : rawScore;
  const bandInfo = formatPerformanceBand(performanceBand);

  // Check if any dimension is disabled (e.g. D4 in coaching)
  const disabledDimension = dimensions?.find((d) => d.disabled || d.score === null);
  const disabledExplanation =
    disabledDimension?.disabledReason ||
    `${disabledDimension?.name || "Dimension"} was not applicable on this call, so the rubric was scored out of ${rawMax} and normalized to a 100-point scale.`;

  return (
    <section className="bg-white rounded-2xl border border-zinc-200/90 p-6 sm:p-7 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Score & Performance Band */}
        <div className="space-y-4 max-w-xl">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500">
              Primary Score
            </span>
            <PerformanceBandBadge band={performanceBand} size="sm" />
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-5xl sm:text-6xl font-extrabold tracking-tight text-zinc-950 font-mono">
              {displayScore}
            </span>
            <span className="text-2xl sm:text-3xl font-mono text-zinc-400 font-medium">
              / 100
            </span>
            {isNormalized && (
              <span className="text-xs font-mono font-semibold uppercase text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                normalized
              </span>
            )}
          </div>

          {/* Performance Band Textual Descriptor */}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-700 font-medium">
            <span className="font-semibold text-zinc-900 font-mono uppercase">
              {bandInfo.label}:
            </span>
            <span className="text-zinc-600 font-normal">{bandInfo.description}</span>
          </div>

          {/* Coaching disabled-D4 secondary information & explanatory caption */}
          {isNormalized && (
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-950 space-y-1.5 mt-2">
              <div className="flex items-center justify-between font-mono">
                <span className="text-blue-700 font-medium">Raw score:</span>
                <span className="font-bold text-blue-950">
                  {rawScore} / {rawMax}
                </span>
              </div>
              <p className="text-[11.5px] text-blue-800/90 leading-relaxed flex items-start gap-1.5 pt-0.5">
                <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span>{disabledExplanation}</span>
              </p>
            </div>
          )}
        </div>

        {/* Right: Key Call Metadata & Details */}
        <div className="lg:border-l lg:border-zinc-200 lg:pl-8 flex flex-col justify-center space-y-3 shrink-0 lg:min-w-[260px]">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
            Call Overview
          </span>

          <div className="space-y-2.5 text-xs">
            {metadata?.repName && (
              <div className="flex items-center gap-2 text-zinc-700">
                <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-zinc-400 font-mono text-[11px]">Coach / Rep:</span>
                <strong className="text-zinc-900 font-medium ml-auto truncate max-w-[160px]">
                  {metadata.repName}
                </strong>
              </div>
            )}

            {metadata?.clientName && (
              <div className="flex items-center gap-2 text-zinc-700">
                <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-zinc-400 font-mono text-[11px]">Client:</span>
                <strong className="text-zinc-900 font-medium ml-auto truncate max-w-[160px]">
                  {metadata.clientName}
                </strong>
              </div>
            )}

            {metadata?.callDuration && (
              <div className="flex items-center gap-2 text-zinc-700">
                <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-zinc-400 font-mono text-[11px]">Duration:</span>
                <strong className="text-zinc-900 font-medium ml-auto font-mono">
                  {metadata.callDuration}
                </strong>
              </div>
            )}

            {metadata?.wordCount && (
              <div className="flex items-center gap-2 text-zinc-700">
                <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-zinc-400 font-mono text-[11px]">Word Count:</span>
                <strong className="text-zinc-900 font-medium ml-auto font-mono">
                  {metadata.wordCount.toLocaleString()} words
                </strong>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
