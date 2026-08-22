"use client";

import React from "react";
import Link from "next/link";
import { EvaluationPublicResponse } from "@/lib/types/evaluation";
import { ReportHeader } from "./ReportHeader";
import { LifecycleStepper } from "./LifecycleStepper";
import { ActionButton } from "@/components/ui/ActionButton";
import { Clock, PlusCircle, ArrowLeft, Layers, ShieldCheck, CheckCircle } from "lucide-react";

interface QueuedStateProps {
  evaluation: EvaluationPublicResponse;
}

export function QueuedState({ evaluation }: QueuedStateProps) {
  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* 1. Shared Evaluation Header */}
      <ReportHeader evaluation={evaluation} />

      {/* 2. Main Queued Content Card */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 sm:p-8 shadow-xs max-w-3xl mx-auto">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200/80 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-zinc-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">
              Evaluation queued
            </h2>
            <p className="mt-1 text-sm text-zinc-600 leading-relaxed">
              The run has been created and is waiting to be processed.
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
              evaluation: "waiting",
              validation: "waiting",
              report: "waiting",
            }}
          />
        </div>

        {/* 4. Asynchronous processing notice */}
        <div className="rounded-xl bg-zinc-50 border border-zinc-200/80 p-4 text-xs text-zinc-600 leading-relaxed space-y-2">
          <div className="flex items-center gap-2 font-medium text-zinc-900">
            <ShieldCheck className="w-4 h-4 text-zinc-700 shrink-0" />
            <span>Background Execution</span>
          </div>
          <p>
            You&apos;re free to close this page. Processing is tied to the evaluation run, not this browser session.
          </p>
        </div>

        {/* 5. Additional Run Metadata & Actions */}
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
