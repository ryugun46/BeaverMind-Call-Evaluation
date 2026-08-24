import assert from "node:assert/strict";
import test from "node:test";

import {
  EvaluationResultSchema,
  EvaluationRunSchema,
} from "@/lib/contracts/evaluation";
import { getEvaluationById } from "@/lib/fixtures/evaluation-fixtures";
import {
  EvaluationEnvironmentError,
  getOpenRouterEnvironment,
} from "@/lib/server/evaluation/environment";
import {
  createOpenRouterProvider,
  normalizeProviderResult,
  OpenRouterRequestError,
  toStrictProviderSchema,
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
import { PersistedEvaluationRunSchema } from "@/lib/server/repositories/evaluation-runs";

const completedFixtureCandidate = getEvaluationById("demo-completed-kickoff");
if (!completedFixtureCandidate?.result) {
  throw new Error("Completed fixture is required");
}
const completedFixture = completedFixtureCandidate;
const completedResult = EvaluationResultSchema.parse(completedFixture.result);

const processingRun = PersistedEvaluationRunSchema.parse({
  ...completedFixture,
  modelProvider: "openrouter",
  modelName: "anthropic/claude-sonnet-4.6",
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

test("Phase 2 deterministically repairs model score-summary arithmetic", () => {
  const candidate = structuredClone(completedResult);
  candidate.scoreSummary = {
    rawScore: 1,
    maxPossible: 1,
    normalizedScore: 1,
    finalScore: 1,
    performanceBand: "FAIL",
  };

  const validated = validateEvaluationResult(candidate, completedFixture);

  assert.deepEqual(validated.scoreSummary, completedResult.scoreSummary);
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

  const responseSchema = (
    capturedBody?.response_format as {
      json_schema?: { schema?: Record<string, unknown> };
    }
  )?.json_schema?.schema;
  assert.ok(responseSchema);

  const incompleteObjects: string[] = [];
  const unsupportedAnnotations: string[] = [];
  const inspect = (value: unknown, path = "$") => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => inspect(item, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== "object") return;
    const object = value as Record<string, unknown>;
    if ("$schema" in object || "default" in object) {
      unsupportedAnnotations.push(path);
    }
    if (object.type === "object" && object.properties) {
      const propertyNames = Object.keys(object.properties as object);
      const required = new Set(
        Array.isArray(object.required) ? object.required : []
      );
      if (propertyNames.some((name) => !required.has(name))) {
        incompleteObjects.push(path);
      }
    }
    Object.entries(object).forEach(([key, child]) => inspect(child, `${path}.${key}`));
  };
  inspect(responseSchema);
  assert.deepEqual(incompleteObjects, []);
  assert.deepEqual(unsupportedAnnotations, []);
});

test("provider schema normalizes nullable domain-optional fields back to omission", () => {
  const candidate = structuredClone(completedResult) as unknown as Record<string, any>;
  candidate.oneThing.affectedDimensionNumbers = null;
  candidate.dimensions[0].evidence[0].turnIndex = null;

  const normalized = normalizeProviderResult(candidate) as Record<string, any>;

  assert.equal("affectedDimensionNumbers" in normalized.oneThing, false);
  assert.equal("turnIndex" in normalized.dimensions[0].evidence[0], false);
  assert.doesNotThrow(() => EvaluationResultSchema.parse(normalized));
});

test("strict provider schema keeps the root object shape", () => {
  const schema = toStrictProviderSchema({
    type: "object",
    properties: { requiredValue: { type: "string" }, optionalValue: { type: "number" } },
    required: ["requiredValue"],
    additionalProperties: false,
  }) as Record<string, any>;

  assert.deepEqual(schema.required, ["requiredValue", "optionalValue"]);
  assert.deepEqual(schema.properties.optionalValue, {
    anyOf: [{ type: "number" }, { type: "null" }],
  });
});

test("OpenRouter provider turns request timeouts into structured provider errors", async () => {
  const environment = getOpenRouterEnvironment({
    OPENROUTER_API_KEY: "openrouter-secret",
  });
  const provider = createOpenRouterProvider(
    "provider/model",
    environment,
    async () => {
      throw new DOMException("timed out", "TimeoutError");
    }
  );

  await assert.rejects(provider.evaluate(processingRun), (error: unknown) => {
    assert.ok(error instanceof OpenRouterRequestError);
    assert.equal(error.responseCode, "timeout");
    return true;
  });
});

function repositoryThatClaims(
  provider: EvaluationProvider,
  updates: EvaluationLifecycleUpdate[]
): EvaluationProcessingRepository {
  let claimed = false;
  return {
    async claimNextQueued() {
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

test("processor constructs OpenRouter with the model stored on the claimed run", async () => {
  const updates: EvaluationLifecycleUpdate[] = [];
  let constructedModel = "";
  const processor = createEvaluationProcessor(
    repositoryThatClaims(
      {
        providerName: "unused",
        modelName: "unused/model",
        async evaluate() {
          return completedResult;
        },
      },
      updates
    ),
    undefined,
    (modelName) => {
      constructedModel = modelName;
      return {
        providerName: "openrouter",
        modelName,
        async evaluate() {
          return completedResult;
        },
      };
    }
  );

  const result = await processor.processNext();

  assert.equal(constructedModel, "anthropic/claude-sonnet-4.6");
  assert.equal(result?.status, "completed");
});

test("processor marks a claimed run failed when provider construction fails", async () => {
  const updates: EvaluationLifecycleUpdate[] = [];
  const processor = createEvaluationProcessor(
    repositoryThatClaims(
      {
        providerName: "unused",
        modelName: "unused/model",
        async evaluate() {
          return completedResult;
        },
      },
      updates
    ),
    undefined,
    () => {
      throw new EvaluationEnvironmentError("OPENROUTER_API_KEY is required");
    }
  );

  const result = await processor.processNext();

  assert.equal(result?.status, "failed");
  const failure = updates[0];
  assert.equal(failure?.status, "failed");
  if (failure?.status === "failed") {
    assert.equal(failure.error.code, "WORKER_CONFIGURATION_ERROR");
    assert.equal(
      failure.error.message,
      "The evaluation worker is not configured correctly."
    );
    assert.deepEqual(failure.error.details, {
      configurationIssue:
        "Invalid evaluation environment: OPENROUTER_API_KEY is required",
    });
  }
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

test("processor retries a transient terminal persistence failure", async () => {
  let attempts = 0;
  const repository = repositoryThatClaims(
    {
      providerName: "openrouter",
      modelName: "provider/model",
      async evaluate() {
        return completedResult;
      },
    },
    []
  );
  const originalUpdate = repository.updateLifecycle;
  repository.updateLifecycle = async (id, update) => {
    attempts += 1;
    if (attempts < 3) throw new Error("temporary database failure");
    return originalUpdate(id, update);
  };

  const result = await createEvaluationProcessor(repository, {
    providerName: "openrouter",
    modelName: "provider/model",
    async evaluate() {
      return completedResult;
    },
  }).processNext();

  assert.equal(result?.status, "completed");
  assert.equal(attempts, 3);
});
