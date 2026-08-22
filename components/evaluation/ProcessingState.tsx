"use client";

import React from "react";
import Link from "next/link";
import { EvaluationPublicResponse } from "@/lib/types/evaluation";
import { ReportHeader } from "./ReportHeader";
import { LifecycleStepper } from "./LifecycleStepper";
import { ActionButton } from "@/components/ui/ActionButton";
import { Loader2, PlusCircle, ArrowLeft, Layers, ShieldCheck, CheckCircle2, Search, FileCheck } from "lucide-react";

interface ProcessingStateProps {
  evaluation: EvaluationPublicResponse;
}

export function ProcessingState({ evaluation }: ProcessingStateProps) {
  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* 1. Shared Evaluation Header */}
      <ReportHeader evaluation={evaluation} />

      {/* 2. Main Processing Content Card */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 sm:p-8 shadow-xs max-w-3xl mx-auto">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center shrink-0">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">
              Evaluating call
            </h2>
            <p className="mt-1 text-sm text-zinc-600 leading-relaxed">
              The evaluation engine is actively analyzing the conversation transcript.
            </p>
          </div>
        </div>

        {/* 3. Restrained Lifecycle Visualization */}
        <div className="my-6 border-t border-b border-zinc-100 py-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 font-mono mb-3 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Lifecycle Status</span>
          </div>
          <LifecycleStepper
            stepStates={{
              created: "complete",
              evaluation: "active",
              validation: "waiting",
              report: "waiting",
            }}
          />
        </div>

        {/* 4. Concrete Processing Stage Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100/80 text-xs">
            <div className="flex items-center gap-2 text-blue-900 font-semibold mb-1">
              <Search className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Rubric Application</span>
            </div>
            <p className="text-zinc-600 leading-normal">
              The selected rubric is being applied to assess dialogue turns.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100/80 text-xs">
            <div className="flex items-center gap-2 text-blue-900 font-semibold mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Evidence Grounding</span>
            </div>
            <p className="text-zinc-600 leading-normal">
              Transcript evidence is being examined and quoted directly.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100/80 text-xs">
            <div className="flex items-center gap-2 text-blue-900 font-semibold mb-1">
              <FileCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Result Validation</span>
            </div>
            <p className="text-zinc-600 leading-normal">
              The structured result will be validated before completion.
            </p>
          </div>
        </div>

        {/* 5. Asynchronous Background Notice */}
        <div className="rounded-xl bg-zinc-50 border border-zinc-200/80 p-4 text-xs text-zinc-600 leading-relaxed space-y-2">
          <div className="flex items-center gap-2 font-medium text-zinc-900">
            <ShieldCheck className="w-4 h-4 text-zinc-700 shrink-0" />
            <span>Background Execution</span>
          </div>
          <p>
            You&apos;re free to close this page. Processing is tied to the evaluation run, not this browser session.
          </p>
        </div>

        {/* 6. Footer Actions */}
        <div className="mt-6 pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-mono text-zinc-400">
            Run ID: <span className="text-zinc-700 font-medium">{evaluation.id}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/">
              <ActionButton
                variant="secondary"
                size="sm"
                leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              >
                Back
              </ActionButton>
            </Link>
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
