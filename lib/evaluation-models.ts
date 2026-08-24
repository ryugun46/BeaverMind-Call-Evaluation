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
  "anthropic/claude-haiku-4.5": {
    family: "Claude",
    name: "Claude Haiku 4.5",
    tier: "Fast",
    description: "Fast Claude option with a 200K-token context window.",
  },
  "anthropic/claude-sonnet-4.6": {
    family: "Claude",
    name: "Claude Sonnet 4.6",
    tier: "Balanced",
    description: "Balanced Claude option for nuanced rubric reasoning.",
  },
  "anthropic/claude-opus-4.8": {
    family: "Claude",
    name: "Claude Opus 4.8",
    tier: "Quality",
    description: "Premium Claude option for the most demanding reviews.",
  },
  "google/gemini-3.7-flash": {
    family: "Gemini",
    name: "Gemini 3.7 Flash",
    tier: "Fast",
    description: "Fast Gemini option with a one-million-token context window.",
  },
  "google/gemini-3.5-flash": {
    family: "Gemini",
    name: "Gemini 3.5 Flash",
    tier: "Balanced",
    description: "Higher-capability Gemini Flash option for long calls.",
  },
  "google/gemini-2.5-pro": {
    family: "Gemini",
    name: "Gemini 2.5 Pro",
    tier: "Quality",
    description: "Pro-tier Gemini option for detailed rubric analysis.",
  },
} as const;

export type EvaluationModelSlug = keyof typeof EVALUATION_MODELS;
export type EvaluationModelFamily =
  (typeof EVALUATION_MODELS)[EvaluationModelSlug]["family"];

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
  "openai/gpt-4.1-mini";

export const EVALUATION_MODEL_OPTIONS = evaluationModelSlugs.map((slug) => ({
  slug,
  ...EVALUATION_MODELS[slug],
}));
