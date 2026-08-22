"use client";

import React, { useState } from "react";
import Link from "next/link";
import { EvaluationRun } from "@/lib/types/evaluation";
import { ReportHeader } from "./ReportHeader";
import { LifecycleStepper } from "./LifecycleStepper";
import { ActionButton } from "@/components/ui/ActionButton";
import { AlertTriangle, PlusCircle, Copy, Check, Info, ShieldAlert, Layers } from "lucide-react";

interface FailedStateProps {
  evaluation: EvaluationRun;
}

export function FailedState({ evaluation }: FailedStateProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyId = async () => {
    try {
      if (typeof window !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(evaluation.id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* 1. Shared Evaluation Header */}
      <ReportHeader evaluation={evaluation} />

      {/* 2. Main Failed Content Card */}
      <div className="bg-white rounded-2xl border border-rose-200 p-6 sm:p-8 shadow-xs max-w-3xl mx-auto">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">
              Evaluation failed
            </h2>
            <p className="mt-1 text-sm text-zinc-600 leading-relaxed">
              This run has been preserved so the failure is visible rather than leaving the evaluation in an endless processing state.
            </p>
          </div>
        </div>

        {/* 3. Restrained Lifecycle Visualization showing failed stage */}
        <div className="my-6 border-t border-b border-zinc-100 py-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 font-mono mb-3 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Lifecycle Status</span>
          </div>
          <LifecycleStepper
            stepStates={{
              created: "complete",
              evaluation: "failed",
              validation: "waiting",
              report: "waiting",
            }}
          />
        </div>

        {/* 4. Human-readable diagnostic error message */}
        <div className="rounded-xl bg-rose-50/70 border border-rose-200/80 p-4 sm:p-5 mb-6 text-xs text-rose-950 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-rose-900">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Diagnostic Failure Details</span>
          </div>

          <p className="font-mono text-xs leading-relaxed bg-white/80 p-3 rounded-lg border border-rose-200/60 text-rose-900">
            {evaluation.error?.message || "The transcript could not be processed due to insufficient word count or missing speaker turn indicators."}
          </p>

          <div className="text-rose-800/90 text-xs space-y-1">
            <p className="font-medium text-rose-900 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>Formatting Guidance:</span>
            </p>
            <p className="pl-5 text-rose-800">
              Ensure the transcript contains speaker-labelled turns (e.g., <code className="font-mono bg-rose-100/60 px-1 py-0.5 rounded text-rose-950">[Coach Name]:</code> and <code className="font-mono bg-rose-100/60 px-1 py-0.5 rounded text-rose-950">[Client Name]:</code>) and adequate conversational length.
            </p>
          </div>
        </div>

        {/* 5. Failure Actions */}
        <div className="pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-mono text-zinc-500 flex items-center gap-2">
            <span>Evaluation ID:</span>
            <code className="font-semibold text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded">
              {evaluation.id}
            </code>
          </div>

          <div className="flex items-center gap-2.5">
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={handleCopyId}
              leftIcon={
                copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )
              }
            >
              {copied ? "ID Copied!" : "Copy Evaluation ID"}
            </ActionButton>

            <Link href="/">
              <ActionButton
                variant="primary"
                size="sm"
                leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
              >
                Start New Evaluation
              </ActionButton>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
