/**
 * @file lib/contracts/evaluation.ts
 *
 * Authoritative shared domain contract for the BeaverMind Call Evaluation system.
 *
 * This file is the SINGLE source of truth for all domain types.
 * TypeScript types are derived from Zod schemas via z.infer — do not write
 * duplicate hand-crafted interfaces for these shapes.
 *
 * Consumers:
 *   - Next.js frontend (direct import)
 *   - Future Node.js backend (extract/copy this file or reference via package)
 *   - AI evaluator (structured output validation)
 *   - Database layer (shape reference for ORM models)
 *   - PDF generator (report data shape)
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// § 1. Core Enums
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The type of coaching call being evaluated.
 * "kickoff"  — New client onboarding / kick-off call (12-dimension rubric, 100 pts)
 * "coaching" — Ongoing coaching session (12-dimension rubric, up to 100 pts, D4 may be N/A)
 */
export const CallTypeSchema = z.enum(["kickoff", "coaching"]);
export type CallType = z.infer<typeof CallTypeSchema>;

/**
 * Lifecycle status of an evaluation run.
 */
export const EvaluationStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "failed",
]);
export type EvaluationStatus = z.infer<typeof EvaluationStatusSchema>;

/**
 * Performance band label assigned to an overall score or individual dimension.
 * Canonical form uses underscores. Display strings (e.g. "AT RISK") are handled
 * by the formatter layer, not stored in domain data.
 */
export const PerformanceBandSchema = z.enum([
  "ELITE",
  "STRONG",
  "INCONSISTENT",
  "AT_RISK",
  "FAIL",
]);
export type PerformanceBand = z.infer<typeof PerformanceBandSchema>;

/**
 * Dimension-level rubric labels are not the same thing as overall performance
 * bands. Kick-off and Coaching both use authored labels such as MID, SURFACE,
 * and WEAK for individual dimensions.
 */
export const DimensionBandSchema = z.union([
  PerformanceBandSchema,
  z.enum(["MID", "SURFACE", "WEAK"]),
]);
export type DimensionBand = z.infer<typeof DimensionBandSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § 2. Evidence Item
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A verbatim transcript quote used as evidence for a dimension score.
 *
 * - `quote` MUST be exact text from the transcript — not paraphrased.
 * - No timestamps because source transcripts do not contain them.
 * - `turnIndex` is optional and may be populated by future AI tooling if
 *   the transcript is pre-processed into structured turns.
 */
export const EvidenceItemSchema = z.object({
  speaker: z.string().min(1, "Speaker label must not be empty"),
  quote: z.string().min(1, "Quote must not be empty"),
  turnIndex: z.number().int().nonnegative().optional(),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § 3. Dimension Result
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The scored result for one rubric dimension.
 *
 * Active dimension:   score = number, disabled = false | undefined
 * Disabled/N/A dim.:  score = null,   disabled = true
 *
 * IMPORTANT: N/A dimensions must use score = null.
 * Do NOT represent N/A as score = 0.
 *
 * An active dimension with zero evidence is valid when the required behaviour
 * was absent from the transcript.
 */
export const DimensionResultSchema = z
  .object({
    dimensionNumber: z.number().int().min(1).max(12),
    name: z.string().min(1),
    /** null only for disabled/N/A dimensions; Kick-off supports half points. */
    score: z.number().nonnegative().multipleOf(0.5).nullable(),
    maxScore: z.number().positive().multipleOf(0.5),
    band: DimensionBandSchema.nullable(),
    reasoning: z.string().min(1),
    evidence: z.array(EvidenceItemSchema),
    quickFix: z.string().nullable(),
    disabled: z.boolean().default(false),
    disabledReason: z.string().min(1).nullable(),
  })
  .superRefine((dimension, ctx) => {
    if (dimension.disabled) {
      if (dimension.score !== null) {
        ctx.addIssue({
          code: "custom",
          message: "A disabled dimension must use score: null",
          path: ["score"],
        });
      }
      if (dimension.band !== null) {
        ctx.addIssue({
          code: "custom",
          message: "A disabled dimension must use band: null",
          path: ["band"],
        });
      }
      if (!dimension.disabledReason) {
        ctx.addIssue({
          code: "custom",
          message: "A disabled dimension requires disabledReason",
          path: ["disabledReason"],
        });
      }
      return;
    }

    if (dimension.score === null) {
      ctx.addIssue({
        code: "custom",
        message: "An active dimension must have a numeric score",
        path: ["score"],
      });
    } else if (dimension.score > dimension.maxScore) {
      ctx.addIssue({
        code: "custom",
        message: "Dimension score must not exceed maxScore",
        path: ["score"],
      });
    }

    if (dimension.band === null) {
      ctx.addIssue({
        code: "custom",
        message: "An active dimension requires a band",
        path: ["band"],
      });
    }
    if (dimension.disabledReason !== null) {
      ctx.addIssue({
        code: "custom",
        message: "An active dimension must not have disabledReason",
        path: ["disabledReason"],
      });
    }
  });
export type DimensionResult = z.infer<typeof DimensionResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § 4. Applied Scoring Rule
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scope classification for a scoring rule.
 * "total"         — affects the overall final/normalized score
 * "dimension"     — affects a specific dimension's score
 * "applicability" — marks a dimension as N/A / excluded from the raw total
 */
export const ScoringRuleScopeSchema = z.enum([
  "total",
  "dimension",
  "applicability",
]);
export type ScoringRuleScope = z.infer<typeof ScoringRuleScopeSchema>;

/**
 * The recorded result of a deterministic rubric scoring rule that was applied
 * to this evaluation run.
 *
 * Examples of rules this schema can represent:
 *   - Total score cap (e.g. "score capped at 65 due to compliance omission")
 *   - Dimension score cap
 *   - Forced dimension zero
 *   - Dimension N/A / excluded from raw total (normalization trigger)
 *   - Other guardrail adjustments
 *
 * Rules are not implemented here — only their applied result is modelled.
 */
export const AppliedScoringRuleSchema = z.object({
  /** Machine-readable identifier for the rule (e.g. "COMPLIANCE_OMISSION_CAP") */
  ruleId: z.string().optional(),
  /** Human-readable label shown in the report UI */
  label: z.string().min(1),
  /** Full explanation of why the rule was triggered */
  description: z.string().min(1),
  /** Scope of the rule's effect */
  scope: ScoringRuleScopeSchema.optional(),
  /** Dimension number affected, when scope = "dimension" or "applicability" */
  affectedDimensionNumber: z.number().int().min(1).max(12).optional(),
  /** Concise machine-readable/display string describing the numeric effect */
  effect: z.string().min(1),
  /**
   * When true, no amount of improvement in other dimensions can recover the
   * score past this rule's constraint (e.g. hard compliance cap).
   */
  nonRecoverable: z.boolean().optional(),
});
export type AppliedScoringRule = z.infer<typeof AppliedScoringRuleSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § 5. Red Flag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A structured client-relationship or compliance risk identified in the call.
 * Prefer structured objects over raw strings for richer display and future
 * severity-based filtering.
 */
export const RedFlagItemSchema = z.object({
  title: z.string().min(1),
  explanation: z.string().min(1),
  /**
   * Optional severity hint. Keep simple — do not build complex severity logic
   * until the rubric specification requires it.
   * "high" | "medium" | "low"
   */
  severity: z.enum(["high", "medium", "low"]).optional(),
});
export type RedFlagItem = z.infer<typeof RedFlagItemSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § 6. The One Thing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The single highest-impact improvement opportunity in this evaluation.
 * There is exactly ONE per completed evaluation — not a ranked list.
 */
export const OneThingSchema = z.object({
  title: z.string().min(1),
  explanation: z.string().min(1),
  currentScore: z.number().nonnegative().max(100),
  potentialScore: z.number().nonnegative().max(100),
  /**
   * Dimension numbers that would benefit from this improvement.
   * May be empty if the improvement is cross-cutting.
   */
  affectedDimensionNumbers: z.array(z.number().int().min(1).max(12)).optional(),
});
export type OneThing = z.infer<typeof OneThingSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § 7. Score Summary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The calculated scoring outcome for an evaluation run.
 *
 * Four values because kick-off and coaching differ:
 *
 * Normal Kick-off (all 12 dims active):
 *   rawScore = 84, maxPossible = 100, normalizedScore = 84, finalScore = 84
 *
 * Coaching with D4 disabled (11 dims active, max = 85):
 *   rawScore = 71, maxPossible = 85, normalizedScore = 84, finalScore = 84
 *
 * Scores are calculated upstream — this schema only models the stored result.
 */
export const ScoreSummarySchema = z.object({
  /** Sum of all active dimension scores */
  rawScore: z.number().nonnegative(),
  /** Maximum possible raw points (≤ 100; may be < 100 when a dimension is disabled) */
  maxPossible: z.number().positive().max(100),
  /** rawScore expressed on a 0–100 scale (= rawScore when maxPossible = 100) */
  normalizedScore: z.number().nonnegative().max(100),
  /** Final displayed score after any caps or guardrail rules are applied (0–100) */
  finalScore: z.number().nonnegative().max(100),
  performanceBand: PerformanceBandSchema,
});
export type ScoreSummary = z.infer<typeof ScoreSummarySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § 8. Evaluation Result
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete structured result of a successful evaluation.
 * Embedded as `result` on a completed `EvaluationRun`.
 *
 * Totals are NOT calculated inside this schema — they are computed upstream
 * and stored in `scoreSummary`.
 */
export const EvaluationResultSchema = z.object({
  scoreSummary: ScoreSummarySchema,
  /** Coach-facing narrative summary of the call */
  brief: z.string().min(1),
  oneThing: OneThingSchema,
  redFlags: z.array(RedFlagItemSchema),
  appliedRules: z.array(AppliedScoringRuleSchema),
  /**
   * All 12 dimension results, in rubric order.
   * Active and disabled dimensions must both be present.
   */
  dimensions: z
    .array(DimensionResultSchema)
    .length(12, "EvaluationResult must contain exactly 12 dimension entries"),
}).superRefine((result, ctx) => {
  const expectedNumbers = Array.from({ length: 12 }, (_, index) => index + 1);
  const actualNumbers = result.dimensions.map((dimension) => dimension.dimensionNumber);
  if (actualNumbers.some((number, index) => number !== expectedNumbers[index])) {
    ctx.addIssue({
      code: "custom",
      message: "Dimensions must be uniquely ordered from 1 through 12",
      path: ["dimensions"],
    });
  }

  const activeScoreTotal = result.dimensions.reduce(
    (total, dimension) => total + (dimension.disabled ? 0 : dimension.score ?? 0),
    0
  );
  if (Math.abs(activeScoreTotal - result.scoreSummary.rawScore) > 0.001) {
    ctx.addIssue({
      code: "custom",
      message: "rawScore must equal the sum of active dimension scores",
      path: ["scoreSummary", "rawScore"],
    });
  }
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § 9. Evaluation Error
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structured error recorded when an evaluation run fails.
 * Do not store only a raw string — future tooling needs structured codes.
 *
 * Example future codes:
 *   LLM_ERROR | STRUCTURED_OUTPUT_ERROR | VALIDATION_ERROR | WORKER_ERROR
 */
export const EvaluationErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z
    .union([z.string().min(1), z.record(z.string(), z.unknown())])
    .optional(),
});
export type EvaluationError = z.infer<typeof EvaluationErrorSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § 10. Call Metadata
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Optional contextual metadata attached to an evaluation run.
 * Not part of the scored rubric — used for display and filtering.
 */
export const EvaluationMetadataSchema = z.object({
  repName: z.string().optional(),
  clientName: z.string().optional(),
  /** Human-readable duration string, e.g. "28m 14s" */
  callDuration: z.string().optional(),
  wordCount: z.number().int().nonnegative().optional(),
  queuePosition: z.number().int().nonnegative().optional(),
});
export type EvaluationMetadata = z.infer<typeof EvaluationMetadataSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § 11. Evaluation Run (primary persisted domain entity)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The main persisted evaluation run record.
 *
 * Lifecycle invariants:
 *   queued / processing:  result = null, error = null
 *   completed:            result != null, error = null
 *   failed:               result = null, error != null
 *
 * Dates are stored as ISO 8601 strings (UTC) so they survive JSON serialisation
 * across browser/server boundaries without timezone ambiguity.
 *
 * `transcript` is stored on the run but is intentionally excluded from the
 * public report response schema (see EvaluationPublicResponseSchema) to avoid
 * exposing large text payloads unnecessarily.
 */
const EvaluationRunShape = {
  id: z.string().uuid(),
  callType: CallTypeSchema,
  rubricVersion: z.string().min(1),
  status: EvaluationStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  processingStartedAt: z.string().datetime({ offset: true }).nullable(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  transcript: z.string().trim().min(1),
  result: EvaluationResultSchema.nullable(),
  error: EvaluationErrorSchema.nullable(),
  metadata: EvaluationMetadataSchema.optional(),
} as const;

function validateRunLifecycle(
  run: {
    status: EvaluationStatus;
    processingStartedAt: string | null;
    completedAt: string | null;
    result: EvaluationResult | null;
    error: EvaluationError | null;
  },
  ctx: z.RefinementCtx
) {
  const issue = (path: string, message: string) =>
    ctx.addIssue({ code: "custom", message, path: [path] });

  if (run.status === "queued") {
    if (run.processingStartedAt !== null) issue("processingStartedAt", "Queued run cannot have processingStartedAt");
    if (run.completedAt !== null) issue("completedAt", "Queued run cannot have completedAt");
    if (run.result !== null) issue("result", "Queued run cannot have a result");
    if (run.error !== null) issue("error", "Queued run cannot have an error");
  }

  if (run.status === "processing") {
    if (run.processingStartedAt === null) issue("processingStartedAt", "Processing run requires processingStartedAt");
    if (run.completedAt !== null) issue("completedAt", "Processing run cannot have completedAt");
    if (run.result !== null) issue("result", "Processing run cannot have a result");
    if (run.error !== null) issue("error", "Processing run cannot have an error");
  }

  if (run.status === "completed") {
    if (run.processingStartedAt === null) issue("processingStartedAt", "Completed run requires processingStartedAt");
    if (run.completedAt === null) issue("completedAt", "Completed run requires completedAt");
    if (run.result === null) issue("result", "Completed run requires a result");
    if (run.error !== null) issue("error", "Completed run cannot have an error");
  }

  if (run.status === "failed") {
    if (run.processingStartedAt === null) issue("processingStartedAt", "Failed run requires processingStartedAt");
    if (run.completedAt === null) issue("completedAt", "Failed run requires completedAt");
    if (run.result !== null) issue("result", "Failed run cannot have a result");
    if (run.error === null) issue("error", "Failed run requires a structured error");
  }
}

export const EvaluationRunSchema = z
  .object(EvaluationRunShape)
  .superRefine(validateRunLifecycle);
export type EvaluationRun = z.infer<typeof EvaluationRunSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § 12. API-Oriented DTO Schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input payload for creating a new evaluation run.
 *
 * Validation:
 *   - callType must be "kickoff" or "coaching"
 *   - transcript must be non-empty after trimming
 *   - No hard upper limit enforced here because real transcripts can be ~65 KB.
 *     The worker layer may impose its own byte-size guardrail.
 */
export const CreateEvaluationInputSchema = z.object({
  callType: CallTypeSchema,
  transcript: z
    .string()
    .trim()
    .min(1, "Transcript must not be empty"),
});
export type CreateEvaluationInput = z.infer<typeof CreateEvaluationInputSchema>;

/**
 * Response returned immediately after a new evaluation run is created.
 * The run is in "queued" status at this point.
 */
export const CreateEvaluationResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.literal("queued"),
  /** Permanent permalink to the evaluation report page */
  evaluationUrl: z.string().url(),
});
export type CreateEvaluationResponse = z.infer<typeof CreateEvaluationResponseSchema>;

/**
 * Public API response shape for the permanent report page.
 *
 * Intentionally EXCLUDES the raw transcript to avoid serving large text
 * payloads in normal report requests. Transcript evidence is available via
 * the structured `dimensions[].evidence` field.
 *
 * The structured result is the only report-data source of truth.
 */
export const EvaluationPublicResponseSchema = z.object({
  id: z.string().uuid(),
  callType: CallTypeSchema,
  rubricVersion: z.string().min(1),
  status: EvaluationStatusSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  processingStartedAt: z.string().datetime({ offset: true }).nullable(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  result: EvaluationResultSchema.nullable(),
  error: EvaluationErrorSchema.nullable(),
  metadata: EvaluationMetadataSchema.optional(),
}).superRefine(validateRunLifecycle);
export type EvaluationPublicResponse = z.infer<typeof EvaluationPublicResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § 13. UI-Only lifecycle types (not part of the domain contract)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * These are pure UI state types used by the LifecycleStepper component.
 * They do not belong in the domain contract but are co-located here so the
 * types file remains a single import point for frontend consumers.
 */
export type LifecycleStepId = "created" | "evaluation" | "validation" | "report";
export type LifecycleStepState = "complete" | "active" | "waiting" | "failed";

export interface LifecycleStep {
  id: LifecycleStepId;
  label: string;
  state: LifecycleStepState;
  description?: string;
}
