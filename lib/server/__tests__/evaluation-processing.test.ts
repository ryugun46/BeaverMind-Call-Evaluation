import assert from "node:assert/strict";
import test from "node:test";

import {
  EvaluationResultSchema,
  EvaluationRunSchema,
} from "@/lib/contracts/evaluation";
import { getEvaluationById } from "@/lib/fixtures/evaluation-fixtures";
import { getRubricForCallType } from "@/lib/rubrics";
import {
  EvaluationEnvironmentError,
  getOpenRouterEnvironment,
} from "@/lib/server/evaluation/environment";
import { validateEvidenceMapCoverage } from "@/lib/server/evaluation/evidence-map";
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
import {
  chunkTranscript,
  locateTranscriptQuote,
  parseTranscript,
} from "@/lib/server/evaluation/transcript-structure";
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

function orderedRubricRuleIds(callType: "kickoff" | "coaching") {
  const rubric = getRubricForCallType(callType);
  return [
    ...rubric.dimensions.flatMap((dimension) =>
      (dimension.applicabilityRules ?? []).map((rule) => rule.id)
    ),
    ...rubric.automaticRules.map((rule) => rule.id),
  ];
}

function mockEvidenceMap(callType: "kickoff" | "coaching") {
  return {
    chunkSummary: "This source interval was reviewed against every target.",
    speakerRoles: [
      { label: "Coach", role: "coach", personalName: null },
      { label: "Client", role: "client", personalName: null },
    ],
    moments: [],
    dimensionAudits: Array.from({ length: 12 }, (_, index) => ({
      dimensionNumber: index + 1,
      finding: "no_relevant_evidence",
      summary: `Dimension ${index + 1} was explicitly checked in this chunk.`,
    })),
    ruleAudits: orderedRubricRuleIds(callType).map((ruleId) => ({
      ruleId,
      finding: "no_relevant_evidence",
      summary: "This rule was explicitly checked in this chunk.",
    })),
  };
}

function stagedProviderContent(body: Record<string, any>) {
  const schemaName = body.response_format?.json_schema?.name;
  if (schemaName === "beavermind_transcript_evidence_map") {
    return mockEvidenceMap("kickoff");
  }
  if (schemaName === "beavermind_rule_audit") {
    return {
      decisions: orderedRubricRuleIds("kickoff").map((ruleId) => ({
        ruleId,
        triggered: false,
        reasoning: "Every transcript interval was checked and the condition did not trigger.",
        evidence: [],
      })),
    };
  }
  if (schemaName === "beavermind_dimension_score") {
    const messages = JSON.stringify(body.messages);
    const dimensionNumber = Number(
      /Return dimensionNumber (\d+)/.exec(messages)?.[1]
    );
    const dimension = completedResult.dimensions[dimensionNumber - 1]!;
    const definition = getRubricForCallType("kickoff").dimensions[
      dimensionNumber - 1
    ]!;
    return {
      bandAssessments: definition.scoring.scoreBands.map((band) => ({
        label: band.label,
        fullySupported: band.label === dimension.band,
        reasoning:
          band.label === dimension.band
            ? "Every required clause is supported."
            : "At least one required clause is not supported.",
      })),
      dimension,
    };
  }
  if (schemaName === "beavermind_report_synthesis") {
    return {
      clientName: completedResult.clientName,
      coachName: completedResult.coachName,
      brief: completedResult.brief,
      oneThing: {
        title: completedResult.oneThing.title,
        explanation: completedResult.oneThing.explanation,
        potentialScore: completedResult.oneThing.potentialScore,
        affectedDimensionNumbers:
          completedResult.oneThing.affectedDimensionNumbers ?? [],
      },
      redFlags: completedResult.redFlags.map((flag) => ({
        ...flag,
        severity: flag.severity ?? "medium",
      })),
    };
  }
  throw new Error(`Unexpected provider schema ${schemaName}`);
}

test("Phase 2 validation accepts a contract-valid, rubric-grounded fixture", () => {
  const validated = validateEvaluationResult(completedResult, completedFixture);

  assert.equal(validated.dimensions[11]!.score, 4);
  assert.equal(validated.scoreSummary.rawScore, 92);
  assert.equal(validated.scoreSummary.finalScore, 92);
});

test("Kick-off rubric can attain the full authored 100 points", () => {
  const candidate = structuredClone(completedResult);
  const rubric = getRubricForCallType("kickoff");
  candidate.dimensions.forEach((dimension, index) => {
    const topBand = rubric.dimensions[index]!.scoring.scoreBands[0]!;
    dimension.score =
      topBand.scoreKind === "anchor" ? topBand.score : topBand.maxScore;
    dimension.band = topBand.label;
  });

  const validated = validateEvaluationResult(candidate, completedFixture);

  assert.equal(validated.scoreSummary.rawScore, 100);
  assert.equal(validated.scoreSummary.finalScore, 100);
});

test("an applied Coaching N/A rule cannot leave its dimension active", () => {
  const coachingFixture = getEvaluationById("demo-completed-coaching");
  assert.ok(coachingFixture?.result);
  const candidate = structuredClone(coachingFixture.result);
  candidate.appliedRules.push({
    ruleId: "COACHING_D4_NO_MOVEMENT_COACHING",
    label: "Movement Coaching Quality Not Applicable",
    description: "All chunks were checked and no movement coaching occurred.",
    scope: "applicability",
    affectedDimensionNumber: 4,
    effect: "Exclude 15 points and normalize to 100",
  });

  assert.throws(
    () => validateEvaluationResult(candidate, coachingFixture),
    (error: unknown) =>
      error instanceof EvaluationOutputValidationError &&
      error.issues.some((issue) => issue.includes("must be disabled"))
  );
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
  assert.equal(validated.dimensions[0]!.evidence[0]!.speaker, "Coach (Sarah)");
  assert.equal(validated.dimensions[0]!.evidence[0]!.turnIndex, 0);
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
  assert.equal(
    validated.scoreSummary.finalScore,
    validateEvaluationResult(completedResult, completedFixture).scoreSummary.finalScore
  );
});

test("transcript metrics provide deterministic labelled-speaker shares", () => {
  const metrics = analyzeTranscript(
    "Coach (Sam): One two three?\nClient: Four five\nCoach (Sam): Six"
  );

  assert.equal(metrics.parsedTurnCount, 3);
  assert.equal(metrics.parsedWordCount, 6);
  assert.equal(getSpeakerWordShareByLabel(metrics, "coach"), 66.67);
  assert.equal(metrics.speakers[0]?.questionMarkCount, 1);
  assert.equal(metrics.speakerAttributionReliable, true);
});

test("transcript parsing retains timestamps, continuation text, and source attribution", () => {
  const transcript = [
    "[00:01:12] Coach (Sam): What changed this week?",
    "Please include even the small wins.",
    "00:01:19 Client: My back feels better.",
  ].join("\n");
  const parsed = parseTranscript(transcript);

  assert.equal(parsed.turns.length, 2);
  assert.equal(parsed.turns[0]?.timestamp, "00:01:12");
  assert.match(parsed.turns[0]?.text ?? "", /small wins/);
  assert.equal(parsed.attributionReliable, true);

  const located = locateTranscriptQuote(transcript, "Please include even the small wins.", "Coach", parsed);
  assert.equal(located?.speaker, "Coach (Sam)");
  assert.equal(located?.turnIndex, 0);
  assert.equal(located?.timestamp, "00:01:12");
});

test("transcript parsing recognizes timestamped speaker headers without colons", () => {
  const transcript = [
    "00:00 - Marcus Vance",
    "What felt hardest this week?",
    "Jordan Hayes (00:08)",
    "Staying consistent while traveling.",
  ].join("\n");

  const parsed = parseTranscript(transcript);

  assert.equal(parsed.turns.length, 2);
  assert.deepEqual(
    parsed.turns.map(({ speaker, timestamp, text }) => ({ speaker, timestamp, text })),
    [
      {
        speaker: "Marcus Vance",
        timestamp: "00:00",
        text: "What felt hardest this week?",
      },
      {
        speaker: "Jordan Hayes",
        timestamp: "00:08",
        text: "Staying consistent while traveling.",
      },
    ]
  );
  assert.equal(parsed.attributionReliable, true);
});

test("Phase 2 retains evaluator attribution when a transcript has no speaker labels", () => {
  const unlabelledTranscript = completedFixture.transcript.replace(/^[^:\r\n]+:\s*/gm, "");

  const validated = validateEvaluationResult(completedResult, {
    ...completedFixture,
    transcript: unlabelledTranscript,
  });

  assert.equal(validated.dimensions[0]!.evidence[0]!.speaker, "Coach");
  assert.equal(validated.dimensions[0]!.evidence[0]!.turnIndex, 0);
});

test("smart chunking stays turn-aligned and overlaps source turns", () => {
  const transcript = Array.from({ length: 12 }, (_, index) =>
    `${index % 2 === 0 ? "Coach" : "Client"}: turn ${index} ${"detail ".repeat(8)}`
  ).join("\n");
  const chunks = chunkTranscript(transcript, { maxWords: 35, overlapTurns: 1 });

  assert.ok(chunks.length > 2);
  assert.equal(chunks[0]?.sourceStart, 0);
  assert.equal(chunks.at(-1)?.sourceEnd, transcript.length);
  for (let index = 1; index < chunks.length; index += 1) {
    assert.ok(chunks[index]!.firstTurnIndex <= chunks[index - 1]!.lastTurnIndex);
  }
});

test("chunk evidence maps must explicitly audit every dimension and rule", () => {
  const incomplete = {
    chunkSummary: "Only a generic summary was returned.",
    speakerRoles: [],
    moments: [],
    dimensionAudits: [],
    ruleAudits: [],
  };

  assert.throws(() =>
    validateEvidenceMapCoverage(incomplete, getRubricForCallType("kickoff"))
  );
  assert.doesNotThrow(() =>
    validateEvidenceMapCoverage(
      mockEvidenceMap("kickoff"),
      getRubricForCallType("kickoff")
    )
  );
});

test("OpenRouter provider requests strict structured output and parses JSON", async () => {
  let capturedAuthorization = "";
  const capturedBodies: Array<Record<string, any>> = [];
  const environment = getOpenRouterEnvironment({
    OPENROUTER_API_KEY: "openrouter-secret",
  });
  const provider = createOpenRouterProvider("anthropic/claude-sonnet-4.6", environment, async (_input, init) => {
    capturedAuthorization = new Headers(init?.headers).get("Authorization") ?? "";
    const body = JSON.parse(String(init?.body)) as Record<string, any>;
    capturedBodies.push(body);
    return new Response(
      JSON.stringify({
        model: "anthropic/claude-sonnet-4.6",
        choices: [{ message: { content: JSON.stringify(stagedProviderContent(body)) } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  });

  const result = await provider.evaluate(processingRun);
  const validated = validateEvaluationResult(result, processingRun);
  const ruleBody = capturedBodies.find(
    (body) => body.response_format?.json_schema?.name === "beavermind_rule_audit"
  );
  const reportBody = capturedBodies.find(
    (body) => body.response_format?.json_schema?.name === "beavermind_report_synthesis"
  );

  assert.deepEqual(
    validated.dimensions.map(({ dimensionNumber, score, band }) => ({
      dimensionNumber,
      score,
      band,
    })),
    completedResult.dimensions.map(({ dimensionNumber, score, band }) => ({
      dimensionNumber,
      score,
      band,
    }))
  );
  assert.equal(capturedAuthorization, "Bearer openrouter-secret");
  assert.equal(
    ruleBody?.response_format?.type,
    "json_schema"
  );
  assert.deepEqual(ruleBody?.provider, { require_parameters: true });
  assert.equal(ruleBody?.temperature, 0);
  assert.match(
    JSON.stringify(ruleBody?.messages),
    /DETERMINISTIC TRANSCRIPT METRICS/
  );
  assert.equal(
    capturedBodies.filter(
      (body) => body.response_format?.json_schema?.name === "beavermind_dimension_score"
    ).length,
    12
  );

  const responseSchema = (
    reportBody?.response_format as {
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

test("independent dimension scoring retries a mismatched band audit once", async () => {
  let injectedMismatch = false;
  const requests: Array<Record<string, any>> = [];
  const provider = createOpenRouterProvider(
    "openai/gpt-5.6-sol",
    getOpenRouterEnvironment({ OPENROUTER_API_KEY: "openrouter-secret" }),
    async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, any>;
      requests.push(body);
      let content: any = stagedProviderContent(body);
      if (
        !injectedMismatch &&
        body.response_format?.json_schema?.name === "beavermind_dimension_score" &&
        /Return dimensionNumber 1/.test(JSON.stringify(body.messages))
      ) {
        injectedMismatch = true;
        content = {
          ...content,
          bandAssessments: content.bandAssessments.map((assessment: any) => ({
            ...assessment,
            fullySupported: false,
          })),
        };
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(content) } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  );

  const candidate = await provider.evaluate(processingRun);

  assert.doesNotThrow(() => validateEvaluationResult(candidate, processingRun));
  assert.equal(
    requests.filter(
      (request) =>
        request.response_format?.json_schema?.name === "beavermind_dimension_score"
    ).length,
    13
  );
  assert.ok(
    requests.some((request) =>
      /failed deterministic stage validation/.test(JSON.stringify(request.messages))
    )
  );
});

test("OpenRouter provider recovers from a transient rate limit", async () => {
  let attempts = 0;
  const provider = createOpenRouterProvider(
    "openai/gpt-5.6-sol",
    getOpenRouterEnvironment({
      OPENROUTER_API_KEY: "openrouter-secret",
      OPENROUTER_REQUEST_RETRIES: "1",
    }),
    async (_input, init) => {
      attempts += 1;
      if (attempts === 1) {
        return new Response(
          JSON.stringify({ error: { code: "rate_limited", message: "Try again" } }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", "Retry-After": "0" },
          }
        );
      }
      const body = JSON.parse(String(init?.body)) as Record<string, any>;
      return new Response(
        JSON.stringify({
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0.01 },
          choices: [{ message: { content: JSON.stringify(stagedProviderContent(body)) } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  );

  const candidate = await provider.evaluate(processingRun);

  assert.doesNotThrow(() => validateEvaluationResult(candidate, processingRun));
  assert.equal(attempts, 15, "one retry plus the normal 14-stage pipeline");
});

test("narrative failures do not discard validated dimension scores", async () => {
  let synthesisAttempts = 0;
  const provider = createOpenRouterProvider(
    "openai/gpt-5.6-sol",
    getOpenRouterEnvironment({
      OPENROUTER_API_KEY: "openrouter-secret",
      OPENROUTER_REQUEST_RETRIES: "0",
    }),
    async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, any>;
      const isSynthesis =
        body.response_format?.json_schema?.name === "beavermind_report_synthesis";
      if (isSynthesis) synthesisAttempts += 1;
      const content = isSynthesis ? {} : stagedProviderContent(body);
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  );

  const candidate = await provider.evaluate(processingRun);
  const validated = validateEvaluationResult(candidate, processingRun);

  assert.equal(synthesisAttempts, 2);
  assert.equal(validated.scoreSummary.finalScore, completedResult.scoreSummary.finalScore);
  assert.equal(validated.clientName, "David");
  assert.equal(validated.coachName, "Sarah");
  assert.match(validated.brief, /12 active rubric dimensions/);
});

test("large transcripts use chunk evidence maps and a compact final dossier", async () => {
  const longTranscript = Array.from({ length: 130 }, (_, index) =>
    `${index % 2 === 0 ? "Coach" : "Client"}: segment ${index} ${"context ".repeat(9)}${index === 129 ? "unique_final_marker" : ""}`
  ).join("\n");
  const run = { ...processingRun, transcript: longTranscript };
  const environment = getOpenRouterEnvironment({
    OPENROUTER_API_KEY: "openrouter-secret",
    EVALUATION_LARGE_TRANSCRIPT_WORDS: "1000",
    EVALUATION_CHUNK_WORDS: "500",
    EVALUATION_CHUNK_OVERLAP_TURNS: "2",
    EVALUATION_MAP_CONCURRENCY: "2",
  });
  const requests: Array<Record<string, any>> = [];
  const provider = createOpenRouterProvider(
    "anthropic/claude-sonnet-4.6",
    environment,
    async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, any>;
      requests.push(body);
      const content = stagedProviderContent(body);
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  );

  await provider.evaluate(run);
  const mapRequests = requests.filter(
    (request) => request.response_format?.json_schema?.name === "beavermind_transcript_evidence_map"
  );
  const ruleRequest = requests.find(
    (request) => request.response_format?.json_schema?.name === "beavermind_rule_audit"
  )!;
  const dimensionRequests = requests.filter(
    (request) => request.response_format?.json_schema?.name === "beavermind_dimension_score"
  );
  const scoringMessages = JSON.stringify([
    ruleRequest.messages,
    ...dimensionRequests.map((request) => request.messages),
  ]);

  assert.ok(mapRequests.length >= 3);
  assert.equal(dimensionRequests.length, 12);
  assert.equal(requests.length, mapRequests.length + 14);
  assert.match(scoringMessages, /MANDATORY PER-CHUNK/);
  assert.doesNotMatch(scoringMessages, /unique_final_marker/);

  await provider.evaluate(run, { previousResult: completedResult, issues: ["test repair"] });
  assert.equal(
    requests.filter(
      (request) => request.response_format?.json_schema?.name === "beavermind_transcript_evidence_map"
    ).length,
    mapRequests.length,
    "repair should reuse the cached evidence map"
  );
});

test("GPT-5.6 requests use a supported repeatability seed", async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const provider = createOpenRouterProvider(
    "openai/gpt-5.6-sol",
    getOpenRouterEnvironment({ OPENROUTER_API_KEY: "openrouter-secret" }),
    async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const body = capturedBody as Record<string, any>;
      return new Response(
        JSON.stringify({
          model: "openai/gpt-5.6-sol",
          choices: [{ message: { content: JSON.stringify(stagedProviderContent(body)) } }],
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
    OPENROUTER_REQUEST_RETRIES: "0",
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
