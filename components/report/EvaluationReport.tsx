"use client";

import React, { useState } from "react";
import { EvaluationPublicResponse } from "@/lib/types/evaluation";
import { ReportHeader } from "@/components/evaluation/ReportHeader";
import { ScoreSummaryCard } from "./ScoreSummaryCard";
import { OneThingCard } from "./OneThingCard";
import { BriefCard } from "./BriefCard";
import { RedFlagsCard } from "./RedFlagsCard";
import { AppliedCapsSection } from "./AppliedCapsSection";
import { DimensionOverviewGrid } from "./DimensionOverviewGrid";
import { DimensionAccordion } from "./DimensionAccordion";
import { ShieldCheck } from "lucide-react";

interface EvaluationReportProps {
  evaluation: EvaluationPublicResponse;
  onDownloadPdf?: () => void;
}

export function EvaluationReport({
  evaluation,
  onDownloadPdf,
}: EvaluationReportProps) {
  const [selectedDimension, setSelectedDimension] = useState<number | null>(null);
  const result = evaluation.result;

  if (!result) return null;

  const handleSelectDimension = (dimNumber: number) => {
    setSelectedDimension(dimNumber);
  };

  return (
    <article className="space-y-6 animate-fade-in pb-12">
      {/* 1. Report Header (Complete badge, Type, ID, Timestamps, Share/PDF/New actions) */}
      <ReportHeader evaluation={evaluation} onDownloadPdf={onDownloadPdf} />

      {/* 1. Primary Score Presentation & Overview Card */}
      <ScoreSummaryCard evaluation={evaluation} />

      {/* 2. The One Thing (Single High-Leverage Opportunity) */}
      <OneThingCard oneThing={result.oneThing} />

      {/* 3. Brief (Coach-Facing Summary) */}
      <BriefCard brief={result.brief} />

      {/* 4. Red Flags (Client-Relationship Risk Assessment) */}
      <RedFlagsCard redFlags={result.redFlags} />

      {/* 5. Scoring Rules Applied / Applied Caps */}
      <AppliedCapsSection appliedRules={result.appliedRules} />

      {/* 6. Dimension Overview (Concise 12-Dimension Score Grid) */}
      {result.dimensions.length > 0 && (
        <DimensionOverviewGrid
          dimensions={result.dimensions}
          onSelectDimension={handleSelectDimension}
        />
      )}

      {/* 7. Twelve Detailed Dimension Sections (Expandable with Evidence & Quick Fixes) */}
      {result.dimensions.length > 0 && (
        <DimensionAccordion
          dimensions={result.dimensions}
          expandedDimensionNumber={selectedDimension}
        />
      )}

      {/* Report Footer / Integrity Sign-off */}
      <footer className="pt-8 border-t border-zinc-200 text-xs text-zinc-400 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Rubric: {evaluation.rubricVersion}</span>
        </div>
        <span>Evidence-Grounded QA Report</span>
      </footer>
    </article>
  );
}
