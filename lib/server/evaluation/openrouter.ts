import "server-only";

import { z } from "zod";

import {
  EvaluationProviderResultSchema,
  type DimensionResult,
  type EvaluationRun,
} from "@/lib/contracts/evaluation";
import { OpenRouterModelSlugSchema } from "@/lib/evaluation-models";
import { getRubricForCallType } from "@/lib/rubrics";
import {
  getOpenRouterEnvironment,
  type OpenRouterEnvironment,
} from "@/lib/server/evaluation/environment";
import {
  buildEvidenceMapMessages,
  compileEvidenceDossier,
  EvidenceMapResultSchema,
  type PreparedTranscriptContext,
  validateEvidenceMapCoverage,
} from "@/lib/server/evaluation/evidence-map";
import {
  appliedRulesFromDecisions,
  buildDeterministicReportSynthesis,
  buildDimensionScoringMessages,
  buildReportSynthesisMessages,
  buildRuleAuditMessages,
  DimensionScoringResultSchema,
  normalizeRuleAuditResult,
  ReportSynthesisResultSchema,
  RuleAuditResultSchema,
} from "@/lib/server/evaluation/scoring-stages";
import {
  chunkTranscript,
  parseTranscript,
} from "@/lib/server/evaluation/transcript-structure";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const DOMAIN_RESULT_JSON_SCHEMA = z.toJSONSchema(EvaluationProviderResultSchema, {
  target: "draft-7",
});
const DOMAIN_EVIDENCE_MAP_JSON_SCHEMA = z.toJSONSchema(EvidenceMapResultSchema, {
  target: "draft-7",
});
const DOMAIN_RULE_AUDIT_JSON_SCHEMA = z.toJSONSchema(RuleAuditResultSchema, {
  target: "draft-7",
});
const DOMAIN_DIMENSION_SCORE_JSON_SCHEMA = z.toJSONSchema(
  DimensionScoringResultSchema,
  { target: "draft-7" }
);
const DOMAIN_REPORT_SYNTHESIS_JSON_SCHEMA = z.toJSONSchema(
  ReportSynthesisResultSchema,
  { target: "draft-7" }
);

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * OpenAI strict structured outputs require every object property to be listed
 * in `required`. Domain-optional fields are represented as required nullable
 * fields for generation, then normalized back to omission before validation.
 */
export function toStrictProviderSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toStrictProviderSchema);
  if (!isJsonObject(value)) return value;

  const output: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    if (["$schema", "default", "properties", "required", "additionalProperties"].includes(key)) {
      continue;
    }
    output[key] = toStrictProviderSchema(child);
  }

  if (isJsonObject(value.properties)) {
    const originallyRequired = new Set(
      Array.isArray(value.required)
        ? value.required.filter((item): item is string => typeof item === "string")
        : []
    );
    const properties: JsonObject = {};
    for (const [name, propertySchema] of Object.entries(value.properties)) {
      const strictPropertySchema = toStrictProviderSchema(propertySchema);
      properties[name] = originallyRequired.has(name)
        ? strictPropertySchema
        : { anyOf: [strictPropertySchema, { type: "null" }] };
    }
    output.properties = properties;
    output.required = Object.keys(properties);
    output.additionalProperties = false;
  }

  return output;
}

export function normalizeProviderResult(
  value: unknown,
  schema: unknown = DOMAIN_RESULT_JSON_SCHEMA
): unknown {
  if (Array.isArray(value)) {
    const itemSchema = isJsonObject(schema) ? schema.items : undefined;
    return value.map((item) => normalizeProviderResult(item, itemSchema));
  }
  if (!isJsonObject(value) || !isJsonObject(schema)) return value;

  const properties = isJsonObject(schema.properties) ? schema.properties : {};
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((item): item is string => typeof item === "string")
      : []
  );
  const normalized: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    const propertySchema = properties[key];
    if (child === null && propertySchema !== undefined && !required.has(key)) {
      continue;
    }
    normalized[key] = normalizeProviderResult(child, propertySchema);
  }
  return normalized;
}

const EVIDENCE_MAP_JSON_SCHEMA = toStrictProviderSchema(DOMAIN_EVIDENCE_MAP_JSON_SCHEMA);
const RULE_AUDIT_JSON_SCHEMA = toStrictProviderSchema(DOMAIN_RULE_AUDIT_JSON_SCHEMA);
const DIMENSION_SCORE_JSON_SCHEMA = toStrictProviderSchema(
  DOMAIN_DIMENSION_SCORE_JSON_SCHEMA
);
const REPORT_SYNTHESIS_JSON_SCHEMA = toStrictProviderSchema(
  DOMAIN_REPORT_SYNTHESIS_JSON_SCHEMA
);

function deterministicSamplingParameters(model: string) {
  if (model.startsWith("anthropic/")) return { temperature: 0 };
  if (model.startsWith("openai/") || model.startsWith("google/")) {
    return { seed: 4262026 };
  }
  return {};
}

const OpenRouterResponseSchema = z.object({
  model: z.string().optional(),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
      cost: z.number().optional(),
    })
    .optional(),
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable() }),
      })
    )
    .min(1),
});

export type EvaluationProvider = {
  readonly providerName: string;
  readonly modelName: string;
  evaluate(
    run: Pick<EvaluationRun, "id" | "callType" | "transcript" | "rubricVersion">,
    repair?: {
      previousResult: unknown;
      issues: string[];
    }
  ): Promise<unknown>;
};

export class OpenRouterRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly responseCode?: string,
    readonly providerMessage?: string
  ) {
    super(message);
    this.name = "OpenRouterRequestError";
  }
}

function safeProviderError(value: unknown): { code?: string; message?: string } {
  const parsed = z
    .object({
      error: z.object({
        code: z.union([z.string(), z.number()]).optional(),
        message: z.string().optional(),
      }),
    })
    .safeParse(value);

  return parsed.success
    ? {
        code: parsed.data.error.code?.toString(),
        message: parsed.data.error.message,
      }
    : {};
}

function requestFailure(error: unknown): OpenRouterRequestError {
  if (error instanceof Error && error.name === "TimeoutError") {
    return new OpenRouterRequestError(
      "OpenRouter request timed out",
      undefined,
      "timeout",
      "OpenRouter did not respond before the configured timeout."
    );
  }

  return new OpenRouterRequestError(
    "OpenRouter request could not be sent",
    undefined,
    "network_error",
    "The worker could not reach OpenRouter."
  );
}

type PipelineStats = {
  startedAt: number;
  attempts: number;
  successfulRequests: number;
  retries: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
};

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryAfterMilliseconds(response: Response): number | undefined {
  const value = response.headers.get("retry-after")?.trim();
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export function createOpenRouterProvider(
  modelName: string,
  environment: OpenRouterEnvironment = getOpenRouterEnvironment(),
  fetchImplementation: typeof fetch = fetch
): EvaluationProvider {
  const model = OpenRouterModelSlugSchema.parse(modelName);
  const preparedContexts = new Map<string, Promise<PreparedTranscriptContext | undefined>>();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${environment.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "X-OpenRouter-Title": environment.OPENROUTER_APP_TITLE,
  };
  if (environment.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = environment.OPENROUTER_SITE_URL;

  async function requestStructured(options: {
    runId: string;
    stage: "evidence_map" | "rule_audit" | "dimension_score" | "report_synthesis";
    messages: Array<{ role: "system" | "user"; content: string }>;
    schemaName: string;
    strictSchema: unknown;
    domainSchema: unknown;
    maxTokens: number;
    deadlineAt: number;
    stats: PipelineStats;
  }): Promise<unknown> {
    const startedAt = Date.now();
    for (
      let attempt = 0;
      attempt <= environment.OPENROUTER_REQUEST_RETRIES;
      attempt += 1
    ) {
      const remainingMs = options.deadlineAt - Date.now();
      if (remainingMs < 1_000) {
        throw new OpenRouterRequestError(
          "Evaluation pipeline exhausted its time budget",
          undefined,
          "pipeline_timeout",
          "The scoring pipeline stopped before the hosting deadline; retry the evaluation."
        );
      }

      options.stats.attempts += 1;
      console.info(`Evaluation ${options.runId}: sending OpenRouter request`, {
        model,
        stage: options.stage,
        attempt: attempt + 1,
      });

      let response: Response;
      try {
        response = await fetchImplementation(OPENROUTER_CHAT_URL, {
          method: "POST",
          headers,
          signal: AbortSignal.timeout(
            Math.min(environment.OPENROUTER_TIMEOUT_MS, remainingMs)
          ),
          body: JSON.stringify({
            model,
            messages: options.messages,
            max_tokens: options.maxTokens,
            ...deterministicSamplingParameters(model),
            stream: false,
            provider: { require_parameters: true },
            response_format: {
              type: "json_schema",
              json_schema: {
                name: options.schemaName,
                strict: true,
                schema: options.strictSchema,
              },
            },
          }),
        });
      } catch (error) {
        const failure = requestFailure(error);
        const canRetry = attempt < environment.OPENROUTER_REQUEST_RETRIES;
        console.error(`Evaluation ${options.runId}: OpenRouter request failed before response`, {
          model,
          stage: options.stage,
          attempt: attempt + 1,
          elapsedMs: Date.now() - startedAt,
          errorType: error instanceof Error ? error.name : "UnknownError",
          willRetry: canRetry,
        });
        if (!canRetry) throw failure;
        options.stats.retries += 1;
        const delayMs = Math.min(5_000, 400 * 2 ** attempt);
        if (Date.now() + delayMs + 1_000 >= options.deadlineAt) throw failure;
        await wait(delayMs);
        continue;
      }

      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const providerError = safeProviderError(body);
        const canRetry =
          attempt < environment.OPENROUTER_REQUEST_RETRIES &&
          isRetryableStatus(response.status);
        console.error(`Evaluation ${options.runId}: OpenRouter returned an error`, {
          model,
          stage: options.stage,
          attempt: attempt + 1,
          status: response.status,
          providerCode: providerError.code,
          elapsedMs: Date.now() - startedAt,
          willRetry: canRetry,
        });
        const failure = new OpenRouterRequestError(
          `OpenRouter request failed with HTTP ${response.status}`,
          response.status,
          providerError.code,
          providerError.message
        );
        if (!canRetry) throw failure;

        const providerDelay = retryAfterMilliseconds(response);
        const delayMs = providerDelay ?? Math.min(5_000, 400 * 2 ** attempt);
        // A very long Retry-After cannot safely fit inside a synchronous web request.
        if (
          delayMs > 30_000 ||
          Date.now() + delayMs + 1_000 >= options.deadlineAt
        ) {
          throw failure;
        }
        options.stats.retries += 1;
        await wait(delayMs);
        continue;
      }

      const parsedResponse = OpenRouterResponseSchema.parse(body);
      options.stats.successfulRequests += 1;
      options.stats.promptTokens += parsedResponse.usage?.prompt_tokens ?? 0;
      options.stats.completionTokens += parsedResponse.usage?.completion_tokens ?? 0;
      options.stats.totalTokens += parsedResponse.usage?.total_tokens ?? 0;
      options.stats.cost += parsedResponse.usage?.cost ?? 0;
      console.info(`Evaluation ${options.runId}: OpenRouter request completed`, {
        requestedModel: model,
        responseModel: parsedResponse.model,
        stage: options.stage,
        attempt: attempt + 1,
        elapsedMs: Date.now() - startedAt,
        usage: parsedResponse.usage,
        requestId: response.headers.get("x-request-id") ?? undefined,
      });
      const content = parsedResponse.choices[0]?.message.content;
      if (!content) {
        throw new OpenRouterRequestError("OpenRouter returned no structured content");
      }

      try {
        return normalizeProviderResult(
          JSON.parse(content) as unknown,
          options.domainSchema
        );
      } catch (error) {
        throw new OpenRouterRequestError(
          `OpenRouter returned invalid JSON: ${
            error instanceof Error ? error.message : "parse failed"
          }`
        );
      }
    }

    throw new OpenRouterRequestError("OpenRouter retry loop ended unexpectedly");
  }

  function correctedMessages(
    messages: Array<{ role: "system" | "user"; content: string }>,
    issue: string
  ) {
    return [
      ...messages,
      {
        role: "user" as const,
        content: `Your previous structured response failed deterministic stage validation. Return the complete corrected object. Issue: ${issue}`,
      },
    ];
  }

  async function prepareLargeTranscript(
    run: Pick<EvaluationRun, "id" | "callType" | "transcript" | "rubricVersion">,
    deadlineAt: number,
    stats: PipelineStats
  ): Promise<PreparedTranscriptContext | undefined> {
    const parsed = parseTranscript(run.transcript);
    const chunkingThreshold = Math.min(
      environment.EVALUATION_LARGE_TRANSCRIPT_WORDS,
      environment.EVALUATION_CHUNK_WORDS
    );
    if (parsed.totalWordCount <= chunkingThreshold) return undefined;

    const chunks = chunkTranscript(run.transcript, {
      maxWords: environment.EVALUATION_CHUNK_WORDS,
      overlapTurns: environment.EVALUATION_CHUNK_OVERLAP_TURNS,
    });
    console.info(`Evaluation ${run.id}: large-transcript evidence mapping`, {
      wordCount: parsed.totalWordCount,
      turnCount: parsed.turns.length,
      chunkCount: chunks.length,
      attributionReliable: parsed.attributionReliable,
    });

    const maps: Array<z.infer<typeof EvidenceMapResultSchema>> = new Array(chunks.length);
    for (let offset = 0; offset < chunks.length; offset += environment.EVALUATION_MAP_CONCURRENCY) {
      const batch = chunks.slice(offset, offset + environment.EVALUATION_MAP_CONCURRENCY);
      await Promise.all(
        batch.map(async (chunk) => {
          const messages = buildEvidenceMapMessages(run, chunk, chunks.length);
          const requestMap = (requestMessages = messages) => requestStructured({
            runId: run.id,
            stage: "evidence_map",
            messages: requestMessages,
            schemaName: "beavermind_transcript_evidence_map",
            strictSchema: EVIDENCE_MAP_JSON_SCHEMA,
            domainSchema: DOMAIN_EVIDENCE_MAP_JSON_SCHEMA,
            maxTokens: Math.min(6_000, environment.OPENROUTER_MAX_TOKENS),
            deadlineAt,
            stats,
          });
          let candidate = await requestMap();
          try {
            maps[chunk.index] = validateEvidenceMapCoverage(
              candidate,
              getRubricForCallType(run.callType)
            );
          } catch (error) {
            const issue = error instanceof Error ? error.message : "coverage validation failed";
            candidate = await requestMap(correctedMessages(messages, issue));
            try {
              maps[chunk.index] = validateEvidenceMapCoverage(
                candidate,
                getRubricForCallType(run.callType)
              );
            } catch (retryError) {
              throw new OpenRouterRequestError(
                `Evidence map ${chunk.index + 1} did not audit every rubric target after retry: ${
                  retryError instanceof Error
                    ? retryError.message
                    : "coverage validation failed"
                }`
              );
            }
          }
        })
      );
    }

    const compiled = compileEvidenceDossier({ run, parsed, chunks, maps });
    console.info(`Evaluation ${run.id}: evidence dossier compiled`, {
      chunkCount: chunks.length,
      validatedMomentCount: compiled.moments.length,
      dossierCharacters: compiled.dossier.length,
    });
    return { mode: "evidence_dossier", parsed, chunks, maps, ...compiled };
  }

  return {
    providerName: "openrouter",
    modelName: model,

    async evaluate(run, repair) {
      const stats: PipelineStats = {
        startedAt: Date.now(),
        attempts: 0,
        successfulRequests: 0,
        retries: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
      };
      const deadlineAt = stats.startedAt + environment.EVALUATION_PIPELINE_TIMEOUT_MS;
      try {
      const cacheKey = `${run.id}:${run.transcript.length}:${run.rubricVersion}`;
      let preparedPromise = preparedContexts.get(cacheKey);
      if (!preparedPromise) {
        preparedPromise = prepareLargeTranscript(run, deadlineAt, stats);
        preparedContexts.set(cacheKey, preparedPromise);
      }
      const prepared = await preparedPromise;

      const repairContext = repair
        ? { issues: repair.issues.slice(0, 20) }
        : undefined;
      const ruleMessages = buildRuleAuditMessages(run, prepared, repairContext);
      const requestRuleAudit = (messages = ruleMessages) => requestStructured({
        runId: run.id,
        stage: "rule_audit",
        messages,
        schemaName: "beavermind_rule_audit",
        strictSchema: RULE_AUDIT_JSON_SCHEMA,
        domainSchema: DOMAIN_RULE_AUDIT_JSON_SCHEMA,
        maxTokens: Math.min(5_000, environment.OPENROUTER_MAX_TOKENS),
        deadlineAt,
        stats,
      });
      let ruleCandidate = await requestRuleAudit();
      let ruleDecisions;
      try {
        ruleDecisions = normalizeRuleAuditResult(ruleCandidate, run);
      } catch (error) {
        const issue = error instanceof Error ? error.message : "invalid rule audit";
        ruleCandidate = await requestRuleAudit(
          correctedMessages(ruleMessages, issue)
        );
        try {
          ruleDecisions = normalizeRuleAuditResult(ruleCandidate, run);
        } catch (retryError) {
          throw new OpenRouterRequestError(
            `Rule audit failed deterministic reconciliation after retry: ${
              retryError instanceof Error ? retryError.message : "invalid rule audit"
            }`
          );
        }
      }

      const dimensions: DimensionResult[] = new Array(12);
      for (
        let offset = 0;
        offset < 12;
        offset += environment.EVALUATION_DIMENSION_CONCURRENCY
      ) {
        const dimensionNumbers = Array.from(
          {
            length: Math.min(
              environment.EVALUATION_DIMENSION_CONCURRENCY,
              12 - offset
            ),
          },
          (_, index) => offset + index + 1
        );
        await Promise.all(
          dimensionNumbers.map(async (dimensionNumber) => {
            const messages = buildDimensionScoringMessages(
              run,
              dimensionNumber,
              ruleDecisions,
              prepared,
              repairContext
            );
            const requestDimension = (requestMessages = messages) => requestStructured({
              runId: run.id,
              stage: "dimension_score",
              messages: requestMessages,
              schemaName: "beavermind_dimension_score",
              strictSchema: DIMENSION_SCORE_JSON_SCHEMA,
              domainSchema: DOMAIN_DIMENSION_SCORE_JSON_SCHEMA,
              maxTokens: Math.min(4_000, environment.OPENROUTER_MAX_TOKENS),
              deadlineAt,
              stats,
            });
            const definition = getRubricForCallType(run.callType).dimensions[
              dimensionNumber - 1
            ]!;
            const parseDimension = (candidate: unknown) => {
              const result = DimensionScoringResultSchema.parse(candidate);
              const parsed = result.dimension;
              if (
                parsed.dimensionNumber !== dimensionNumber ||
                parsed.name !== definition.name ||
                parsed.maxScore !== definition.maxScore
              ) {
                throw new Error("scorer returned mismatched rubric identity");
              }
              const expectedLabels = definition.scoring.scoreBands.map(
                (band) => band.label
              );
              const actualLabels = result.bandAssessments.map(
                (assessment) => assessment.label
              );
              if (
                actualLabels.length !== expectedLabels.length ||
                actualLabels.some(
                  (label, index) => label !== expectedLabels[index]
                )
              ) {
                throw new Error("scorer did not audit every authored band in order");
              }
              const disabledByRule = (definition.applicabilityRules ?? []).some(
                (rule) =>
                  ruleDecisions.some(
                    (decision) =>
                      decision.ruleId === rule.id && decision.triggered
                  )
              );
              if (parsed.disabled !== disabledByRule) {
                throw new Error(
                  disabledByRule
                    ? "dimension must be disabled by its applicability decision"
                    : "dimension cannot be disabled without an applicability decision"
                );
              }
              if (!parsed.disabled) {
                const highestSupported = result.bandAssessments.find(
                  (assessment) => assessment.fullySupported
                );
                if (!highestSupported || parsed.band !== highestSupported.label) {
                  throw new Error(
                    "selected band is not the highest fully supported authored band"
                  );
                }
              }
              return parsed;
            };
            let candidate = await requestDimension();
            let parsed: DimensionResult;
            try {
              parsed = parseDimension(candidate);
            } catch (error) {
              const issue = error instanceof Error ? error.message : "invalid dimension result";
              candidate = await requestDimension(correctedMessages(messages, issue));
              try {
                parsed = parseDimension(candidate);
              } catch (retryError) {
                throw new OpenRouterRequestError(
                  `Dimension ${dimensionNumber} failed validation after retry: ${
                    retryError instanceof Error ? retryError.message : "invalid result"
                  }`
                );
              }
            }
            dimensions[dimensionNumber - 1] = parsed;
          })
        );
      }

      const rubric = getRubricForCallType(run.callType);
      const appliedRules = appliedRulesFromDecisions(rubric, ruleDecisions);
      const synthesisMessages = buildReportSynthesisMessages(
        run,
        dimensions,
        appliedRules,
        prepared,
        repairContext
      );
      const requestSynthesis = (messages = synthesisMessages) => requestStructured({
        runId: run.id,
        stage: "report_synthesis",
        messages,
        schemaName: "beavermind_report_synthesis",
        strictSchema: REPORT_SYNTHESIS_JSON_SCHEMA,
        domainSchema: DOMAIN_REPORT_SYNTHESIS_JSON_SCHEMA,
        maxTokens: Math.min(4_000, environment.OPENROUTER_MAX_TOKENS),
        deadlineAt,
        stats,
      });
      let synthesis;
      try {
        const synthesisCandidate = await requestSynthesis();
        synthesis = ReportSynthesisResultSchema.parse(synthesisCandidate);
      } catch (error) {
        const issue = error instanceof Error ? error.message : "invalid report synthesis";
        try {
          const correctedCandidate = await requestSynthesis(
            correctedMessages(synthesisMessages, issue)
          );
          synthesis = ReportSynthesisResultSchema.parse(correctedCandidate);
        } catch (retryError) {
          console.warn(`Evaluation ${run.id}: narrative synthesis failed; using deterministic fallback`, {
            model,
            error: retryError instanceof Error ? retryError.message : "invalid synthesis",
          });
          synthesis = buildDeterministicReportSynthesis(
            run,
            dimensions,
            appliedRules,
            prepared
          );
        }
      }

      return {
        clientName: synthesis.clientName,
        coachName: synthesis.coachName,
        brief: synthesis.brief,
        oneThing: {
          ...synthesis.oneThing,
          currentScore: 0,
        },
        redFlags: synthesis.redFlags,
        appliedRules,
        dimensions,
        // The validator owns all summary arithmetic and replaces this placeholder.
        scoreSummary: {
          rawScore: 0,
          maxPossible: 100,
          normalizedScore: 0,
          finalScore: 0,
          performanceBand: "FAIL",
        },
      };
      } finally {
        console.info(`Evaluation ${run.id}: scoring pipeline summary`, {
          model,
          elapsedMs: Date.now() - stats.startedAt,
          attempts: stats.attempts,
          successfulRequests: stats.successfulRequests,
          retries: stats.retries,
          promptTokens: stats.promptTokens,
          completionTokens: stats.completionTokens,
          totalTokens: stats.totalTokens,
          cost: stats.cost,
        });
      }
    },
  };
}
