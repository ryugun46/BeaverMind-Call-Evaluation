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
import {
  analyzeTranscript,
  getSpeakerWordShareByLabel,
} from "@/lib/server/evaluation/transcript-metrics";
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
  const validated = validateEvaluationResult(completedResult, completedFixture);

  assert.equal(validated.dimensions[11]!.score, 3.5);
  assert.equal(validated.scoreSummary.rawScore, 89.5);
  assert.equal(validated.scoreSummary.finalScore, 89.5);
});

test("Phase 2 requires AI-identified client and coach names", () => {
  const candidate = structuredClone(completedResult);
  delete candidate.clientName;
  delete candidate.coachName;

  assert.throws(
    () => validateEvaluationResult(candidate, completedFixture),
    (error: unknown) => {
      assert.ok(error instanceof EvaluationOutputValidationError);
      assert.ok(error.issues.some((issue) => issue.includes("clientName")));
      assert.ok(error.issues.some((issue) => issue.includes("coachName")));
      return true;
    }
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

  assert.deepEqual(
    validated.scoreSummary,
    validateEvaluationResult(completedResult, completedFixture).scoreSummary
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

test("Phase 2 reconciles formatting-only evidence differences to the exact source", () => {
  const candidate = structuredClone(completedResult);
  const exactQuote = candidate.dimensions[0]!.evidence[0]!.quote;
  candidate.dimensions[0]!.evidence[0]!.quote = exactQuote
    .toLocaleUpperCase()
    .replaceAll(" ", "  ");

  const validated = validateEvaluationResult(candidate, completedFixture);

  assert.equal(validated.dimensions[0]!.evidence[0]!.quote, exactQuote);
});

test("Phase 2 applies recorded dimension rules and recalculates totals", () => {
  const candidate = structuredClone(completedResult);
  candidate.appliedRules.push({
    ruleId: "KICKOFF_NO_NORTH_STAR_D4_CAP",
    label: "No North Star Statement",
    description: "No North Star statement was constructed.",
    scope: "dimension",
    affectedDimensionNumber: 4,
    effect: "Cap D4 at 10",
    nonRecoverable: false,
  });
  candidate.dimensions[3]!.score = 15;
  candidate.dimensions[3]!.band = "ELITE";

  const validated = validateEvaluationResult(candidate, completedFixture);

  assert.equal(validated.dimensions[3]!.score, 10);
  assert.equal(validated.dimensions[3]!.band, "STRONG");
  assert.equal(
    validated.scoreSummary.rawScore,
    validateEvaluationResult(completedResult, completedFixture).scoreSummary.rawScore - 5
  );
});

test("Phase 2 rejects a model-only talk-ratio rule when speaker counts disprove it", () => {
  const candidate = structuredClone(completedResult);
  candidate.appliedRules.push({
    ruleId: "KICKOFF_COACH_TALK_RATIO_TOTAL_CAP",
    label: "Coach Monologue",
    description: "The coach allegedly spoke more than seventy percent.",
    scope: "total",
    effect: "Cap total at 80",
  });
  const run = {
    ...completedFixture,
    transcript: `${completedFixture.transcript}\nClient: ${"client response ".repeat(500)}`,
  };

  const validated = validateEvaluationResult(candidate, run);

  assert.equal(
    validated.appliedRules.some(
      (rule) => rule.ruleId === "KICKOFF_COACH_TALK_RATIO_TOTAL_CAP"
    ),
    false
  );
  assert.equal(validated.scoreSummary.finalScore, 89.5);
});

test("transcript metrics provide deterministic labelled-speaker shares", () => {
  const metrics = analyzeTranscript(
    "Coach (Sam): One two three?\nClient: Four five\nCoach (Sam): Six"
  );

  assert.equal(metrics.parsedTurnCount, 3);
  assert.equal(metrics.parsedWordCount, 6);
  assert.equal(getSpeakerWordShareByLabel(metrics, "coach"), 66.67);
  assert.equal(metrics.speakers[0]?.questionMarkCount, 1);
});

test("OpenRouter provider requests strict structured output and parses JSON", async () => {
  let capturedAuthorization = "";
  let capturedBody: Record<string, unknown> | undefined;
  const environment = getOpenRouterEnvironment({
    OPENROUTER_API_KEY: "openrouter-secret",
  });
  const provider = createOpenRouterProvider("anthropic/claude-sonnet-4.6", environment, async (_input, init) => {
    capturedAuthorization = new Headers(init?.headers).get("Authorization") ?? "";
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        model: "anthropic/claude-sonnet-4.6",
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
  assert.equal(capturedBody?.temperature, 0);
  assert.match(
    JSON.stringify(capturedBody?.messages),
    /DETERMINISTIC TRANSCRIPT METRICS/
  );

  const responseSchema = (
    capturedBody?.response_format as {
      json_schema?: { schema?: Record<string, unknown> };
    }
  )?.json_schema?.schema;
  assert.ok(responseSchema);
  assert.ok(
    Array.isArray(responseSchema.required) &&
      responseSchema.required.includes("clientName") &&
      responseSchema.required.includes("coachName")
  );

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

test("GPT-5.6 requests use a supported repeatability seed", async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const provider = createOpenRouterProvider(
    "openai/gpt-5.6-sol",
    getOpenRouterEnvironment({ OPENROUTER_API_KEY: "openrouter-secret" }),
    async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          model: "openai/gpt-5.6-sol",
          choices: [{ message: { content: JSON.stringify(completedResult) } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  );

  await provider.evaluate(processingRun);

  assert.equal(capturedBody?.seed, 4262026);
  assert.equal("temperature" in (capturedBody ?? {}), false);
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

test("processor requests one repair after a structured validation failure", async () => {
  const updates: EvaluationLifecycleUpdate[] = [];
  const invalidResult = structuredClone(completedResult);
  invalidResult.dimensions[0]!.evidence[0]!.quote = "This quote was fabricated.";
  let calls = 0;
  const provider: EvaluationProvider = {
    providerName: "test-provider",
    modelName: "test-model",
    async evaluate(_run, repair) {
      calls += 1;
      if (calls === 1) {
        assert.equal(repair, undefined);
        return invalidResult;
      }
      assert.ok(repair?.issues.some((issue) => issue.includes("evidence.0.quote")));
      return completedResult;
    },
  };
  const processor = createEvaluationProcessor(
    repositoryThatClaims(provider, updates),
    provider
  );

  const result = await processor.processNext();

  assert.equal(result?.status, "completed");
  assert.equal(calls, 2);
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
