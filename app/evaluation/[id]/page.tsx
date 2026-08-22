import React from "react";
import { getPublicEvaluationById } from "@/lib/fixtures/evaluation-fixtures";
import { PageContainer } from "@/components/layout/PageContainer";
import { QueuedState } from "@/components/evaluation/QueuedState";
import { ProcessingState } from "@/components/evaluation/ProcessingState";
import { FailedState } from "@/components/evaluation/FailedState";
import { NotFoundState } from "@/components/evaluation/NotFoundState";
import { EvaluationReport } from "@/components/report/EvaluationReport";
import { formatCallType } from "@/lib/utils/formatters";

interface EvaluationPageProps {
  params: {
    id: string;
  };
}

export function generateMetadata({ params }: EvaluationPageProps) {
  const evaluation = getPublicEvaluationById(params.id);

  if (!evaluation) {
    return {
      title: "Evaluation Not Found - Call Quality Assurance",
      description: "The requested evaluation run could not be located.",
    };
  }

  const typeLabel = formatCallType(evaluation.callType);
  return {
    title: `${typeLabel} Evaluation #${evaluation.id} - Call Quality Assurance`,
    description: `Quality assurance evaluation report for run ${evaluation.id}.`,
  };
}

export default function EvaluationPage({ params }: EvaluationPageProps) {
  const evaluation = getPublicEvaluationById(params.id);

  if (!evaluation) {
    return (
      <PageContainer size="md" className="py-12">
        <NotFoundState id={params.id} />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="lg" className="py-6 sm:py-8">
      {evaluation.status === "queued" && <QueuedState evaluation={evaluation} />}
      {evaluation.status === "processing" && <ProcessingState evaluation={evaluation} />}
      {evaluation.status === "failed" && <FailedState evaluation={evaluation} />}
      {evaluation.status === "completed" && <EvaluationReport evaluation={evaluation} />}
    </PageContainer>
  );
}
