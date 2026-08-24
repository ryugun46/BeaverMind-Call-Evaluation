import "server-only";

import { z } from "zod";

const OpenRouterEnvironmentSchema = z.object({
  OPENROUTER_API_KEY: z.string().trim().min(1, "OPENROUTER_API_KEY is required"),
  OPENROUTER_MODEL: z
    .string()
    .trim()
    .regex(/^[^/]+\/[^/]+$/, "OPENROUTER_MODEL must use a provider/model slug"),
  OPENROUTER_SITE_URL: z.string().trim().url().optional(),
  OPENROUTER_APP_TITLE: z.string().trim().min(1).default("BeaverMind Call Evaluation"),
  OPENROUTER_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(180_000),
  OPENROUTER_MAX_TOKENS: z.coerce.number().int().min(1_000).max(64_000).default(16_000),
  EVALUATION_WORKER_POLL_MS: z.coerce.number().int().min(250).max(60_000).default(2_000),
});

export type OpenRouterEnvironment = z.infer<typeof OpenRouterEnvironmentSchema>;

let cachedEnvironment: OpenRouterEnvironment | undefined;

export function getOpenRouterEnvironment(
  source: Readonly<Record<string, string | undefined>> = process.env
): OpenRouterEnvironment {
  if (source === process.env && cachedEnvironment) return cachedEnvironment;

  const parsed = OpenRouterEnvironmentSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid evaluation environment: ${details}`);
  }

  if (source === process.env) cachedEnvironment = parsed.data;
  return parsed.data;
}
