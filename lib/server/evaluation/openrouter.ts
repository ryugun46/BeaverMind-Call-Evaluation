import "server-only";

import { z } from "zod";

import { EvaluationResultSchema, type EvaluationRun } from "@/lib/contracts/evaluation";
import { OpenRouterModelSlugSchema } from "@/lib/evaluation-models";
import {
  getOpenRouterEnvironment,
  type OpenRouterEnvironment,
} from "@/lib/server/evaluation/environment";
import { buildEvaluationMessages } from "@/lib/server/evaluation/prompt";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const RESULT_JSON_SCHEMA = z.toJSONSchema(EvaluationResultSchema, {
  target: "draft-7",
});

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
    run: Pick<EvaluationRun, "id" | "callType" | "transcript" | "rubricVersion">
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

export function createOpenRouterProvider(
  modelName: string,
  environment: OpenRouterEnvironment = getOpenRouterEnvironment(),
  fetchImplementation: typeof fetch = fetch
): EvaluationProvider {
  const model = OpenRouterModelSlugSchema.parse(modelName);

  return {
    providerName: "openrouter",
    modelName: model,

    async evaluate(run) {
      const startedAt = Date.now();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${environment.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Title": environment.OPENROUTER_APP_TITLE,
      };
      if (environment.OPENROUTER_SITE_URL) {
        headers["HTTP-Referer"] = environment.OPENROUTER_SITE_URL;
      }

      console.info(`Evaluation ${run.id}: sending OpenRouter request`, { model });

      let response: Response;
      try {
        response = await fetchImplementation(OPENROUTER_CHAT_URL, {
          method: "POST",
          headers,
          signal: AbortSignal.timeout(environment.OPENROUTER_TIMEOUT_MS),
          body: JSON.stringify({
            model,
            messages: buildEvaluationMessages(run),
            max_tokens: environment.OPENROUTER_MAX_TOKENS,
            stream: false,
            provider: { require_parameters: true },
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "beavermind_evaluation_result",
                strict: true,
                schema: RESULT_JSON_SCHEMA,
              },
            },
          }),
        });
      } catch (error) {
        console.error(`Evaluation ${run.id}: OpenRouter request failed before response`, {
          model,
          elapsedMs: Date.now() - startedAt,
          errorType: error instanceof Error ? error.name : "UnknownError",
        });
        throw requestFailure(error);
      }

      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const providerError = safeProviderError(body);
        console.error(`Evaluation ${run.id}: OpenRouter returned an error`, {
          model,
          status: response.status,
          providerCode: providerError.code,
          elapsedMs: Date.now() - startedAt,
        });
        throw new OpenRouterRequestError(
          `OpenRouter request failed with HTTP ${response.status}`,
          response.status,
          providerError.code,
          providerError.message
        );
      }

      const parsedResponse = OpenRouterResponseSchema.parse(body);
      console.info(`Evaluation ${run.id}: OpenRouter request completed`, {
        requestedModel: model,
        responseModel: parsedResponse.model,
        elapsedMs: Date.now() - startedAt,
        usage: parsedResponse.usage,
        requestId: response.headers.get("x-request-id") ?? undefined,
      });
      const content = parsedResponse.choices[0]?.message.content;
      if (!content) {
        throw new OpenRouterRequestError("OpenRouter returned no structured content");
      }

      try {
        return JSON.parse(content) as unknown;
      } catch (error) {
        throw new OpenRouterRequestError(
          `OpenRouter returned invalid JSON: ${error instanceof Error ? error.message : "parse failed"}`
        );
      }
    },
  };
}
