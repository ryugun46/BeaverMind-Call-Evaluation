"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Loader2,
  Radar,
} from "lucide-react";

import { EvaluationPublicResponseSchema } from "@/lib/contracts/evaluation";
import {
  readTrackedEvaluations,
  removeTrackedEvaluation,
  TRACKED_EVALUATIONS_CHANGED,
  updateTrackedEvaluationStatus,
  type TrackedEvaluation,
} from "@/lib/client/evaluation-tracker";
import { cn } from "@/lib/utils/cn";
import { formatCallType, formatDate } from "@/lib/utils/formatters";

const POLL_INTERVAL_MS = 3_000;

export function EvaluationProgressPanel() {
  const router = useRouter();
  const [evaluations, setEvaluations] = useState<TrackedEvaluation[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const syncFromStorage = () => {
      setEvaluations(readTrackedEvaluations());
      setIsReady(true);
    };

    syncFromStorage();
    window.addEventListener(TRACKED_EVALUATIONS_CHANGED, syncFromStorage);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener(TRACKED_EVALUATIONS_CHANGED, syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  const pendingKey = useMemo(
    () =>
      evaluations
        .filter(({ status }) => status === "queued" || status === "processing")
        .map(({ publicToken, status }) => `${publicToken}:${status}`)
        .join("|"),
    [evaluations]
  );

  useEffect(() => {
    if (!pendingKey) return;
    let cancelled = false;
    let requestInFlight = false;

    const poll = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const pending = readTrackedEvaluations().filter(
          ({ status }) => status === "queued" || status === "processing"
        );
        await Promise.all(
          pending.map(async ({ publicToken }) => {
            try {
              const response = await fetch(`/api/evaluations/${publicToken}`, {
                cache: "no-store",
              });
              if (!response.ok) return;
              const parsed = EvaluationPublicResponseSchema.safeParse(
                await response.json()
              );
              if (parsed.success) {
                updateTrackedEvaluationStatus(publicToken, parsed.data.status);
              }
            } catch {
              // Keep the last known state and retry on the next poll.
            }
          })
        );
        if (!cancelled) setEvaluations(readTrackedEvaluations());
      } finally {
        requestInFlight = false;
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pendingKey]);

  const activeCount = evaluations.filter(
    ({ status }) => status === "queued" || status === "processing"
  ).length;

  const openEvaluation = (evaluation: TrackedEvaluation) => {
    if (evaluation.status === "completed" || evaluation.status === "failed") {
      removeTrackedEvaluation(evaluation.publicToken);
      setEvaluations(readTrackedEvaluations());
    }
    router.push(evaluation.evaluationPath);
  };

  return (
    <section
      aria-labelledby="evaluation-progress-heading"
      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs"
    >
      <div className="border-b border-zinc-200 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-zinc-600" aria-hidden="true" />
            <h2
              id="evaluation-progress-heading"
              className="text-sm font-semibold text-zinc-900"
            >
              Evaluation progress
            </h2>
          </div>
          {activeCount > 0 && (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-blue-700">
              {activeCount} active
            </span>
          )}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
          Runs started on this device stay here while you move around the app.
        </p>
      </div>

      {!isReady ? (
        <div className="flex items-center justify-center gap-2 px-5 py-10 text-xs text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading progress
        </div>
      ) : evaluations.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100">
            <Clock3 className="h-4 w-4 text-zinc-500" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-zinc-800">No evaluations in progress</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Submit a transcript and its live status will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {evaluations.map((evaluation) => (
            <ProgressItem
              key={evaluation.publicToken}
              evaluation={evaluation}
              onOpen={() => openEvaluation(evaluation)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProgressItem({
  evaluation,
  onOpen,
}: {
  evaluation: TrackedEvaluation;
  onOpen: () => void;
}) {
  const isTerminal =
    evaluation.status === "completed" || evaluation.status === "failed";
  const statusDetails = {
    queued: {
      label: "Waiting to start",
      progress: 20,
      icon: <Clock3 className="h-4 w-4 text-zinc-500" aria-hidden="true" />,
      bar: "bg-zinc-500",
    },
    processing: {
      label: "Evaluating transcript",
      progress: 65,
      icon: <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />,
      bar: "bg-blue-600",
    },
    completed: {
      label: "Report ready",
      progress: 100,
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />,
      bar: "bg-emerald-600",
    },
    failed: {
      label: "Evaluation failed",
      progress: 100,
      icon: <AlertTriangle className="h-4 w-4 text-rose-600" aria-hidden="true" />,
      bar: "bg-rose-600",
    },
  }[evaluation.status];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full px-5 py-4 text-left transition-colors hover:bg-zinc-50 focus:outline-hidden focus-visible:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900"
      aria-label={`${statusDetails.label}: ${evaluation.reportName ?? formatCallType(evaluation.callType)}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
            evaluation.status === "completed" && "border-emerald-200 bg-emerald-50",
            evaluation.status === "failed" && "border-rose-200 bg-rose-50",
            evaluation.status === "processing" && "border-blue-200 bg-blue-50",
            evaluation.status === "queued" && "border-zinc-200 bg-zinc-100"
          )}
        >
          {statusDetails.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-zinc-900">
                {evaluation.reportName ?? formatCallType(evaluation.callType)}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-[11px] font-medium",
                  evaluation.status === "completed" && "text-emerald-700",
                  evaluation.status === "failed" && "text-rose-700",
                  evaluation.status === "processing" && "text-blue-700",
                  evaluation.status === "queued" && "text-zinc-500"
                )}
              >
                {statusDetails.label}
              </p>
            </div>
            <ArrowUpRight
              className="h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>

          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className={cn("h-full rounded-full transition-all duration-500", statusDetails.bar)}
              style={{ width: `${statusDetails.progress}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 font-mono text-[10px] text-zinc-400">
            <span>{formatDate(evaluation.createdAt)}</span>
            <span>{isTerminal ? "Open & clear" : "View status"}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
