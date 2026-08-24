import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { OpenRouterModelSlugSchema } from "@/lib/evaluation-models";
import { getServerSupabaseClient } from "@/lib/server/supabase";

const EvaluationRuntimeConfigRowSchema = z.object({
  model_slug: OpenRouterModelSlugSchema,
});

export class EvaluationRuntimeConfigRepositoryError extends Error {
  constructor(cause: unknown) {
    const message =
      cause && typeof cause === "object" && "message" in cause
        ? String(cause.message)
        : "Unknown database error";
    super(`Could not retrieve evaluation runtime configuration: ${message}`, {
      cause,
    });
    this.name = "EvaluationRuntimeConfigRepositoryError";
  }
}

export function createEvaluationRuntimeConfigRepository(client: SupabaseClient) {
  return {
    async getModelSlug(): Promise<string> {
      const { data, error } = await client
        .from("evaluation_runtime_config")
        .select("model_slug")
        .eq("id", 1)
        .single();

      if (error) throw new EvaluationRuntimeConfigRepositoryError(error);
      return EvaluationRuntimeConfigRowSchema.parse(data).model_slug;
    },
  };
}

export function getEvaluationModelSlug(): Promise<string> {
  return createEvaluationRuntimeConfigRepository(
    getServerSupabaseClient()
  ).getModelSlug();
}
