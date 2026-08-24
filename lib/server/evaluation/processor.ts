import "server-only";

import { z } from "zod";

import type {
  EvaluationError,
  EvaluationResult,
  EvaluationRun,
} from "@/lib/contracts/evaluation";
import { EvaluationEnvironmentError } from "@/lib/server/evaluation/environment";
import { createOpenRouterProvider, OpenRouterRequestError, type EvaluationProvider } from "@/lib/server/evaluation/openrouter";
import {
  EvaluationOutputValidationError,
  validateEvaluationResult,
} from "@/lib/server/evaluation/validate-result";
import {
  createEvaluationRunsRepository,
  type EvaluationLifecycleUpdate,
  type PersistedEvaluationRun,
} from "@/lib/server/repositories/evaluation-runs";
import { getServerSupabaseClient } from "@/lib/server/supabase";

export type EvaluationProcessingRepository = {
  claimNextQueued(): Promise<PersistedEvaluationRun | null>;
  updateLifecycle(id: string, update: EvaluationLifecycleUpdate): Promise<EvaluationRun>;
};

type EvaluationProviderFactory = (modelName: string) => EvaluationProvider;

function toEvaluationError(error: unknown): EvaluationError {
  if (error instanceof EvaluationEnvironmentError) {
    return {
      code: "WORKER_CONFIGURATION_ERROR",
      message: "The evaluation worker is not configured correctly.",
      details: { configurationIssue: error.message },
    };
  }

  if (error instanceof OpenRouterRequestError) {
    return {
      code: "OPENROUTER_ERROR",
      message: "The evaluation provider could not complete this run.",
      details: {
        ...(error.status === undefined ? {} : { status: error.status }),
        ...(error.responseCode === undefined
          ? {}
          : { providerCode: error.responseCode }),
        ...(error.providerMessage === undefined
          ? {}
          : { providerMessage: error.providerMessage.slice(0, 500) }),
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
  provider?: EvaluationProvider,
  providerFactory: EvaluationProviderFactory = createOpenRouterProvider
) {
  async function persistTerminalUpdate(
    id: string,
    update: Extract<EvaluationLifecycleUpdate, { status: "completed" | "failed" }>
  ): Promise<EvaluationRun> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await repository.updateLifecycle(id, update);
      } catch (error) {
        lastError = error;
        console.error(`Evaluation ${id}: terminal persistence attempt ${attempt} failed`, {
          status: update.status,
          errorType: error instanceof Error ? error.name : "UnknownError",
        });
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 250));
        }
      }
    }
    throw lastError;
  }

  return {
    async processNext(): Promise<EvaluationRun | null> {
      const claimed = await repository.claimNextQueued();
      if (!claimed) return null;

      let result: EvaluationResult;
      try {
        const activeProvider = provider ?? providerFactory(claimed.modelName);
        const candidate = await activeProvider.evaluate(claimed);
        result = validateEvaluationResult(candidate, claimed);
      } catch (error) {
        return persistTerminalUpdate(claimed.id, {
          status: "failed",
          error: toEvaluationError(error),
        });
      }

      return persistTerminalUpdate(claimed.id, {
        status: "completed",
        result,
      });
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
