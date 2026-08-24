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

function canonicalEvidenceCharacter(character: string): string {
  if (/\s/.test(character)) return " ";
  if (/[‘’‚‛]/.test(character)) return "'";
  if (/[“”„‟]/.test(character)) return '"';
  if (/[‐‑‒–—―−]/.test(character)) return "-";
  if (character === "…") return "...";
  return character.toLocaleLowerCase();
}

function normalizeEvidenceText(value: string): string {
  return Array.from(value)
    .map(canonicalEvidenceCharacter)
    .join("")
    .replace(/ +/g, " ")
    .trim();
}

/**
 * Recover the exact source slice when the model changed only casing,
 * whitespace, or common typographic punctuation. Substantive paraphrases do
 * not match and continue through normal validation failure/repair handling.
 */
function createEvidenceQuoteReconciler(transcript: string) {
  let normalizedTranscript: string | undefined;
  const normalizedCharacters: string[] = [];
  const sourceStarts: number[] = [];
  const sourceEnds: number[] = [];

  return (quote: string): string | null => {
    if (transcript.includes(quote)) return quote;

    const normalizedQuote = normalizeEvidenceText(quote);
    if (!normalizedQuote) return null;

    if (normalizedTranscript === undefined) {
      let sourceOffset = 0;
      for (const character of transcript) {
        const start = sourceOffset;
        sourceOffset += character.length;
        const normalizedCharacter = canonicalEvidenceCharacter(character);

        for (const outputCharacter of normalizedCharacter) {
          if (outputCharacter === " " && normalizedCharacters.at(-1) === " ") {
            sourceEnds[sourceEnds.length - 1] = sourceOffset;
            continue;
          }
          normalizedCharacters.push(outputCharacter);
          sourceStarts.push(start);
          sourceEnds.push(sourceOffset);
        }
      }
      normalizedTranscript = normalizedCharacters.join("");
    }

    const matchIndex = normalizedTranscript.indexOf(normalizedQuote);
    if (matchIndex < 0) return null;

    const matchEnd = matchIndex + normalizedQuote.length - 1;
    return transcript.slice(sourceStarts[matchIndex], sourceEnds[matchEnd]);
  };
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
  const reconcileEvidenceQuote = createEvidenceQuoteReconciler(run.transcript);
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
    }

    dimension.evidence.forEach((evidence, evidenceIndex) => {
      const reconciledQuote = reconcileEvidenceQuote(evidence.quote);
      if (reconciledQuote === null) {
        issues.push(
          `dimensions.${index}.evidence.${evidenceIndex}.quote is not an exact transcript excerpt`
        );
      } else {
        evidence.quote = reconciledQuote;
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
    scoreSummary: {
      rawScore,
      maxPossible: activeMaximum,
      normalizedScore: expectedNormalized,
      finalScore: expectedFinal,
      performanceBand: getPerformanceBandForScore(expectedFinal),
    },
  });
}
