import assert from "node:assert/strict";
import test from "node:test";

import {
  EvaluationResultSchema,
  EvaluationRunSchema,
} from "@/lib/contracts/evaluation";
import { getEvaluationById } from "@/lib/fixtures/evaluation-fixtures";
import { getOpenRouterEnvironment } from "@/lib/server/evaluation/environment";
import {
  createOpenRouterProvider,
  OpenRouterRequestError,
  type EvaluationProvider,
} from "@/lib/server/evaluation/openrouter";
import {
  createEvaluationProcessor,
  type EvaluationProcessingRepository,
} from "@/lib/server/evaluation/processor";
import {
  EvaluationOutputValidationError,
  validateEvaluationResult,
} from "@/lib/server/evaluation/validate-result";
import type { EvaluationLifecycleUpdate } from "@/lib/server/repositories/evaluation-runs";

const completedFixtureCandidate = getEvaluationById("demo-completed-kickoff");
if (!completedFixtureCandidate?.result) {
  throw new Error("Completed fixture is required");
}
const completedFixture = completedFixtureCandidate;
const completedResult = EvaluationResultSchema.parse(completedFixture.result);

const processingRun = EvaluationRunSchema.parse({
  ...completedFixture,
  status: "processing",
  processingStartedAt: completedFixture.createdAt,
  completedAt: null,
  result: null,
  error: null,
});

test("Phase 2 validation accepts a contract-valid, rubric-grounded fixture", () => {
  assert.deepEqual(
    validateEvaluationResult(completedResult, completedFixture),
    completedResult
  );
});

test("Phase 2 validation rejects evidence not found verbatim in the transcript", () => {
  const candidate = structuredClone(completedResult);
  candidate.dimensions[0]!.evidence[0]!.quote = "This quote was fabricated.";

  assert.throws(
    () => validateEvaluationResult(candidate, completedFixture),
    EvaluationOutputValidationError
  );
});

test("OpenRouter provider requests strict structured output and parses JSON", async () => {
  let capturedAuthorization = "";
  let capturedBody: Record<string, unknown> | undefined;
  const environment = getOpenRouterEnvironment({
    OPENROUTER_API_KEY: "openrouter-secret",
  });
  const provider = createOpenRouterProvider("provider/model", environment, async (_input, init) => {
    capturedAuthorization = new Headers(init?.headers).get("Authorization") ?? "";
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        model: "provider/model",
        choices: [
          { message: { content: JSON.stringify(completedResult) } },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  });

  const result = await provider.evaluate(processingRun);

  assert.deepEqual(result, completedResult);
  assert.equal(capturedAuthorization, "Bearer openrouter-secret");
  assert.equal(
    (capturedBody?.response_format as { type?: string })?.type,
    "json_schema"
  );
  assert.deepEqual(capturedBody?.provider, { require_parameters: true });
});

function repositoryThatClaims(
  provider: EvaluationProvider,
  updates: EvaluationLifecycleUpdate[]
): EvaluationProcessingRepository {
  let claimed = false;
  return {
    async claimNextQueued(modelProvider, modelName) {
      assert.equal(modelProvider, provider.providerName);
      assert.equal(modelName, provider.modelName);
      if (claimed) return null;
      claimed = true;
      return processingRun;
    },
    async updateLifecycle(_id, update) {
      updates.push(update);
      if (update.status === "completed") {
        return EvaluationRunSchema.parse({
          ...processingRun,
          status: "completed",
          completedAt: completedFixture.completedAt,
          result: update.result,
        });
      }
      if (update.status === "failed") {
        return EvaluationRunSchema.parse({
          ...processingRun,
          status: "failed",
          completedAt: completedFixture.completedAt,
          error: update.error,
        });
      }
      return processingRun;
    },
  };
}

test("processor completes a claimed run after provider and rubric validation", async () => {
  const updates: EvaluationLifecycleUpdate[] = [];
  const provider: EvaluationProvider = {
    providerName: "test-provider",
    modelName: "test-model",
    async evaluate() {
      return completedResult;
    },
  };
  const processor = createEvaluationProcessor(
    repositoryThatClaims(provider, updates),
    provider
  );

  const result = await processor.processNext();

  assert.equal(result?.status, "completed");
  assert.equal(updates[0]?.status, "completed");
});

test("processor persists a structured provider failure", async () => {
  const updates: EvaluationLifecycleUpdate[] = [];
  const provider: EvaluationProvider = {
    providerName: "openrouter",
    modelName: "provider/model",
    async evaluate() {
      throw new OpenRouterRequestError("rate limited", 429, "rate_limit");
    },
  };
  const processor = createEvaluationProcessor(
    repositoryThatClaims(provider, updates),
    provider
  );

  const result = await processor.processNext();

  assert.equal(result?.status, "failed");
  const failure = updates[0];
  assert.equal(failure?.status, "failed");
  if (failure?.status === "failed") {
    assert.equal(failure.error.code, "OPENROUTER_ERROR");
    assert.deepEqual(failure.error.details, {
      status: 429,
      providerCode: "rate_limit",
    });
  }
});
