"use client";

import React, { useState } from "react";
import { DimensionResult } from "@/lib/types/evaluation";
import { DimensionCard } from "./DimensionCard";
import { ChevronsUpDown, AlertTriangle, ShieldCheck, Layers } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface DimensionAccordionProps {
  dimensions: DimensionResult[];
  expandedDimensionNumber?: number | null;
}

export function DimensionAccordion({
  dimensions,
  expandedDimensionNumber,
}: DimensionAccordionProps) {
  const [filter, setFilter] = useState<"all" | "attention">("all");
  const [forceExpandAll, setForceExpandAll] = useState(false);
  const [accordionKey, setAccordionKey] = useState(0);

  const toggleExpandAll = () => {
    setForceExpandAll(!forceExpandAll);
    setAccordionKey((prev) => prev + 1);
  };

  const filteredDimensions = dimensions.filter((dim) => {
    if (filter === "attention") {
      if (dim.disabled) return false;
      const pct = (dim.score ?? 0) / dim.maxScore;
      return pct < 0.8 || dim.quickFix !== null;
    }
    return true;
  });

  return (
    <section className="space-y-4">
      {/* Section Header & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-200/80">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-600" />
            <h2 className="text-sm sm:text-base font-bold text-zinc-900 tracking-tight">
              Twelve Detailed Dimension Sections
            </h2>
            <span className="text-xs font-mono font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
              12 Dimensions
            </span>
          </div>

          {/* Evidence Philosophy Visible in UI */}
          <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5 font-normal">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Scores are grounded in transcript evidence. Missing behaviors are not inferred.</span>
          </p>
        </div>

        {/* Controls: Filter & Expand/Collapse */}
        <div className="flex items-center gap-2 shrink-0 no-print self-start sm:self-auto">
          <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100/80 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer",
                filter === "all"
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              All ({dimensions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("attention")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1",
                filter === "attention"
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "text-zinc-600 hover:text-zinc-900"
              )}
            >
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>Needs Focus</span>
            </button>
          </div>

          <button
            type="button"
            onClick={toggleExpandAll}
            className="px-2.5 py-1 text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ChevronsUpDown className="w-3.5 h-3.5 text-zinc-400" />
            <span>{forceExpandAll ? "Collapse All" : "Expand All"}</span>
          </button>
        </div>
      </div>

      {/* Accordion Cards List */}
      <div key={accordionKey} className="space-y-3">
        {filteredDimensions.map((dim) => (
          <DimensionCard
            key={dim.dimensionNumber}
            dimension={dim}
            isOpenDefault={
              forceExpandAll ||
              expandedDimensionNumber === dim.dimensionNumber ||
              (filter === "attention" && !dim.disabled)
            }
          />
        ))}

        {filteredDimensions.length === 0 && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-xs text-zinc-500">
            No dimensions found matching the selected filter.
          </div>
        )}
      </div>
    </section>
  );
}
