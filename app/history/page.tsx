import type { Metadata } from "next";

import {
  EvaluationHistory,
  type EvaluationHistoryEntry,
} from "@/components/history/EvaluationHistory";
import { PageContainer } from "@/components/layout/PageContainer";
import { listFinalizedEvaluationRuns } from "@/lib/server/repositories/evaluation-runs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Evaluation History - Call Quality Assurance",
  description: "Review successful and failed call evaluations and their reports.",
};

export default async function HistoryPage() {
  let entries: EvaluationHistoryEntry[] = [];
  let loadError = false;

  try {
    entries = await listFinalizedEvaluationRuns(100);
  } catch (error) {
    loadError = true;
    console.error("Could not load evaluation history", error);
  }

  return (
    <PageContainer size="lg" className="py-6 sm:py-8">
      <EvaluationHistory entries={entries} loadError={loadError} />
    </PageContainer>
  );
}
