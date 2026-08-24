"use client";

import { z } from "zod";

import {
  CallTypeSchema,
  EvaluationStatusSchema,
  type CallType,
  type EvaluationStatus,
} from "@/lib/contracts/evaluation";

const STORAGE_KEY = "beavermind:tracked-evaluations:v1";
export const TRACKED_EVALUATIONS_CHANGED = "beavermind:tracked-evaluations-changed";
const MAX_TRACKED_EVALUATIONS = 20;

const TrackedEvaluationSchema = z.object({
  id: z.string().uuid(),
  publicToken: z.string().uuid(),
  evaluationPath: z.string().regex(/^\/evaluation\/[0-9a-f-]{36}$/i),
  reportName: z.string().trim().min(1).max(120).optional(),
  callType: CallTypeSchema,
  status: EvaluationStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
});

export type TrackedEvaluation = z.infer<typeof TrackedEvaluationSchema>;

function notifyListeners() {
  window.dispatchEvent(new Event(TRACKED_EVALUATIONS_CHANGED));
}

function writeTrackedEvaluations(evaluations: TrackedEvaluation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(evaluations.slice(0, MAX_TRACKED_EVALUATIONS))
  );
  notifyListeners();
}

export function readTrackedEvaluations(): TrackedEvaluation[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = z.array(TrackedEvaluationSchema).safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    return parsed.data.sort(
      (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)
    );
  } catch {
    return [];
  }
}

export function trackEvaluation(input: {
  id: string;
  evaluationUrl: string;
  reportName: string;
  callType: CallType;
}) {
  if (typeof window === "undefined") return;

  const evaluationPath = new URL(input.evaluationUrl, window.location.origin).pathname;
  const publicToken = evaluationPath.split("/").filter(Boolean).at(-1);
  const tracked = TrackedEvaluationSchema.parse({
    id: input.id,
    publicToken,
    evaluationPath,
    reportName: input.reportName,
    callType: input.callType,
    status: "queued",
    createdAt: new Date().toISOString(),
  });
  const existing = readTrackedEvaluations().filter(
    (evaluation) => evaluation.publicToken !== tracked.publicToken
  );
  writeTrackedEvaluations([tracked, ...existing]);
}

export function updateTrackedEvaluationStatus(
  publicToken: string,
  status: EvaluationStatus
) {
  const evaluations = readTrackedEvaluations();
  const current = evaluations.find(
    (evaluation) => evaluation.publicToken === publicToken
  );
  if (!current || current.status === status) return;

  writeTrackedEvaluations(
    evaluations.map((evaluation) =>
      evaluation.publicToken === publicToken
        ? { ...evaluation, status }
        : evaluation
    )
  );
}

export function removeTrackedEvaluation(publicToken: string) {
  const evaluations = readTrackedEvaluations();
  const next = evaluations.filter(
    (evaluation) => evaluation.publicToken !== publicToken
  );
  if (next.length === evaluations.length) return;
  writeTrackedEvaluations(next);
}
