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
import {
  analyzeTranscript,
  getSpeakerWordShareByLabel,
} from "@/lib/server/evaluation/transcript-metrics";
import {
  locateTranscriptQuote,
  parseTranscript,
} from "@/lib/server/evaluation/transcript-structure";

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

function passesDeterministicGuard(
  rule: AutomaticRuleDefinition,
  transcriptMetrics: ReturnType<typeof analyzeTranscript>
): boolean {
  const guard = rule.deterministicGuard;
  if (!guard) return true;

  if (guard.kind === "speaker_word_share_above") {
    const share = getSpeakerWordShareByLabel(
      transcriptMetrics,
      guard.speakerLabelIncludes
    );
    // An unlabelled transcript cannot be decided mechanically, so retain the
    // model's decision rather than inventing a negative result.
    return share === null || share > guard.thresholdPercent;
  }

  return true;
}

function canonicalRangeScore(
  definition: DimensionDefinition,
  minScore: number,
  maxScore: number
): number {
  if (definition.scoring.mode !== "banded") return minScore;
  const increment = definition.scoring.increment;
  const midpointInIncrements = (minScore + maxScore) / 2 / increment;
  // Round midpoint ties downward for a stable, conservative band score.
  const roundedIncrements = Math.floor(midpointInIncrements + 0.5 - 1e-9);
  return Number(
    Math.min(maxScore, Math.max(minScore, roundedIncrements * increment)).toFixed(2)
  );
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
  const transcriptMetrics = analyzeTranscript(run.transcript);
  const parsedTranscript = parseTranscript(run.transcript);
  const issues: string[] = [];
  if (!result.clientName) issues.push("clientName is required for the report header");
  if (!result.coachName) issues.push("coachName is required for the report header");
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

  const normalizedAppliedRules: typeof result.appliedRules = [];
  result.appliedRules.forEach((appliedRule, index) => {
    if (!appliedRule.ruleId) {
      issues.push(`appliedRules.${index}.ruleId is required for persisted AI output`);
    } else if (!allowedRuleIds.has(appliedRule.ruleId)) {
      issues.push(`appliedRules.${index}.ruleId is not present in the rubric`);
    } else if (appliedRuleIds.has(appliedRule.ruleId)) {
      return;
    } else {
      const automaticRule = automaticRuleById(
        rubric.automaticRules,
        appliedRule.ruleId
      );
      if (
        automaticRule &&
        !passesDeterministicGuard(automaticRule, transcriptMetrics)
      ) {
        return;
      }
      appliedRuleIds.add(appliedRule.ruleId);
      normalizedAppliedRules.push(appliedRule);
    }
  });
  result.appliedRules = normalizedAppliedRules;

  // Range-valued Kick-off bands otherwise let equally calibrated models pick
  // different point values inside the same band. Preserve the model's band
  // judgment, but standardize its exact points to the authored range midpoint.
  result.dimensions.forEach((dimension, index) => {
    if (dimension.disabled || dimension.score === null) return;
    const definition = rubric.dimensions[index];
    if (!definition) return;
    const selectedBand = findScoreBand(definition, dimension.score);
    if (
      !selectedBand ||
      selectedBand.scoreKind !== "range" ||
      dimension.band !== selectedBand.label
    ) {
      return;
    }

    const canonicalScore = canonicalRangeScore(
      definition,
      selectedBand.minScore,
      selectedBand.maxScore
    );
    if (dimension.score !== canonicalScore) {
      dimension.reasoning = `${dimension.reasoning} The ${selectedBand.label} range was standardized to ${canonicalScore}/${definition.maxScore}.`;
      dimension.score = canonicalScore;
    }
  });

  // The model decides whether a rule condition occurred; once it records a
  // valid rule ID, the rule's numeric effect is deterministic and server-owned.
  appliedRuleIds.forEach((ruleId) => {
    const rule = automaticRuleById(rubric.automaticRules, ruleId);
    if (!rule || rule.effect.kind === "total_cap") return;

    const dimension = result.dimensions[rule.effect.dimensionNumber - 1];
    const definition = rubric.dimensions[rule.effect.dimensionNumber - 1];
    if (!dimension || !definition || dimension.disabled) return;

    const adjustedScore =
      rule.effect.kind === "dimension_cap"
        ? Math.min(dimension.score ?? 0, rule.effect.maxScore)
        : rule.effect.score;
    const adjustedBand = findScoreBand(definition, adjustedScore);
    if (!adjustedBand) {
      issues.push(`${rule.id} produces a score not authored by the rubric`);
      return;
    }

    if (dimension.score !== adjustedScore) {
      dimension.reasoning = `${dimension.reasoning} ${rule.label} was applied, setting this dimension to ${adjustedScore}/${definition.maxScore}.`;
    }
    dimension.score = adjustedScore;
    dimension.band = adjustedBand.label;
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
      if ((score ?? 0) > 0 && dimension.evidence.length === 0) {
        issues.push(`dimensions.${index} requires evidence for a positive score`);
      }
    }

    dimension.evidence.forEach((evidence, evidenceIndex) => {
      const locatedQuote = locateTranscriptQuote(
        run.transcript,
        evidence.quote,
        evidence.speaker,
        parsedTranscript
      );
      if (locatedQuote === null) {
        issues.push(
          `dimensions.${index}.evidence.${evidenceIndex}.quote is not an exact transcript excerpt`
        );
      } else {
        evidence.quote = locatedQuote.quote;
        evidence.speaker = locatedQuote.speaker;
        evidence.turnIndex = locatedQuote.turnIndex;
        if (locatedQuote.timestamp) evidence.timestamp = locatedQuote.timestamp;
        else delete evidence.timestamp;
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
    }
  });

  if (issues.length > 0) throw new EvaluationOutputValidationError(issues);

  return EvaluationResultSchema.parse({
    ...result,
    oneThing: {
      ...result.oneThing,
      currentScore: expectedFinal,
      potentialScore: Math.max(expectedFinal, result.oneThing.potentialScore),
    },
    scoreSummary: {
      rawScore,
      maxPossible: activeMaximum,
      normalizedScore: expectedNormalized,
      finalScore: expectedFinal,
      performanceBand: getPerformanceBandForScore(expectedFinal),
    },
  });
}
