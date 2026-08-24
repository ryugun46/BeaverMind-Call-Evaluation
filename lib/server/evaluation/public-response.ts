import "server-only";

import {
  EvaluationPublicResponseSchema,
  type EvaluationPublicResponse,
  type EvaluationRun,
} from "@/lib/contracts/evaluation";

export function toPublicEvaluationResponse(
  run: EvaluationRun
): EvaluationPublicResponse {
  return EvaluationPublicResponseSchema.parse(run);
}
