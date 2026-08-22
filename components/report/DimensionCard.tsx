"use client";

import React, { useState } from "react";
import { DimensionResult } from "@/lib/types/evaluation";
import { PerformanceBandBadge } from "@/components/ui/PerformanceBandBadge";
import { EvidenceList } from "./EvidenceList";
import { ChevronDown, Wrench, Ban, HelpCircle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface DimensionCardProps {
  dimension: DimensionResult;
  isOpenDefault?: boolean;
}

export function DimensionCard({
  dimension,
  isOpenDefault = false,
}: DimensionCardProps) {
  const [isOpen, setIsOpen] = useState(isOpenDefault);

  const isDisabled = dimension.disabled || dimension.score === null;
  const pct = !isDisabled && dimension.score !== null ? (dimension.score / dimension.maxScore) * 100 : null;

  return (
    <div
      id={`dimension-section-${dimension.dimensionNumber}`}
      className={cn(
        "rounded-2xl border transition-all duration-200 overflow-hidden bg-white print-break-inside-avoid shadow-xs scroll-mt-24",
        isDisabled
          ? "border-zinc-200/90 bg-zinc-50/40 opacity-95"
          : isOpen
          ? "border-zinc-300 ring-1 ring-zinc-900/5 shadow-sm"
          : "border-zinc-200/90 hover:border-zinc-300"
      )}
    >
      {/* Header Button (Clickable Accordion) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left transition-colors hover:bg-zinc-50/60 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Dimension Number Badge */}
          <span className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-700 font-mono text-xs font-bold flex items-center justify-center shrink-0">
            D{dimension.dimensionNumber}
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h3 className="text-sm sm:text-base font-semibold text-zinc-900 tracking-tight">
                {dimension.name}
              </h3>
              {isDisabled && (
                <span className="text-[11px] font-mono font-semibold uppercase text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                  N/A
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Score, Band & Expand Indicator */}
        <div className="flex items-center gap-2.5 shrink-0">
          {!isDisabled && dimension.band && (
            <div className="hidden sm:inline-block">
              <PerformanceBandBadge band={dimension.band} size="sm" />
            </div>
          )}

          {/* Dimension Score Pill */}
          <span
            className={cn(
              "text-xs font-mono font-bold px-2.5 py-1 rounded-lg border shadow-2xs",
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
                {dimension.score}{" "}
                <span className="text-zinc-400 font-normal">/ {dimension.maxScore}</span>
              </>
            )}
          </span>

          <div
            className={cn(
              "w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 transition-transform duration-200",
              isOpen && "rotate-180 text-zinc-700 bg-zinc-100"
            )}
          >
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </button>

      {/* Expanded Accordion Body */}
      {isOpen && (
        <div className="px-5 pb-6 pt-3 border-t border-zinc-100 space-y-5 animate-fade-in">
          {/* If disabled / N/A */}
          {isDisabled ? (
            <div className="p-4 rounded-xl bg-zinc-100/80 border border-zinc-200 text-xs text-zinc-700 flex items-start gap-3">
              <Ban className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="text-zinc-900 font-semibold block">
                  Dimension Not Applicable (Excluded from 85-point Raw Total)
                </strong>
                <p className="leading-relaxed text-zinc-600">
                  {dimension.disabledReason || "This dimension was not applicable to the observed call context."}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* 1. Reasoning Section */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Reasoning</span>
                </h4>
                <p className="text-xs sm:text-sm text-zinc-800 leading-relaxed font-normal bg-zinc-50/50 p-3.5 rounded-xl border border-zinc-100">
                  {dimension.reasoning}
                </p>
              </div>

              {/* 2. Transcript Evidence Section */}
              <EvidenceList evidence={dimension.evidence} />

              {/* 3. Quick Fix Section */}
              {dimension.quickFix && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/90 text-xs text-amber-950 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold font-mono uppercase tracking-wider text-amber-900">
                    <Wrench className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Quick Fix</span>
                  </div>
                  <p className="text-xs sm:text-sm text-amber-950 leading-relaxed pl-5 font-medium">
                    {dimension.quickFix}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
