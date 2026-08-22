"use client";

import React from "react";
import { DimensionResult } from "@/lib/types/evaluation";
import { PerformanceBandBadge } from "@/components/ui/PerformanceBandBadge";
import { LayoutGrid, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface DimensionOverviewGridProps {
  dimensions: DimensionResult[];
  onSelectDimension?: (dimNumber: number) => void;
}

export function DimensionOverviewGrid({
  dimensions,
  onSelectDimension,
}: DimensionOverviewGridProps) {
  if (!dimensions || dimensions.length === 0) return null;

  const handleScrollToDimension = (dimNumber: number) => {
    if (onSelectDimension) {
      onSelectDimension(dimNumber);
    }
    const targetElement = document.getElementById(`dimension-section-${dimNumber}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-zinc-200/90 p-5 sm:p-6 shadow-xs space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-zinc-500" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-600">
            Dimension Overview
          </h2>
        </div>
        <span className="text-[11px] text-zinc-400 font-mono">
          12 rubric dimensions · Click to inspect details
        </span>
      </div>

      {/* Grid of 12 dimensions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {dimensions.map((dim) => {
          const isDisabled = dim.disabled || dim.score === null;
          const pct = !isDisabled && dim.score !== null ? (dim.score / dim.maxScore) * 100 : null;

          return (
            <button
              key={dim.dimensionNumber}
              type="button"
              onClick={() => handleScrollToDimension(dim.dimensionNumber)}
              className={cn(
                "group relative p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900",
                isDisabled
                  ? "bg-zinc-50/70 border-zinc-200 hover:border-zinc-300"
                  : pct !== null && pct >= 90
                  ? "bg-white border-zinc-200/90 hover:border-emerald-300 hover:shadow-xs"
                  : pct !== null && pct >= 75
                  ? "bg-white border-zinc-200/90 hover:border-blue-300 hover:shadow-xs"
                  : "bg-white border-zinc-200/90 hover:border-amber-300 hover:shadow-xs"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Dimension Tag */}
                <span className="w-6 h-6 rounded-md bg-zinc-100 border border-zinc-200/80 text-zinc-600 font-mono text-[11px] font-bold flex items-center justify-center shrink-0 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                  D{dim.dimensionNumber}
                </span>

                <div className="min-w-0">
                  <span className="text-xs font-semibold text-zinc-900 truncate block group-hover:text-zinc-950">
                    {dim.name}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {isDisabled ? (
                      <span className="text-[10.5px] font-mono text-zinc-400 font-medium">
                        N/A (Excluded)
                      </span>
                    ) : (
                      dim.band && (
                        <PerformanceBandBadge
                          band={dim.band}
                          size="sm"
                          showIcon={false}
                          className="text-[10px] py-0 px-1.5"
                        />
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Score / Max */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={cn(
                    "text-xs font-mono font-bold px-2 py-0.5 rounded border",
                    isDisabled
                      ? "bg-zinc-100 text-zinc-400 border-zinc-200"
                      : pct !== null && pct >= 90
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : pct !== null && pct >= 75
                      ? "bg-blue-50 text-blue-800 border-blue-200"
                      : "bg-amber-50 text-amber-900 border-amber-200"
                  )}
                >
                  {isDisabled ? (
                    "N/A"
                  ) : (
                    <>
                      {dim.score}{" "}
                      <span className="text-zinc-400 font-normal">/ {dim.maxScore}</span>
                    </>
                  )}
                </span>
                <ArrowDownRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-600 group-hover:translate-x-0.5 group-hover:translate-y-0.5 transition-all shrink-0" />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
