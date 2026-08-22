import React from "react";
import { cn } from "@/lib/utils/cn";

interface ScoreBadgeProps {
  score: number | null | undefined;
  maxScore: number;
  normalizedScore?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ScoreBadge({
  score,
  maxScore,
  normalizedScore,
  size = "md",
  className,
}: ScoreBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <span
        className={cn(
          "inline-flex items-center font-mono font-medium rounded border border-zinc-200 bg-zinc-100/80 text-zinc-500",
          size === "sm" && "text-xs px-2 py-0.5",
          size === "md" && "text-xs px-2.5 py-1",
          size === "lg" && "text-sm px-3 py-1.5",
          className
        )}
      >
        N/A
      </span>
    );
  }

  const percentage = Math.round((score / maxScore) * 100);

  let toneColor = "bg-zinc-50 text-zinc-800 border-zinc-200";
  if (percentage >= 90) {
    toneColor = "bg-emerald-50 text-emerald-900 border-emerald-200";
  } else if (percentage >= 75) {
    toneColor = "bg-blue-50 text-blue-900 border-blue-200";
  } else if (percentage >= 60) {
    toneColor = "bg-amber-50 text-amber-900 border-amber-200";
  } else {
    toneColor = "bg-rose-50 text-rose-900 border-rose-200";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center font-mono font-semibold rounded-md border tracking-tight transition-colors shadow-2xs",
        toneColor,
        size === "sm" && "text-xs px-2 py-0.5",
        size === "md" && "text-xs px-2.5 py-1",
        size === "lg" && "text-sm px-3 py-1.5",
        className
      )}
    >
      <span>
        {score} <span className="text-zinc-400 font-normal">/ {maxScore}</span>
      </span>
      {normalizedScore !== undefined && normalizedScore !== null && maxScore !== 100 && (
        <span className="ml-1.5 text-[10px] text-zinc-500 font-normal">
          ({normalizedScore} norm.)
        </span>
      )}
    </span>
  );
}
