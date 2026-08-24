import "server-only";

import { Buffer } from "node:buffer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  CreateEvaluationInputSchema,
  EvaluationErrorSchema,
  EvaluationResultSchema,
  EvaluationRunSchema,
  type CreateEvaluationInput,
  type EvaluationRun,
} from "@/lib/contracts/evaluation";
import { OpenRouterModelSlugSchema } from "@/lib/evaluation-models";
import { getRubricForCallType } from "@/lib/rubrics";
import { getServerSupabaseClient } from "@/lib/server/supabase";

export const MAX_TRANSCRIPT_BYTES = 5 * 1024 * 1024;

const UUIDSchema = z.string().uuid();

export const EvaluationLifecycleUpdateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("processing") }),
  z.object({
    status: z.literal("completed"),
    result: EvaluationResultSchema,
  }),
  z.object({
    status: z.literal("failed"),
    error: EvaluationErrorSchema,
  }),
]);
export type EvaluationLifecycleUpdate = z.infer<
  typeof EvaluationLifecycleUpdateSchema
>;

export const PersistedEvaluationRunSchema = EvaluationRunSchema.safeExtend({
  modelProvider: z.literal("openrouter"),
  modelName: OpenRouterModelSlugSchema,
});
export type PersistedEvaluationRun = z.infer<
  typeof PersistedEvaluationRunSchema
>;

const CreatedEvaluationRunSchema = z.object({
  run: PersistedEvaluationRunSchema,
  publicToken: UUIDSchema,
});
export type CreatedEvaluationRun = z.infer<typeof CreatedEvaluationRunSchema>;

const RUN_COLUMNS = [
  "id",
  "public_token",
  "call_type",
  "transcript",
  "status",
  "rubric_version",
  "model_provider",
  "model_name",
  "structured_result",
  "error_code",
  "error_message",
  "error_details",
  "processing_started_at",
  "completed_at",
  "created_at",
  "updated_at",
].join(",");

export class TranscriptTooLargeError extends RangeError {
  constructor(actualBytes: number) {
    super(
      `Transcript is ${actualBytes} bytes; maximum allowed size is ${MAX_TRANSCRIPT_BYTES} bytes`
    );
    this.name = "TranscriptTooLargeError";
  }
}

export class EvaluationRunRepositoryError extends Error {
  constructor(operation: string, cause: unknown) {
    const message =
      cause && typeof cause === "object" && "message" in cause
        ? String(cause.message)
        : "Unknown database error";
    super(`Could not ${operation}: ${message}`, { cause });
    this.name = "EvaluationRunRepositoryError";
  }
}

function asRow(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EvaluationRunRepositoryError(
      "map evaluation run",
      new TypeError("Database returned an invalid row")
    );
  }
  return value as Record<string, unknown>;
}

function mapEvaluationRun(value: unknown): PersistedEvaluationRun {
  const row = asRow(value);
  const error =
    row.error_code === null || row.error_code === undefined
      ? null
      : EvaluationErrorSchema.parse({
          code: row.error_code,
          message: row.error_message,
          ...(row.error_details === null || row.error_details === undefined
            ? {}
            : { details: row.error_details }),
        });

  return PersistedEvaluationRunSchema.parse({
    id: row.id,
    callType: row.call_type,
    rubricVersion: row.rubric_version,
    modelProvider: row.model_provider,
    modelName: row.model_name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    processingStartedAt: row.processing_started_at,
    completedAt: row.completed_at,
    transcript: row.transcript,
    result: row.structured_result,
    error,
  });
}

function throwIfDatabaseError(operation: string, error: unknown): void {
  if (error) throw new EvaluationRunRepositoryError(operation, error);
}

export function createEvaluationRunsRepository(client: SupabaseClient) {
  return {
    async create(input: CreateEvaluationInput): Promise<CreatedEvaluationRun> {
      const parsed = CreateEvaluationInputSchema.parse(input);
      const transcriptBytes = Buffer.byteLength(parsed.transcript, "utf8");
      if (transcriptBytes > MAX_TRANSCRIPT_BYTES) {
        throw new TranscriptTooLargeError(transcriptBytes);
      }

      const rubricVersion = getRubricForCallType(parsed.callType).version;
      const { data, error } = await client
        .from("evaluation_runs")
        .insert({
          call_type: parsed.callType,
          transcript: parsed.transcript,
          rubric_version: rubricVersion,
          model_provider: "openrouter",
          model_name: parsed.modelSlug,
        })
        .select(RUN_COLUMNS)
        .single();

      throwIfDatabaseError("create evaluation run", error);
      const row = asRow(data);
      return CreatedEvaluationRunSchema.parse({
        run: mapEvaluationRun(row),
        publicToken: row.public_token,
      });
    },

    async getById(id: string): Promise<PersistedEvaluationRun | null> {
      const parsedId = UUIDSchema.parse(id);
      const { data, error } = await client
        .from("evaluation_runs")
        .select(RUN_COLUMNS)
        .eq("id", parsedId)
        .maybeSingle();

      throwIfDatabaseError("retrieve evaluation run by id", error);
      return data === null ? null : mapEvaluationRun(data);
    },

    async getByPublicToken(publicToken: string): Promise<PersistedEvaluationRun | null> {
      const parsedToken = UUIDSchema.parse(publicToken);
      const { data, error } = await client
        .from("evaluation_runs")
        .select(RUN_COLUMNS)
        .eq("public_token", parsedToken)
        .maybeSingle();

      throwIfDatabaseError("retrieve evaluation run by public token", error);
      return data === null ? null : mapEvaluationRun(data);
    },

    async claimNextQueued(): Promise<PersistedEvaluationRun | null> {
      const { data, error } = await client
        .rpc("claim_next_evaluation_run")
        .maybeSingle();

      throwIfDatabaseError("claim next queued evaluation run", error);
      return data === null ? null : mapEvaluationRun(data);
    },

    async updateLifecycle(
      id: string,
      update: EvaluationLifecycleUpdate
    ): Promise<EvaluationRun> {
      const parsedId = UUIDSchema.parse(id);
      const parsed = EvaluationLifecycleUpdateSchema.parse(update);

      const values: Record<string, unknown> = { status: parsed.status };
      if (parsed.status === "completed") {
        values.structured_result = parsed.result;
      } else if (parsed.status === "failed") {
        values.error_code = parsed.error.code;
        values.error_message = parsed.error.message;
        values.error_details = parsed.error.details ?? null;
      }

      const { data, error } = await client
        .from("evaluation_runs")
        .update(values)
        .eq("id", parsedId)
        .select(RUN_COLUMNS)
        .single();

      throwIfDatabaseError("update evaluation run lifecycle", error);
      return mapEvaluationRun(data);
    },
  };
}

export function createEvaluationRun(
  input: CreateEvaluationInput
): Promise<CreatedEvaluationRun> {
  return createEvaluationRunsRepository(getServerSupabaseClient()).create(input);
}

export function getEvaluationRunById(id: string): Promise<EvaluationRun | null> {
  return createEvaluationRunsRepository(getServerSupabaseClient()).getById(id);
}

export function getEvaluationRunByPublicToken(
  publicToken: string
): Promise<EvaluationRun | null> {
  return createEvaluationRunsRepository(getServerSupabaseClient()).getByPublicToken(
    publicToken
  );
}

export function updateEvaluationRunLifecycle(
  id: string,
  update: EvaluationLifecycleUpdate
): Promise<EvaluationRun> {
  return createEvaluationRunsRepository(getServerSupabaseClient()).updateLifecycle(
    id,
    update
  );
}

export function claimNextQueuedEvaluationRun(): Promise<PersistedEvaluationRun | null> {
  return createEvaluationRunsRepository(
    getServerSupabaseClient()
  ).claimNextQueued();
}
