"use client";

import { useEffect, useState } from "react";

import { EvaluationPublicResponseSchema, type EvaluationPublicResponse } from "@/lib/contracts/evaluation";
import { FailedState } from "@/components/evaluation/FailedState";
import { ProcessingState } from "@/components/evaluation/ProcessingState";
import { QueuedState } from "@/components/evaluation/QueuedState";
import { EvaluationReport } from "@/components/report/EvaluationReport";

interface EvaluationRunViewProps {
  initialEvaluation: EvaluationPublicResponse;
  publicToken?: string;
}

export function EvaluationRunView({
  initialEvaluation,
  publicToken,
}: EvaluationRunViewProps) {
  const [evaluation, setEvaluation] = useState(initialEvaluation);

  useEffect(() => {
    if (!publicToken || !["queued", "processing"].includes(evaluation.status)) {
      return;
    }

    let requestInFlight = false;
    const poll = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const response = await fetch(`/api/evaluations/${publicToken}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const parsed = EvaluationPublicResponseSchema.safeParse(await response.json());
        if (parsed.success) setEvaluation(parsed.data);
      } finally {
        requestInFlight = false;
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 2_000);
    return () => window.clearInterval(interval);
  }, [evaluation.status, publicToken]);

  if (evaluation.status === "queued") return <QueuedState evaluation={evaluation} />;
  if (evaluation.status === "processing") {
    return <ProcessingState evaluation={evaluation} />;
  }
  if (evaluation.status === "failed") return <FailedState evaluation={evaluation} />;
  return <EvaluationReport evaluation={evaluation} />;
}
