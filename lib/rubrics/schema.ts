/**
 * Authoritative domain model for versioned call-evaluation rubrics.
 *
 * This layer describes scoring; it does not detect transcript conditions or
 * calculate results. The deliberately small rule vocabulary covers the two
 * supplied rubrics without becoming a general-purpose rule engine.
 */

import { z } from "zod";
import { CallTypeSchema, PerformanceBandSchema } from "@/lib/contracts/evaluation";

export const RubricScoreModeSchema = z.enum(["banded", "discrete"]);
export type RubricScoreMode = z.infer<typeof RubricScoreModeSchema>;

export const DimensionBandLabelSchema = z.enum([
  "ELITE",
  "STRONG",
  "MID",
  "SURFACE",
  "WEAK",
  "FAIL",
]);
export type DimensionBandLabel = z.infer<typeof DimensionBandLabelSchema>;

const ScoreBandBaseSchema = z.object({
  label: DimensionBandLabelSchema,
  criteria: z.string().min(1),
});

/** A score band may be an explicit range or a single rubric-authored anchor. */
export const ScoreBandDefinitionSchema = z.discriminatedUnion("scoreKind", [
  ScoreBandBaseSchema.extend({
    scoreKind: z.literal("range"),
    minScore: z.number().nonnegative(),
    maxScore: z.number().nonnegative(),
  }).refine((band) => band.minScore <= band.maxScore, {
    message: "Score-band minimum must not exceed its maximum",
  }),
  ScoreBandBaseSchema.extend({
    scoreKind: z.literal("anchor"),
    score: z.number().nonnegative(),
  }),
]);
export type ScoreBandDefinition = z.infer<typeof ScoreBandDefinitionSchema>;

export const BandedDimensionScoringSchema = z.object({
  mode: z.literal("banded"),
  /** Permitted scoring precision; the evaluator still must honor authored bands. */
  increment: z.union([z.literal(1), z.literal(0.5)]),
  scoreBands: z.array(ScoreBandDefinitionSchema).min(1),
});

export const DiscreteDimensionScoringSchema = z.object({
  mode: z.literal("discrete"),
  allowedScores: z.array(z.number().nonnegative()).min(2),
  scoreBands: z.array(ScoreBandDefinitionSchema).min(2),
});

export const DimensionScoringSchema = z.discriminatedUnion("mode", [
  BandedDimensionScoringSchema,
  DiscreteDimensionScoringSchema,
]);
export type DimensionScoring = z.infer<typeof DimensionScoringSchema>;

export const DisabledDimensionOutcomeSchema = z.object({
  disabled: z.literal(true),
  score: z.null(),
  band: z.literal("N/A"),
});
export type DisabledDimensionOutcome = z.infer<typeof DisabledDimensionOutcomeSchema>;

export const WeightAdjustmentSchema = z.discriminatedUnion("mode", [
  z.object({
    /**
     * Exclude this dimension's authored weight from the raw maximum. Multiple
     * inactive dimensions compose by subtracting each excluded weight before
     * the active raw score is normalized.
     */
    mode: z.literal("exclude_dimension_weight"),
    excludedWeight: z.number().positive().max(100),
    normalizeTo: z.literal(100),
  }),
  z.object({
    mode: z.literal("reduce_raw_maximum"),
    reducedRawMaximum: z.number().positive().max(100),
    normalizeTo: z.literal(100),
  }),
  z.object({
    mode: z.literal("requires_resolution"),
    targetDimensionNumbers: z.array(z.number().int().min(1).max(12)).min(1),
    sourceInstruction: z.string().min(1),
    unresolvedReason: z.string().min(1),
  }),
]);
export type WeightAdjustment = z.infer<typeof WeightAdjustmentSchema>;

export const ApplicabilityRuleSchema = z.object({
  id: z.string().min(1),
  dimensionNumber: z.number().int().min(1).max(12),
  condition: z.string().min(1),
  disabledReasonTemplate: z.string().min(1),
  disabledOutcome: DisabledDimensionOutcomeSchema,
  weightAdjustment: WeightAdjustmentSchema,
  detectionCriteria: z.array(z.string().min(1)).optional(),
});
export type ApplicabilityRule = z.infer<typeof ApplicabilityRuleSchema>;

export const DimensionDefinitionSchema = z
  .object({
    number: z.number().int().min(1).max(12),
    name: z.string().min(1),
    maxScore: z.number().positive(),
    pillar: z.string().min(1).optional(),
    sopTimeMinutes: z.string().min(1).optional(),
    guidance: z.string().min(1),
    scoring: DimensionScoringSchema,
    positiveSignals: z.array(z.string().min(1)).optional(),
    negativeSignals: z.array(z.string().min(1)).optional(),
    notes: z.array(z.string().min(1)).optional(),
    applicabilityRules: z.array(ApplicabilityRuleSchema).optional(),
  })
  .superRefine((dimension, ctx) => {
    const scores =
      dimension.scoring.mode === "discrete"
        ? dimension.scoring.allowedScores
        : dimension.scoring.scoreBands.flatMap((band) =>
            band.scoreKind === "anchor" ? [band.score] : [band.minScore, band.maxScore]
          );

    if (scores.some((score) => score > dimension.maxScore)) {
      ctx.addIssue({
        code: "custom",
        message: "Dimension scoring values must not exceed maxScore",
        path: ["scoring"],
      });
    }

    if (dimension.scoring.mode === "discrete") {
      const uniqueScores = new Set(dimension.scoring.allowedScores);
      if (uniqueScores.size !== dimension.scoring.allowedScores.length) {
        ctx.addIssue({
          code: "custom",
          message: "Discrete allowed scores must be unique",
          path: ["scoring", "allowedScores"],
        });
      }
      if (!uniqueScores.has(0) || !uniqueScores.has(dimension.maxScore)) {
        ctx.addIssue({
          code: "custom",
          message: "Discrete allowed scores must include zero and maxScore",
          path: ["scoring", "allowedScores"],
        });
      }
    }

    (dimension.applicabilityRules ?? []).forEach((rule, index) => {
      if (rule.dimensionNumber !== dimension.number) {
        ctx.addIssue({
          code: "custom",
          message: "Applicability rule dimensionNumber must match its containing dimension",
          path: ["applicabilityRules", index, "dimensionNumber"],
        });
      }
      if (
        rule.weightAdjustment.mode === "exclude_dimension_weight" &&
        rule.weightAdjustment.excludedWeight !== dimension.maxScore
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Excluded N/A weight must equal the dimension maximum",
          path: ["applicabilityRules", index, "weightAdjustment", "excludedWeight"],
        });
      }
    });
  });
export type DimensionDefinition = z.infer<typeof DimensionDefinitionSchema>;

export const RuleEffectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("total_cap"), maxTotal: z.number().nonnegative().max(100) }),
  z.object({
    kind: z.literal("dimension_cap"),
    dimensionNumber: z.number().int().min(1).max(12),
    maxScore: z.number().nonnegative(),
  }),
  z.object({
    kind: z.literal("force_dimension_score"),
    dimensionNumber: z.number().int().min(1).max(12),
    score: z.number().nonnegative(),
  }),
]);
export type RuleEffect = z.infer<typeof RuleEffectSchema>;

export const AutomaticRuleDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  condition: z.string().min(1),
  effect: RuleEffectSchema,
  nonRecoverable: z.boolean().default(false),
  notes: z.array(z.string().min(1)).optional(),
});
export type AutomaticRuleDefinition = z.infer<typeof AutomaticRuleDefinitionSchema>;

export const PerformanceBandDefinitionSchema = z.object({
  band: PerformanceBandSchema,
  minInclusive: z.number().min(0).max(100),
  /** null means no upper boundary; ScoreSummary itself is capped at 100. */
  maxExclusive: z.number().positive().max(100).nullable(),
  description: z.string().min(1),
}).refine(
  (definition) =>
    definition.maxExclusive === null ||
    definition.minInclusive < definition.maxExclusive,
  { message: "Performance band minimum must be below its exclusive maximum" }
);
export type PerformanceBandDefinition = z.infer<typeof PerformanceBandDefinitionSchema>;

export const RubricDefinitionSchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    callType: CallTypeSchema,
    name: z.string().min(1),
    sourceReference: z.object({
      fileName: z.string().min(1),
      title: z.string().min(1),
    }),
    scope: z.string().min(1),
    maxScore: z.literal(100),
    scoreMode: RubricScoreModeSchema,
    dimensions: z.array(DimensionDefinitionSchema).length(12),
    automaticRules: z.array(AutomaticRuleDefinitionSchema),
    performanceBands: z.array(PerformanceBandDefinitionSchema).length(5),
    scoringPrinciples: z.array(z.string().min(1)).min(1),
    unresolvedRules: z.array(z.string().min(1)).default([]),
    maximumReconciliation: z
      .object({
        status: z.literal("unresolved_source_conflict"),
        declaredMaximum: z.literal(100),
        dimensionMaximumTotal: z.number().positive(),
        explanation: z.string().min(1),
      })
      .optional(),
  })
  .superRefine((rubric, ctx) => {
    const numbers = rubric.dimensions.map((dimension) => dimension.number);
    if (new Set(numbers).size !== numbers.length) {
      ctx.addIssue({ code: "custom", message: "Dimension numbers must be unique", path: ["dimensions"] });
    }

    const total = rubric.dimensions.reduce((sum, dimension) => sum + dimension.maxScore, 0);
    if (total !== rubric.maxScore) {
      if (
        !rubric.maximumReconciliation ||
        rubric.maximumReconciliation.declaredMaximum !== rubric.maxScore ||
        rubric.maximumReconciliation.dimensionMaximumTotal !== total
      ) {
        ctx.addIssue({
          code: "custom",
          message: "A source maximum conflict must have an exact maximumReconciliation record",
          path: ["dimensions"],
        });
      }
    } else if (rubric.maximumReconciliation) {
      ctx.addIssue({
        code: "custom",
        message: "maximumReconciliation must only be present for a real source conflict",
        path: ["maximumReconciliation"],
      });
    }

    if (rubric.dimensions.some((dimension) => dimension.scoring.mode !== rubric.scoreMode)) {
      ctx.addIssue({ code: "custom", message: "Every dimension must use the rubric score mode", path: ["dimensions"] });
    }
  });
export type RubricDefinition = z.infer<typeof RubricDefinitionSchema>;
