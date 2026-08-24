import React from "react";
import { z } from "zod";
import { getPublicEvaluationById } from "@/lib/fixtures/evaluation-fixtures";
import { PageContainer } from "@/components/layout/PageContainer";
import { NotFoundState } from "@/components/evaluation/NotFoundState";
import { EvaluationRunView } from "@/components/evaluation/EvaluationRunView";
import { formatCallType } from "@/lib/utils/formatters";
import { getEvaluationRunByPublicToken } from "@/lib/server/repositories/evaluation-runs";
import { toPublicEvaluationResponse } from "@/lib/server/evaluation/public-response";

export const dynamic = "force-dynamic";

interface EvaluationPageProps {
  params: {
    id: string;
  };
}

export function generateMetadata({ params }: EvaluationPageProps) {
  const evaluation = getPublicEvaluationById(params.id);

  if (!evaluation && !z.string().uuid().safeParse(params.id).success) {
    return {
      title: "Evaluation Not Found - Call Quality Assurance",
      description: "The requested evaluation run could not be located.",
    };
  }

  if (!evaluation) {
    return {
      title: "Call Evaluation Report - Call Quality Assurance",
      description: "Permanent BeaverMind call evaluation report.",
    };
  }

  const typeLabel = formatCallType(evaluation.callType);
  return {
    title: `${typeLabel} Evaluation #${evaluation.id} - Call Quality Assurance`,
    description: `Quality assurance evaluation report for run ${evaluation.id}.`,
  };
}

export default async function EvaluationPage({ params }: EvaluationPageProps) {
  const fixtureEvaluation = getPublicEvaluationById(params.id);
  const token = z.string().uuid().safeParse(params.id);
  const persistedRun =
    !fixtureEvaluation && token.success
      ? await getEvaluationRunByPublicToken(token.data)
      : null;
  const evaluation = fixtureEvaluation ??
    (persistedRun ? toPublicEvaluationResponse(persistedRun) : null);

  if (!evaluation) {
    return (
      <PageContainer size="md" className="py-12">
        <NotFoundState id={params.id} />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="lg" className="py-6 sm:py-8">
      <EvaluationRunView
        initialEvaluation={evaluation}
        publicToken={fixtureEvaluation ? undefined : params.id}
      />
    </PageContainer>
  );
}
