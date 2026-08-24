import "server-only";

import { z } from "zod";

import { EvaluationResultSchema, type EvaluationRun } from "@/lib/contracts/evaluation";
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
    run: Pick<EvaluationRun, "callType" | "transcript" | "rubricVersion">
  ): Promise<unknown>;
};

export class OpenRouterRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly responseCode?: string
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

export function createOpenRouterProvider(
  environment: OpenRouterEnvironment = getOpenRouterEnvironment(),
  fetchImplementation: typeof fetch = fetch
): EvaluationProvider {
  return {
    providerName: "openrouter",
    modelName: environment.OPENROUTER_MODEL,

    async evaluate(run) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${environment.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Title": environment.OPENROUTER_APP_TITLE,
      };
      if (environment.OPENROUTER_SITE_URL) {
        headers["HTTP-Referer"] = environment.OPENROUTER_SITE_URL;
      }

      const response = await fetchImplementation(OPENROUTER_CHAT_URL, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(environment.OPENROUTER_TIMEOUT_MS),
        body: JSON.stringify({
          model: environment.OPENROUTER_MODEL,
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

      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const providerError = safeProviderError(body);
        throw new OpenRouterRequestError(
          `OpenRouter request failed with HTTP ${response.status}`,
          response.status,
          providerError.code
        );
      }

      const parsedResponse = OpenRouterResponseSchema.parse(body);
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
