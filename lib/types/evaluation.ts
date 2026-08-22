/**
 * @file lib/types/evaluation.ts
 *
 * Re-exports all domain types from the authoritative shared contract.
 * Import from this file within the Next.js frontend — it provides
 * full backward compatibility with existing component imports.
 *
 * The source of truth is: lib/contracts/evaluation.ts
 */

export type {
  CallType,
  EvaluationStatus,
  PerformanceBand,
  EvidenceItem,
  DimensionResult,
  ScoringRuleScope,
  AppliedScoringRule,
  RedFlagItem,
  OneThing,
  ScoreSummary,
  EvaluationResult,
  EvaluationError,
  EvaluationMetadata,
  EvaluationRun,
  CreateEvaluationInput,
  CreateEvaluationResponse,
  EvaluationPublicResponse,
  LifecycleStepId,
  LifecycleStepState,
  LifecycleStep,
} from "@/lib/contracts/evaluation";

/**
 * @deprecated Use `AppliedScoringRule` from lib/contracts/evaluation instead.
 * This alias is kept for backward compatibility with components that imported
 * `AppliedCap` before the contract was introduced.
 */
export type { AppliedScoringRule as AppliedCap } from "@/lib/contracts/evaluation";
