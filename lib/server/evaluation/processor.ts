import "server-only";

import { z } from "zod";

import type {
  EvaluationError,
  EvaluationResult,
  EvaluationRun,
} from "@/lib/contracts/evaluation";
import { createOpenRouterProvider, OpenRouterRequestError, type EvaluationProvider } from "@/lib/server/evaluation/openrouter";
import {
  EvaluationOutputValidationError,
  validateEvaluationResult,
} from "@/lib/server/evaluation/validate-result";
import {
  createEvaluationRunsRepository,
  type EvaluationLifecycleUpdate,
} from "@/lib/server/repositories/evaluation-runs";
import { getServerSupabaseClient } from "@/lib/server/supabase";

export type EvaluationProcessingRepository = {
  claimNextQueued(modelProvider: string, modelName: string): Promise<EvaluationRun | null>;
  updateLifecycle(id: string, update: EvaluationLifecycleUpdate): Promise<EvaluationRun>;
};

function toEvaluationError(error: unknown): EvaluationError {
  if (error instanceof OpenRouterRequestError) {
    return {
      code: "OPENROUTER_ERROR",
      message: "The evaluation provider could not complete this run.",
      details: {
        ...(error.status === undefined ? {} : { status: error.status }),
        ...(error.responseCode === undefined
          ? {}
          : { providerCode: error.responseCode }),
      },
    };
  }

  if (error instanceof EvaluationOutputValidationError) {
    return {
      code: "STRUCTURED_OUTPUT_ERROR",
      message: "The generated evaluation did not pass result validation.",
      details: { issues: error.issues.slice(0, 20) },
    };
  }

  if (error instanceof z.ZodError) {
    return {
      code: "STRUCTURED_OUTPUT_ERROR",
      message: "The evaluation provider returned an invalid response shape.",
      details: {
        issues: error.issues.slice(0, 20).map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    };
  }

  return {
    code: "WORKER_ERROR",
    message: "The evaluation worker encountered an unexpected error.",
    details: {
      errorType: error instanceof Error ? error.name : "UnknownError",
    },
  };
}

export function createEvaluationProcessor(
  repository: EvaluationProcessingRepository = createEvaluationRunsRepository(
    getServerSupabaseClient()
  ),
  provider: EvaluationProvider = createOpenRouterProvider()
) {
  return {
    async processNext(): Promise<EvaluationRun | null> {
      const claimed = await repository.claimNextQueued(
        provider.providerName,
        provider.modelName
      );
      if (!claimed) return null;

      try {
        const candidate = await provider.evaluate(claimed);
        const result: EvaluationResult = validateEvaluationResult(candidate, claimed);
        return await repository.updateLifecycle(claimed.id, {
          status: "completed",
          result,
        });
      } catch (error) {
        return repository.updateLifecycle(claimed.id, {
          status: "failed",
          error: toEvaluationError(error),
        });
      }
    },
  };
}

function waitForNextPoll(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

export async function runEvaluationWorker(options: {
  processor?: ReturnType<typeof createEvaluationProcessor>;
  pollIntervalMs: number;
  signal?: AbortSignal;
  onProcessed?: (run: EvaluationRun) => void;
  onError?: (error: unknown) => void;
}): Promise<void> {
  const processor = options.processor ?? createEvaluationProcessor();

  while (!options.signal?.aborted) {
    try {
      const processed = await processor.processNext();
      if (processed) {
        options.onProcessed?.(processed);
        continue;
      }
    } catch (error) {
      options.onError?.(error);
    }
    await waitForNextPoll(options.pollIntervalMs, options.signal);
  }
}
