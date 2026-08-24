import "server-only";

import { z } from "zod";

import {
  EvaluationResultCandidateSchema,
  EvaluationResultSchema,
  type EvaluationResult,
  type EvaluationRun,
} from "@/lib/contracts/evaluation";
import {
  getPerformanceBandForScore,
  getRubricForCallType,
} from "@/lib/rubrics";
import type {
  AutomaticRuleDefinition,
  DimensionDefinition,
} from "@/lib/rubrics/schema";

export class EvaluationOutputValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Evaluation output failed validation: ${issues.join("; ")}`);
    this.name = "EvaluationOutputValidationError";
  }
}

function findScoreBand(dimension: DimensionDefinition, score: number) {
  return dimension.scoring.scoreBands.find((band) =>
    band.scoreKind === "anchor"
      ? band.score === score
      : score >= band.minScore && score <= band.maxScore
  );
}

function automaticRuleById(
  rules: AutomaticRuleDefinition[],
  ruleId: string
) {
  return rules.find((rule) => rule.id === ruleId);
}

export function validateEvaluationResult(
  value: unknown,
  run: Pick<EvaluationRun, "callType" | "transcript" | "rubricVersion">
): EvaluationResult {
  const contractResult = EvaluationResultCandidateSchema.safeParse(value);
  if (!contractResult.success) {
    throw new EvaluationOutputValidationError(
      contractResult.error.issues.map(
        (issue) => `${issue.path.join(".") || "result"}: ${issue.message}`
      )
    );
  }

  const result = contractResult.data;
  const rubric = getRubricForCallType(run.callType);
  const issues: string[] = [];
  if (rubric.version !== run.rubricVersion) {
    issues.push(`stored rubric ${run.rubricVersion} does not match ${rubric.version}`);
  }

  const allowedRuleIds = new Set([
    ...rubric.automaticRules.map((rule) => rule.id),
    ...rubric.dimensions.flatMap((dimension) =>
      (dimension.applicabilityRules ?? []).map((rule) => rule.id)
    ),
  ]);
  const appliedRuleIds = new Set<string>();

  result.appliedRules.forEach((appliedRule, index) => {
    if (!appliedRule.ruleId) {
      issues.push(`appliedRules.${index}.ruleId is required for persisted AI output`);
    } else if (!allowedRuleIds.has(appliedRule.ruleId)) {
      issues.push(`appliedRules.${index}.ruleId is not present in the rubric`);
    } else {
      appliedRuleIds.add(appliedRule.ruleId);
    }
  });

  let activeMaximum = 0;
  let rawScore = 0;
  result.dimensions.forEach((dimension, index) => {
    const definition = rubric.dimensions[index];
    if (!definition) return;

    if (dimension.name !== definition.name) {
      issues.push(`dimensions.${index}.name does not match the rubric`);
    }
    if (dimension.maxScore !== definition.maxScore) {
      issues.push(`dimensions.${index}.maxScore does not match the rubric`);
    }

    if (dimension.disabled) {
      const applicabilityRules = definition.applicabilityRules ?? [];
      if (applicabilityRules.length === 0) {
        issues.push(`dimensions.${index} cannot be disabled by this rubric`);
      } else if (!applicabilityRules.some((rule) => appliedRuleIds.has(rule.id))) {
        issues.push(`dimensions.${index} requires its applicability rule in appliedRules`);
      }
    } else {
      activeMaximum += definition.maxScore;
      const score = dimension.score;
      if (score !== null) {
        rawScore += score;
        const scoreBand = findScoreBand(definition, score);
        if (!scoreBand) {
          issues.push(`dimensions.${index}.score is not an authored rubric score`);
        } else if (dimension.band !== scoreBand.label) {
          issues.push(`dimensions.${index}.band does not match its authored score band`);
        }

        if (
          definition.scoring.mode === "banded" &&
          Math.abs(score / definition.scoring.increment - Math.round(score / definition.scoring.increment)) > 0.001
        ) {
          issues.push(`dimensions.${index}.score uses invalid precision`);
        }
      }
    }

    dimension.evidence.forEach((evidence, evidenceIndex) => {
      if (!run.transcript.includes(evidence.quote)) {
        issues.push(
          `dimensions.${index}.evidence.${evidenceIndex}.quote is not an exact transcript excerpt`
        );
      }
    });
  });

  const expectedNormalized = Number(
    ((rawScore / activeMaximum) * 100).toFixed(2)
  );

  let expectedFinal = expectedNormalized;
  appliedRuleIds.forEach((ruleId) => {
    const rule = automaticRuleById(rubric.automaticRules, ruleId);
    if (!rule) return;

    if (rule.effect.kind === "total_cap") {
      expectedFinal = Math.min(expectedFinal, rule.effect.maxTotal);
    } else if (rule.effect.kind === "dimension_cap") {
      const dimension = result.dimensions[rule.effect.dimensionNumber - 1];
      if (!dimension?.disabled && (dimension?.score ?? 0) > rule.effect.maxScore) {
        issues.push(`${rule.id} dimension cap was not applied`);
      }
    } else if (rule.effect.kind === "force_dimension_score") {
      const dimension = result.dimensions[rule.effect.dimensionNumber - 1];
      if (!dimension?.disabled && dimension?.score !== rule.effect.score) {
        issues.push(`${rule.id} forced dimension score was not applied`);
      }
    }
  });

  if (issues.length > 0) throw new EvaluationOutputValidationError(issues);

  return EvaluationResultSchema.parse({
    ...result,
    scoreSummary: {
      rawScore,
      maxPossible: activeMaximum,
      normalizedScore: expectedNormalized,
      finalScore: expectedFinal,
      performanceBand: getPerformanceBandForScore(expectedFinal),
    },
  });
}
