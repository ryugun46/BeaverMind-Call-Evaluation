import { z } from "zod";

/**
 * Models exposed by the submission UI. This is intentionally a curated
 * allowlist: changing the selected model is a per-run choice, while adding a
 * new model remains a reviewed code change.
 *
 * Availability and structured-output support were verified against the
 * OpenRouter models API on 2026-08-25.
 */
export const EVALUATION_MODELS = {
  "openai/gpt-4.1-mini": {
    family: "GPT",
    name: "GPT-4.1 Mini",
    tier: "Fast baseline",
    description: "Proven, low-cost default for repeatable testing.",
  },
  "openai/gpt-5.6-luna": {
    family: "GPT",
    name: "GPT-5.6 Luna",
    tier: "Budget",
    description: "Lowest-cost GPT option for quick evaluation runs.",
  },
  "openai/gpt-5.6-terra": {
    family: "GPT",
    name: "GPT-5.6 Terra",
    tier: "Balanced",
    description: "Balanced GPT option for stronger evaluation quality.",
  },
  "openai/gpt-5.6-sol": {
    family: "GPT",
    name: "GPT-5.6 Sol",
    tier: "Quality",
    description: "Higher-quality GPT option for demanding transcripts.",
  },
} as const;

export type EvaluationModelSlug = keyof typeof EVALUATION_MODELS;

const evaluationModelSlugs = Object.keys(EVALUATION_MODELS) as [
  EvaluationModelSlug,
  ...EvaluationModelSlug[],
];

/** Accepts only models currently selectable in the UI. */
export const EvaluationModelSlugSchema = z.enum(evaluationModelSlugs);

/** Accepts persisted OpenRouter slugs, including models retired from the UI. */
export const OpenRouterModelSlugSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z0-9._-]+\/[a-z0-9._:-]+$/,
    "Model must use an OpenRouter provider/model slug"
  );

export const DEFAULT_EVALUATION_MODEL: EvaluationModelSlug =
  "openai/gpt-5.6-sol";

export const EVALUATION_MODEL_OPTIONS = evaluationModelSlugs.map((slug) => ({
  slug,
  ...EVALUATION_MODELS[slug],
}));
