import { CallTypeSchema, type CallType } from "@/lib/contracts/evaluation";
import { COACHING_RUBRIC } from "./coaching";
import { KICKOFF_RUBRIC } from "./kickoff";
import type { RubricDefinition } from "./schema";

export { COACHING_RUBRIC } from "./coaching";
export { KICKOFF_RUBRIC } from "./kickoff";
export {
  STANDARD_PERFORMANCE_BANDS,
  getPerformanceBandForScore,
} from "./performance-bands";
export * from "./schema";

const RUBRICS_BY_CALL_TYPE: Record<CallType, RubricDefinition> = {
  kickoff: KICKOFF_RUBRIC,
  coaching: COACHING_RUBRIC,
};

/**
 * Typed callers can only supply a CallType. Runtime validation still protects
 * JavaScript callers and unvalidated boundary data.
 */
export function getRubricForCallType(callType: CallType): RubricDefinition {
  const parsed = CallTypeSchema.safeParse(callType);
  if (!parsed.success) {
    throw new TypeError(`Unsupported call type: ${String(callType)}`);
  }

  return RUBRICS_BY_CALL_TYPE[parsed.data];
}
